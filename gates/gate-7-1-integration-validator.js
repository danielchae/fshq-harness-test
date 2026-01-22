#!/usr/bin/env node

/**
 * Gate 7-1: Backend Integration Validator
 * Validates that all backend components and services work together
 */

const fs = require('fs');
const path = require('path');

const STATUS = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress'
};

function resolveImportPath(workspacePath, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return [];
  }

  // Handle @/ alias imports (maps to src/)
  if (targetPath.startsWith('@/')) {
    const relativePath = targetPath.replace('@/', '');
    const base = path.join(workspacePath, 'src', relativePath);
    return buildCandidatePaths(base);
  }

  // Handle relative paths
  const base = path.join(workspacePath, targetPath);
  return buildCandidatePaths(base);
}

function buildCandidatePaths(basePath) {
  const candidates = [basePath];
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  extensions.forEach((ext) => {
    candidates.push(`${basePath}${ext}`);
  });

  candidates.push(path.join(basePath, 'index.ts'));
  candidates.push(path.join(basePath, 'index.tsx'));
  candidates.push(path.join(basePath, 'index.js'));
  candidates.push(path.join(basePath, 'index.jsx'));

  return candidates;
}

function moduleExists(workspacePath, targetPath) {
  return resolveImportPath(workspacePath, targetPath).some((candidate) => fs.existsSync(candidate));
}

function validateBackendIntegration(phaseDef, qualityGate) {
  const baseDir = process.cwd();
  const manifestPath = path.join(baseDir, 'reference', 'backend-task-list.json');

  if (!fs.existsSync(manifestPath)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('reference/backend-task-list.json not found');
    return qualityGate;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push(`Manifest parsing error: ${error.message}`);
    return qualityGate;
  }

  // Determine workspace path - check for src/ directory (single app structure)
  let workspacePath = baseDir;
  if (!fs.existsSync(path.join(baseDir, 'src'))) {
    workspacePath = path.join(baseDir, 'workspace');
    if (!fs.existsSync(path.join(workspacePath, 'src'))) {
      qualityGate.passed = false;
      qualityGate.criticalFailures.push('src directory not found');
      return qualityGate;
    }
  }

  const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
  const completedTasks = tasks.filter((task) => (task.status || '').toLowerCase() === STATUS.COMPLETED);
  const inProgressTasks = tasks.filter((task) => (task.status || '').toLowerCase() === STATUS.IN_PROGRESS);

  const dependencyIssues = [];
  const modelIssues = [];
  const actionIssues = [];
  const fetcherIssues = [];
  const jobIssues = [];

  const taskIndex = new Map(tasks.map((task) => [task.id, task]));

  // Check task dependencies
  completedTasks.forEach((task) => {
    (task.dependencies || []).forEach((depId) => {
      const dependency = taskIndex.get(depId);
      if (!dependency || (dependency.status || '').toLowerCase() !== STATUS.COMPLETED) {
        dependencyIssues.push(`${task.id} depends on ${depId} which is not completed.`);
      }
    });
  });

  // Check Prisma schema for models (single-app structure has prisma/ at root)
  const schemaPath = path.join(workspacePath, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    modelIssues.push('Prisma schema file not found at prisma/schema.prisma');
  }

  // Check backend components for completed and in-progress tasks
  const tasksToCheck = [...completedTasks, ...inProgressTasks];

  tasksToCheck.forEach((task) => {
    // Check actions
    if (Array.isArray(task.actions)) {
      task.actions.forEach((action) => {
        if (action.path && !moduleExists(workspacePath, action.path)) {
          actionIssues.push(`${task.id}: Action ${action.name} missing at ${action.path}`);
        }
        if (action.schemaPath && !moduleExists(workspacePath, action.schemaPath)) {
          actionIssues.push(`${task.id}: Schema for ${action.name} missing at ${action.schemaPath}`);
        }
      });
    }

    // Check data fetchers
    if (Array.isArray(task.dataFetchers)) {
      task.dataFetchers.forEach((fetcher) => {
        if (fetcher.path && !moduleExists(workspacePath, fetcher.path)) {
          fetcherIssues.push(`${task.id}: Data fetcher ${fetcher.name} missing at ${fetcher.path}`);
        }
      });
    }

    // Check background jobs
    if (Array.isArray(task.backgroundJobs)) {
      task.backgroundJobs.forEach((job) => {
        if (job.path && !moduleExists(workspacePath, job.path)) {
          jobIssues.push(`${task.id}: Background job ${job.name} missing at ${job.path}`);
        }
      });
    }
  });

  // Check for remaining mock implementations in data layer
  const mockIssues = [];
  const dataDir = path.join(workspacePath, 'src', 'data');

  function findMocks(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && item.name !== 'fixtures') {
          findMocks(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('// MOCK:')) {
              mockIssues.push(`Mock implementation remains: ${fullPath.replace(workspacePath + '/', '')}`);
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      });
    } catch (e) {
      // Skip directories that can't be read
    }
  }
  findMocks(dataDir);

  // Check for TODO stubs that return fake success (workflow wiring bugs)
  const todoStubIssues = [];

  function findTodoStubs(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !['node_modules', 'fixtures', '.next'].includes(item.name)) {
          findTodoStubs(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Pattern 1: TODO/FIXME comment within 2000 chars of a success return (covers most function bodies)
            const todoSuccessPattern = /(TODO|FIXME)[\s\S]{0,2000}(success:\s*true|return\s*\{[^}]*success)/gi;
            
            // Pattern 2: "will be handled by" or "would" patterns - common stub language
            const stubLanguagePattern = /\/\/\s*(TODO|FIXME)?[^\n]*(will be handled|would be|should be|needs to be|later|not yet|placeholder|stub)/i;
            const hasStubLanguage = stubLanguagePattern.test(content);
            const hasSuccessReturn = /return\s*\{[^}]*success:\s*true/i.test(content);
            
            // Pattern 3: Function returns success but has no prisma calls in the entire file
            // (less strict than before - only checks prisma, not all await)
            const hasNoPrismaCall = !content.includes('prisma.');
            
            if (todoSuccessPattern.test(content)) {
              todoStubIssues.push(`TODO stub returning fake success: ${fullPath.replace(workspacePath + '/', '')}`);
            } else if (hasStubLanguage && hasSuccessReturn && hasNoPrismaCall) {
              // Secondary check: stub language + success return + no Prisma = likely stub
              todoStubIssues.push(`Possible stub (returns success without Prisma operations): ${fullPath.replace(workspacePath + '/', '')}`);
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      });
    } catch (e) {
      // Skip directories that can't be read
    }
  }

  // Run TODO stub check on actions, data, lib, and app directories
  findTodoStubs(path.join(workspacePath, 'src', 'actions'));
  findTodoStubs(path.join(workspacePath, 'src', 'data'));
  findTodoStubs(path.join(workspacePath, 'src', 'lib'));
  findTodoStubs(path.join(workspacePath, 'src', 'app'));

  if (todoStubIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...todoStubIssues);
    qualityGate.criticalFailures.push('TODO stubs returning fake success - these must be fully implemented');
  }

  // Check for remaining placeholder URLs
  const placeholderPatterns = ['picsum.photos', 'placeholder.com', 'via.placeholder', 'placehold.co'];
  const placeholderIssues = [];

  function findPlaceholderUrls(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !['node_modules', 'fixtures', '.next'].includes(item.name)) {
          findPlaceholderUrls(fullPath);
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            placeholderPatterns.forEach(pattern => {
              if (content.includes(pattern)) {
                placeholderIssues.push(`Placeholder URL "${pattern}" in: ${fullPath.replace(workspacePath + '/', '')}`);
              }
            });
          } catch (e) {
            // Skip files that can't be read
          }
        }
      });
    } catch (e) {
      // Skip directories that can't be read
    }
  }

  // Check data layer and lib for placeholder URLs
  findPlaceholderUrls(path.join(workspacePath, 'src', 'data'));
  findPlaceholderUrls(path.join(workspacePath, 'src', 'lib'));
  findPlaceholderUrls(path.join(workspacePath, 'prisma'));

  if (placeholderIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...placeholderIssues);
    qualityGate.criticalFailures.push('Placeholder URLs remain - backend must replace these');
  }

  // Check next.config.ts has supabase if storage is used
  const nextConfigPath = path.join(workspacePath, 'next.config.ts');
  const storageUsed = fs.existsSync(path.join(workspacePath, 'src', 'lib', 'storage.ts'));

  if (storageUsed && fs.existsSync(nextConfigPath)) {
    try {
      const config = fs.readFileSync(nextConfigPath, 'utf8');
      if (!config.includes('supabase')) {
        qualityGate.passed = false;
        qualityGate.reasons.push('Storage is used but next.config.ts missing supabase in remotePatterns');
      }
    } catch (e) {
      // Skip if can't read config
    }
  }

  // Check storage bucket configuration matches guidelines
  const storagePaths = [
    path.join(workspacePath, 'src', 'lib', 'storage.ts'),
    path.join(workspacePath, 'src', 'lib', 'storage', 'index.ts'),
    path.join(workspacePath, 'src', 'lib', 'storage', 'supabaseStorage.ts')
  ];
  const expectedBucket = 'samus-storage';

  for (const storagePath of storagePaths) {
    if (fs.existsSync(storagePath)) {
      try {
        const content = fs.readFileSync(storagePath, 'utf8');
        // Look for bucket constant definitions
        const bucketMatch = content.match(/(?:BUCKET|bucket)\s*[:=]\s*['"]([^'"]+)['"]/i);
        if (bucketMatch && bucketMatch[1] !== expectedBucket) {
          qualityGate.passed = false;
          qualityGate.reasons.push(
            `Storage bucket mismatch: found '${bucketMatch[1]}' but expected '${expectedBucket}' in ${storagePath.replace(workspacePath + '/', '')}`
          );
        }
      } catch (e) {
        // Skip if can't read
      }
    }
  }

  // Check for API routes that might be missing userId wiring
  const userIdWiringIssues = [];
  const apiDir = path.join(workspacePath, 'src', 'app', 'api');

  function checkApiRouteUserIdWiring(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          checkApiRouteUserIdWiring(fullPath);
        } else if (item.name === 'route.ts' || item.name === 'route.tsx') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Check if route calls a function with userId parameter but doesn't extract from session
            const callsWithUserId = content.match(/\w+\([^)]*userId[^)]*\)/g) || [];
            const hasAuthImport = content.includes('auth()') || content.includes('getServerSession');
            const extractsUserId = /session\??\.\s*user\??\.\s*id/.test(content) || /userId\s*=/.test(content);
            
            if (callsWithUserId.length > 0 && hasAuthImport && !extractsUserId) {
              userIdWiringIssues.push(`API route may be missing userId extraction: ${fullPath.replace(workspacePath + '/', '')}`);
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      });
    } catch (e) {
      // Skip directories that can't be read
    }
  }
  checkApiRouteUserIdWiring(apiDir);

  if (userIdWiringIssues.length > 0) {
    // Warning only - don't fail the gate, but report for manual review
    qualityGate.reasons.push(...userIdWiringIssues.map(i => `⚠️ ${i}`));
  }

  // Add issues to reasons
  if (dependencyIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...dependencyIssues);
  }

  if (modelIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...modelIssues);
  }

  if (actionIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...actionIssues);
  }

  if (fetcherIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...fetcherIssues);
  }

  if (jobIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...jobIssues);
  }

  if (mockIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...mockIssues);
  }

  if (inProgressTasks.length > 1) {
    qualityGate.passed = false;
    qualityGate.reasons.push(`Multiple backend tasks marked in progress: ${inProgressTasks.map((t) => t.id).join(', ')}`);
  }

  // Calculate scores
  const dependencyScore = tasks.length > 0
    ? Math.max(0, (tasks.length - dependencyIssues.length) / tasks.length)
    : 1;

  const modelsScore = modelIssues.length === 0 ? 1 : 0;

  const actionsScore = tasksToCheck.reduce((total, task) => {
    const taskActions = task.actions || [];
    return total + taskActions.length;
  }, 0) > 0
    ? Math.max(0, 1 - (actionIssues.length * 0.1))
    : 1;

  const fetchersScore = tasksToCheck.reduce((total, task) => {
    const taskFetchers = task.dataFetchers || [];
    return total + taskFetchers.length;
  }, 0) > 0
    ? Math.max(0, 1 - (fetcherIssues.length * 0.1))
    : 1;

  const jobsScore = tasksToCheck.reduce((total, task) => {
    const taskJobs = task.backgroundJobs || [];
    return total + taskJobs.length;
  }, 0) > 0
    ? Math.max(0, 1 - (jobIssues.length * 0.1))
    : 1;

  const workflowScore = Math.max(0, 1 - Math.max(0, inProgressTasks.length - 1) * 0.25);

  const dataLayerScore = mockIssues.length === 0 ? 1 : Math.max(0, 1 - (mockIssues.length * 0.2));

  const placeholderScore = placeholderIssues.length === 0 ? 1 : 0;

  // TODO stubs returning fake success are critical - instant fail
  const todoStubsScore = todoStubIssues.length === 0 ? 1 : 0;

  qualityGate.criteria_scores = {
    dependencies: Number(dependencyScore.toFixed(2)),
    models: Number(modelsScore.toFixed(2)),
    actions: Number(actionsScore.toFixed(2)),
    dataFetchers: Number(fetchersScore.toFixed(2)),
    backgroundJobs: Number(jobsScore.toFixed(2)),
    workflow: Number(workflowScore.toFixed(2)),
    dataLayerIntegration: Number(dataLayerScore.toFixed(2)),
    placeholderUrls: Number(placeholderScore.toFixed(2)),
    todoStubs: Number(todoStubsScore.toFixed(2))
  };

  qualityGate.score = Number(
    ((dependencyScore + modelsScore + actionsScore + fetchersScore + jobsScore + workflowScore + dataLayerScore + placeholderScore + todoStubsScore) / 9).toFixed(2)
  );

  if (qualityGate.passed) {
    qualityGate.reasons.push(`Backend integration consistent: ${completedTasks.length} completed, ${inProgressTasks.length} in progress.`);
  }

  // Add structured retry context for better retry feedback
  if (!qualityGate.passed) {
    qualityGate.retryContext = {
      stage: 'backend_integration',
      dependencyIssues: dependencyIssues.slice(0, 10),
      modelIssues: modelIssues.slice(0, 10),
      actionIssues: actionIssues.slice(0, 10),
      fetcherIssues: fetcherIssues.slice(0, 10),
      jobIssues: jobIssues.slice(0, 10),
      mockIssues: mockIssues.slice(0, 10),
      todoStubIssues: todoStubIssues.slice(0, 10),
      placeholderIssues: placeholderIssues.slice(0, 10)
    };
  }

  return qualityGate;
}

if (require.main === module) {
  try {
    const phaseDef = JSON.parse(process.argv[2] || '{}');
    const qualityGate = {
      passed: true,
      reasons: [],
      score: 0,
      retryRecommended: false,
      criticalFailures: [],
      criteria_scores: {}
    };

    const result = validateBackendIntegration(phaseDef, qualityGate);

    console.log(JSON.stringify(result, null, 2));

    if (!result.passed) {
      process.exit(1);
    }
  } catch (error) {
    const result = {
      passed: false,
      reasons: [`Gate execution error: ${error.message}`],
      score: 0,
      retryRecommended: false,
      criticalFailures: [`Validation error: ${error.message}`]
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

module.exports = { validateBackendIntegration };

