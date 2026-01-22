/**
 * Phase Executor Module
 * Handles phase execution, command building, and process management
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PhaseExecutor {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.namespace = options.namespace || 'cfbuild-detached';
    this.debugLogger = options.debugLogger || null;
  }

  prepareChildEnv() {
    const env = { ...process.env };
    const workspaceRoot = this.workingDirectory || process.cwd();
    env.CFBUILD_WORKSPACE_ROOT = workspaceRoot;

    try {
      const hookCandidates = [
        path.join(workspaceRoot, 'backpack', 'lib', 'claude-flow-spawn-logger.js'),
        path.join(workspaceRoot, 'lib', 'claude-flow-spawn-logger.js')
      ];

      const hookPath = hookCandidates.find((candidate) => {
        try {
          return fs.existsSync(candidate);
        } catch (_) {
          return false;
        }
      });

      if (hookPath) {
        const requireFlag = `--require ${hookPath}`;
        const existing = env.NODE_OPTIONS || '';
        if (!existing.includes(requireFlag)) {
          env.NODE_OPTIONS = existing ? `${existing} ${requireFlag}`.trim() : requireFlag;
          this.debugLogger?.log('phase-exec', 'spawn-hook-injected', {
            hookPath: path.relative(workspaceRoot, hookPath),
            nodeOptions: env.NODE_OPTIONS
          });
        }
      } else {
        this.debugLogger?.log('phase-exec', 'spawn-hook-missing', {
          workspaceRoot
        });
      }
    } catch (error) {
      this.debugLogger?.log('phase-exec', 'spawn-hook-error', {
        message: error?.message || 'unknown-error'
      });
    }

    return env;
  }

  formatCommandLine(command, args = []) {
    const quoteIfNeeded = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'string') return String(value);
      if (value === '') return "''";
      if (/[^A-Za-z0-9_\-./]/.test(value)) {
        return `'${value.replace(/'/g, `'"'"'`)}'`;
      }
      return value;
    };

    const parts = [quoteIfNeeded(command), ...args.map(quoteIfNeeded)].filter(Boolean);
    return parts.join(' ').trim();
  }
  
  /**
   * Build command array from mode configuration with template substitution
   */
  buildCommand(modeConfig, phaseDef, promptContent = null) {
    if (!modeConfig) {
      throw new Error('Mode configuration is required');
    }
    
    let tempPromptFile = null;
    
    // Handle tempfile prompt format - write prompt to temp file in .tmp/
    if (modeConfig.promptFormat === 'tempfile' && promptContent) {
      const tmpDir = path.join(this.workingDirectory, '.tmp');
      
      // Ensure .tmp directory exists
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      // Create temp file with timestamp to avoid conflicts
      const timestamp = Date.now();
      const phaseId = phaseDef.id || 'unknown';
      tempPromptFile = path.join(tmpDir, `${phaseId}-prompt-${timestamp}.txt`);
      
      // Write prompt content to temp file
      fs.writeFileSync(tempPromptFile, promptContent, 'utf8');
    }
    
    let scriptFilePath = null;
    if (phaseDef.scriptFile) {
      scriptFilePath = path.resolve(this.workingDirectory, phaseDef.scriptFile);
    } else if (phaseDef.promptFile && path.extname(phaseDef.promptFile) === '.js') {
      scriptFilePath = path.resolve(this.workingDirectory, phaseDef.promptFile);
    }

    const templateContext = {
      sparcMode: phaseDef.sparcMode || 'architect',
      namespace: this.namespace,
      scriptFile: scriptFilePath,
      taskDescription: promptContent || phaseDef.description || phaseDef.name || 'Execute task',
      tempPromptFile: tempPromptFile || ''
    };
    
    // Build command components
    let command = modeConfig.command;
    let args = [];
    
    // Add package if specified (for npx commands)
    if (modeConfig.package) {
      args.push(modeConfig.package);
    }
    
    // Add configured args with template substitution
    if (modeConfig.args) {
      for (const arg of modeConfig.args) {
        args.push(this.substituteTemplateVariables(arg, templateContext));
      }
    }

    // REMOVED: The "Read and follow..." replacement logic
    // This was causing gates to fail because Claude doesn't automatically read files
    // Instead, we now use the pipe approach in kickOffPhase and executeGate
    // which properly sends file content through stdin, avoiding E2BIG errors
    
    // Add configured flags with template substitution
    if (modeConfig.flags) {
      for (const flag of modeConfig.flags) {
        args.push(this.substituteTemplateVariables(flag, templateContext));
      }
    }
    
    if (this.debugLogger?.isEnabled?.()) {
      this.debugLogger.log('phase-exec', 'build-command', {
        phaseId: phaseDef?.id,
        command,
        args,
        tempPromptFile,
        promptFormat: modeConfig.promptFormat || 'none'
      });
    }

    // Return command info including temp file for cleanup
    return {
      command,
      args,
      promptContent,
      tempPromptFile
    };
  }
  
  /**
   * Substitute template variables in strings
   */
  substituteTemplateVariables(template, context) {
    if (typeof template !== 'string') return template;
    
    let result = template;
    for (const [key, value] of Object.entries(context)) {
      if (value !== null && value !== undefined) {
        const pattern = new RegExp(`\{${key}\}`, 'g');
        result = result.replace(pattern, String(value));
      }
    }
    return result;
  }
  
  /**
   * Substitute template variables in phase content
   */
  substituteTemplate(content, subcomponent, component, buildTargets) {
    // Replace template variables with actual values
    let substituted = content;
    
    // Handle buildTargets for frontend phases
    if (buildTargets) {
      const targetsString = JSON.stringify(buildTargets, null, 2);
      substituted = substituted.replace(/\{\{buildTargets\}\}/g, targetsString);
    }
    
    // Replace subcomponent variables (if present)
    if (subcomponent) {
      substituted = substituted.replace(/\{\{subcomponent\.id\}\}/g, subcomponent.id);
      substituted = substituted.replace(/\{\{subcomponent\.name\}\}/g, subcomponent.name);
      substituted = substituted.replace(/\{\{subcomponent\.description\}\}/g, subcomponent.description || '');
      substituted = substituted.replace(/\{\{subcomponent\.estimatedStories\}\}/g, subcomponent.estimatedStories || 2);
      substituted = substituted.replace(/\{\{subcomponent\.tracesTo\}\}/g, (subcomponent.tracesTo || []).join(', '));
    }
    
    // Replace component variables (if present)
    if (component) {
      substituted = substituted.replace(/\{\{component\.id\}\}/g, component.id);
      substituted = substituted.replace(/\{\{component\.name\}\}/g, component.name);
      substituted = substituted.replace(/\{\{component\.description\}\}/g, component.description || '');
      substituted = substituted.replace(/\{\{component\.index\}\}/g, component.index || '01');
    }
    
    return substituted;
  }

  applyBuildUnitTemplate(content, buildUnit) {
    if (!buildUnit) {
      return content;
    }

    let result = content;

    const replaceToken = (token, value, fallback = 'n/a') => {
      const safe = value !== undefined && value !== null && value !== '' ? String(value) : fallback;
      const pattern = new RegExp(`\{\{${token}\}\}`, 'g');
      result = result.replace(pattern, () => safe);
    };

    const formatList = (items, options = {}) => {
      const { bullet = '- ', emptyLabel = 'None recorded in manifest' } = options;
      if (!Array.isArray(items) || items.length === 0) {
        return `${bullet}${emptyLabel}`;
      }
      return items.map(item => `${bullet}${item}`).join('\n');
    };

    const phase = buildUnit.phase || null;
    const phaseLabel = phase
      ? `Order ${phase.order ?? '?'} • ${phase.name || 'Unnamed Phase'}`
      : 'Not listed in execution plan';
    const phasePosition = phase
      ? `${phase.indexInPhase || 1}/${phase.totalInPhase || phase.indexInPhase || 1}`
      : 'n/a';
    const phaseEstimate = (phase && phase.estimatedHours !== undefined && phase.estimatedHours !== null)
      ? `${phase.estimatedHours}h`
      : 'n/a';
    const dependenciesString = Array.isArray(buildUnit.dependencies) && buildUnit.dependencies.length > 0
      ? buildUnit.dependencies.join(', ')
      : 'None';

    replaceToken('BUILD_UNIT_NAME', buildUnit.title || buildUnit.id);
    replaceToken('BUILD_UNIT_ID', buildUnit.id || 'n/a');
    replaceToken('BUILD_UNIT_TYPE', buildUnit.type || 'unspecified');
    replaceToken('BUILD_UNIT_STATUS', buildUnit.status || 'pending');
    replaceToken('BUILD_UNIT_LAST_UPDATED', buildUnit.lastUpdated || 'Not recorded');
    replaceToken('BUILD_UNIT_SEQUENCE', buildUnit.sequence != null ? String(buildUnit.sequence) : 'n/a');
    replaceToken('BUILD_UNIT_FRONTEND_TOTAL', buildUnit.frontendTotal != null ? buildUnit.frontendTotal : 'n/a');
    replaceToken('BUILD_UNIT_FRONTEND_COMPLETED', buildUnit.frontendCompleted != null ? buildUnit.frontendCompleted : '0');
    replaceToken('BUILD_UNIT_BACKEND_TOTAL', buildUnit.backendTotal != null ? buildUnit.backendTotal : 'n/a');
    replaceToken('BUILD_UNIT_PHASE_LABEL', phaseLabel);
    replaceToken('BUILD_UNIT_PHASE_NAME', phase?.name || 'n/a');
    replaceToken('BUILD_UNIT_PHASE_ORDER', phase?.order != null ? String(phase.order) : 'n/a');
    replaceToken('BUILD_UNIT_PHASE_POSITION', phasePosition);
    replaceToken('BUILD_UNIT_PHASE_ESTIMATE', phaseEstimate);
    replaceToken('BUILD_UNIT_PHASE_RATIONALE', phase?.rationale || 'No rationale provided in manifest.');
    replaceToken('BUILD_UNIT_DEPENDENCIES', dependenciesString, 'None');
    replaceToken('BUILD_UNIT_DESCRIPTION', buildUnit.description || 'No description provided.');
    
    // Checklist remediation tokens (phase-3-2, phase-7-3)
    replaceToken('BUILD_UNIT_TITLE', buildUnit.title || buildUnit.id || 'Untitled');
    replaceToken('BUILD_UNIT_CATEGORY', buildUnit.category || 'general');
    replaceToken('BUILD_UNIT_TOTAL_ITEMS', buildUnit.totalItems != null ? String(buildUnit.totalItems) : 'n/a');
    replaceToken('BUILD_UNIT_DETAILS', buildUnit.details || 'No details provided.');
    
    // Validation can be an object - stringify it for display
    const validationContent = buildUnit.validation 
      ? (typeof buildUnit.validation === 'object' ? JSON.stringify(buildUnit.validation, null, 2) : String(buildUnit.validation))
      : 'No validation criteria specified.';
    replaceToken('BUILD_UNIT_VALIDATION', validationContent);
    
    // Backend-specific tokens
    replaceToken('BUILD_UNIT_BACKEND_COMPLETED', buildUnit.backendCompleted != null ? buildUnit.backendCompleted : '0');
    
    const tracesToList = Array.isArray(buildUnit.tracesTo) && buildUnit.tracesTo.length > 0
      ? buildUnit.tracesTo.join(', ')
      : 'None';
    replaceToken('BUILD_UNIT_TRACES_TO', tracesToList);

    // Frontend handoff notes for backend tasks
    const handoffNotes = buildUnit.handoffNotes || '';
    const handoffSection = handoffNotes 
      ? `## Frontend Handoff Notes\n${handoffNotes}\n`
      : '';
    result = result.replace(/\{\{BUILD_UNIT_HANDOFF_NOTES_SECTION\}\}/g, () => handoffSection);

    const acceptanceList = formatList(buildUnit.acceptanceCriteria, { emptyLabel: 'None recorded in manifest' });
    result = result.replace(/\{\{BUILD_UNIT_ACCEPTANCE_CRITERIA\}\}/g, () => acceptanceList);

    const prdList = Array.isArray(buildUnit.prdReferences) && buildUnit.prdReferences.length > 0
      ? buildUnit.prdReferences.map(ref => `- \`${ref}\``).join('\n')
      : '- None recorded (review manifest entry)';
    result = result.replace(/\{\{BUILD_UNIT_PRD_SOURCES\}\}/g, () => prdList);

    const uiDeps = Array.isArray(buildUnit.uiDependencies) ? buildUnit.uiDependencies : [];
    const uiDepsSection = uiDeps.length > 0
      ? `## 💡 Suggested Components\nThese shadcn components were flagged as potentially useful. Use them if helpful, or use plain HTML/Tailwind if simpler.\n\n${uiDeps.map(dep => {
          const header = `- ${dep.component || 'component TBD'}${dep.targetPath ? ` → \`${dep.targetPath}\`` : ''}`;
          const details = [];
          if (dep.docsUrl) details.push(`  - Docs: ${dep.docsUrl}`);
          if (dep.notes) details.push(`  - Notes: ${dep.notes}`);
          return [header, ...details].join('\n');
        }).join('\n')}\n> Run \`context7 libs resolve shadcn/ui\` and \`context7 docs shadcn/ui components/<slug>\` before implementing each dependency. Reuse existing workspace patterns.\n\n`
      : '';
    result = result.replace(/\{\{BUILD_UNIT_UI_DEPENDENCIES_SECTION\}\}/g, () => uiDepsSection);

    const subtasks = Array.isArray(buildUnit.subtasks) ? buildUnit.subtasks : [];
    const subtasksSection = subtasks.length > 0
      ? `## 🔧 Subtasks\n${subtasks.map(sub => {
          const prefix = sub.id ? `[${sub.id}] ` : '';
          const estimate = sub.estimatedHours != null ? ` (est ${sub.estimatedHours}h)` : '';
          return `- ${prefix}${sub.description || 'Detail not specified'}${estimate}`;
        }).join('\n')}\n\n`
      : '';
    result = result.replace(/\{\{BUILD_UNIT_SUBTASKS_SECTION\}\}/g, () => subtasksSection);

    const devtoolsStep = buildUnit.shouldUseDevtools
      ? `## 5. UI Verification (Required for UI Tasks)

Use Chrome DevTools MCP to validate the UI you just built:

1. Navigate to app: \`navigate_page({ type: "url", url: "http://localhost:3000", timeout: 30000 })\`
2. If on sign-in page, authenticate via API (form fill doesn't work with React):
   \`\`\`javascript
   evaluate_script({ function: \`async () => {
     const csrf = await fetch('/api/auth/csrf').then(r => r.json());
     await fetch('/api/auth/callback/credentials', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: 'test@samus.ai', password: '12345', json: 'true' })
     });
     window.location.href = '/dashboard';
   }\` })
   \`\`\`
3. Navigate to your page: \`navigate_page({ type: "url", url: "http://localhost:3000/[your-route]", timeout: 30000 })\`
4. Snapshot: \`take_snapshot({ verbose: false })\`
5. Screenshot: \`take_screenshot({ format: "jpeg", quality: 80 })\`
6. Check console errors: \`list_console_messages({ types: ["error"], pageSize: 10 })\`
7. Check network failures: \`list_network_requests({ resourceTypes: ["xhr", "fetch"], pageSize: 10 })\`

Fix any visual issues or console errors before proceeding.

`
      : '';
    result = result.replace(/\{\{BUILD_UNIT_DEVTOOLS_STEP\}\}/g, () => devtoolsStep);
    
    // Backend-specific sections for models, actions, dataFetchers, backgroundJobs
    const models = Array.isArray(buildUnit.models) ? buildUnit.models : [];
    const modelsSection = models.length > 0
      ? models.map(model => {
          const header = `### Model: ${model.name || 'Unnamed'} (${model.operation || 'create'})`;
          const buildOrder = model.buildOrder != null ? `- **Build Order**: ${model.buildOrder}` : '';
          const relationships = model.relationships ? `- **Relationships**: ${model.relationships}` : '';
          const criteria = Array.isArray(model.acceptanceCriteria) && model.acceptanceCriteria.length > 0
            ? `**Acceptance Criteria**:\n${model.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`
            : '';
          return [header, buildOrder, relationships, criteria].filter(Boolean).join('\n');
        }).join('\n\n')
      : '';
    result = result.replace(/\{\{BUILD_UNIT_MODELS_SECTION\}\}/g, () => modelsSection);
    
    const actions = Array.isArray(buildUnit.actions) ? buildUnit.actions : [];
    const actionsSection = actions.length > 0
      ? actions.map(action => {
          const header = `### Action: ${action.name || 'Unnamed'}`;
          const path = action.path ? `- **Path**: \`${action.path}\`` : '';
          const schemaPath = action.schemaPath ? `- **Schema**: \`${action.schemaPath}\`` : '';
          const client = action.client ? `- **Client**: \`${action.client}\`` : '';
          const buildOrder = action.buildOrder != null ? `- **Build Order**: ${action.buildOrder}` : '';
          const cacheInv = action.cacheInvalidation ? `- **Cache Invalidation**: ${action.cacheInvalidation}` : '';
          const criteria = Array.isArray(action.acceptanceCriteria) && action.acceptanceCriteria.length > 0
            ? `**Acceptance Criteria**:\n${action.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`
            : '';
          return [header, path, schemaPath, client, buildOrder, cacheInv, criteria].filter(Boolean).join('\n');
        }).join('\n\n')
      : '';
    result = result.replace(/\{\{BUILD_UNIT_ACTIONS_SECTION\}\}/g, () => actionsSection);
    
    const dataFetchers = Array.isArray(buildUnit.dataFetchers) ? buildUnit.dataFetchers : [];
    const fetchersSection = dataFetchers.length > 0
      ? dataFetchers.map(fetcher => {
          const header = `### Data Fetcher: ${fetcher.name || 'Unnamed'}`;
          const path = fetcher.path ? `- **Path**: \`${fetcher.path}\`` : '';
          const cacheKey = fetcher.cacheKey ? `- **Cache Key**: \`${fetcher.cacheKey}\`` : '';
          const cacheScope = fetcher.cacheScope ? `- **Cache Scope**: \`${fetcher.cacheScope}\`` : '';
          const buildOrder = fetcher.buildOrder != null ? `- **Build Order**: ${fetcher.buildOrder}` : '';
          const criteria = Array.isArray(fetcher.acceptanceCriteria) && fetcher.acceptanceCriteria.length > 0
            ? `**Acceptance Criteria**:\n${fetcher.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`
            : '';
          return [header, path, cacheKey, cacheScope, buildOrder, criteria].filter(Boolean).join('\n');
        }).join('\n\n')
      : '';
    result = result.replace(/\{\{BUILD_UNIT_FETCHERS_SECTION\}\}/g, () => fetchersSection);
    
    const backgroundJobs = Array.isArray(buildUnit.backgroundJobs) ? buildUnit.backgroundJobs : [];
    const jobsSection = backgroundJobs.length > 0
      ? backgroundJobs.map(job => {
          const header = `### Background Job: ${job.name || 'Unnamed'}`;
          const path = job.path ? `- **Path**: \`${job.path}\`` : '';
          const trigger = job.trigger ? `- **Trigger**: \`${job.trigger}\`` : '';
          const buildOrder = job.buildOrder != null ? `- **Build Order**: ${job.buildOrder}` : '';
          const criteria = Array.isArray(job.acceptanceCriteria) && job.acceptanceCriteria.length > 0
            ? `**Acceptance Criteria**:\n${job.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`
            : '';
          return [header, path, trigger, buildOrder, criteria].filter(Boolean).join('\n');
        }).join('\n\n')
      : '';
    result = result.replace(/\{\{BUILD_UNIT_JOBS_SECTION\}\}/g, () => jobsSection);

    const jsonSource = JSON.stringify(buildUnit.raw || buildUnit, null, 2);
    result = result.replace(/\{\{BUILD_UNIT_JSON\}\}/g, () => jsonSource);

    // Inject E2E test contract if test file exists (TDD: builder sees tests to fulfill)
    // Frontend tests: {task-id}.spec.ts, Backend tests: be-{task-id}.spec.ts
    const isBackend = buildUnit.type === 'backend' || buildUnit.id?.startsWith('be-');
    const testFileName = isBackend ? `be-${buildUnit.id}.spec.ts` : `${buildUnit.id}.spec.ts`;
    const testFilePath = path.join(this.workingDirectory, 'tests', 'e2e', 'generated', testFileName);
    let testContractSection = '';
    if (fs.existsSync(testFilePath)) {
      try {
        const testContent = fs.readFileSync(testFilePath, 'utf8');
        const guidance = isBackend
          ? '> **CRITICAL**: Ensure your API responses and data structures match what these tests expect. The gate will run these tests after your implementation.'
          : '> **CRITICAL**: Ensure your components include the `data-testid` attributes expected by these tests. The gate will run these tests after your implementation.';
        testContractSection = `## 🧪 E2E Test Contract (TDD)

Your implementation must pass the following Playwright tests.

**Test file**: \`tests/e2e/generated/${testFileName}\`

\`\`\`typescript
${testContent}
\`\`\`

${guidance}

`;
      } catch (e) {
        // Test file exists but couldn't be read - skip silently
      }
    }
    result = result.replace(/\{\{BUILD_UNIT_E2E_TEST_CONTRACT\}\}/g, () => testContractSection);

    return result;
  }
  
  /**
   * Inject PRD context from context map
   * Conditionally injects guideline docs and boilerplate docs per context map
   * Claude uses tools to read specific PRD files as needed
   */
  /**
   * Inject dynamic content into phase prompts by replacing placeholders
   */
  injectDynamicContent(phaseContent, phaseDef) {
    try {
      let content = phaseContent;
      
      // Inject workspace structure information
      if (content.includes('{{WORKSPACE_STRUCTURE}}')) {
        let workspaceInfo = `## 🏗️ Workspace Structure\n\n`;
        workspaceInfo += `**Type**: Next.js Platform Starter\n`;
        
        // Check for UI components location
        const uiPath = 'src/components/ui';
        if (fs.existsSync(path.join(this.workingDirectory, uiPath))) {
          workspaceInfo += `**UI Components Location**: ${uiPath}\n`;
          workspaceInfo += `**UI Import Pattern**: @/components/ui/<component>\n`;
        }
        
        // List directories present
        workspaceInfo += `\n**Directory Structure**:\n`;
        if (fs.existsSync(path.join(this.workingDirectory, 'src'))) {
          workspaceInfo += `- ✅ src/ (application code)\n`;
        }
        if (fs.existsSync(path.join(this.workingDirectory, 'prisma'))) {
          workspaceInfo += `- ✅ prisma/ (database schema)\n`;
        }
        
        // Check for shadcn config
        if (fs.existsSync(path.join(this.workingDirectory, 'components.json'))) {
          workspaceInfo += `\n**Shadcn Config**: components.json\n`;
        }
        
        content = content.replace(/\{\{WORKSPACE_STRUCTURE\}\}/g, workspaceInfo);
      }
      
      // Smart injection of phase-specific context from prd-context-map.json
      if (content.includes('{{PRD_CONTEXT}}')) {
        const mapPath = path.join(this.workingDirectory, 'reference', 'prd-context-map.json');
        if (fs.existsSync(mapPath)) {
          const contextMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
          const contextPhaseIds = Array.isArray(phaseDef.contextPhaseId) 
            ? phaseDef.contextPhaseId 
            : [phaseDef.contextPhaseId || phaseDef.id];
          
          // Build phase-specific context
          let phaseContext = `## 📍 Context for This Phase\n\n`;
          
          // Find the first phase config with categories or references
          let phaseConfig = null;
          for (const phaseId of contextPhaseIds) {
            const config = contextMap.phases?.[phaseId];
            if (config?.categories || config?.prd_reference || config?.reference) {
              phaseConfig = config;
              break;
            }
          }
          const requestedSections = Array.isArray(phaseDef.contextSections) && phaseDef.contextSections.length > 0
            ? new Set(phaseDef.contextSections)
            : null;

          if (phaseConfig?.categories) {
            let sectionsAdded = 0;
            const includeReadFirst = !requestedSections || requestedSections.has('read_first');
            const includePhaseContext = !requestedSections || requestedSections.has('phase_context');
            const includeGateContext = !requestedSections || requestedSections.has('gate_context');

            if (includeReadFirst && phaseConfig.categories.read_first?.length > 0) {
              phaseContext += `### Read First\n`;
              phaseContext += `Review these files before starting any work:\n\n`;
              for (const file of phaseConfig.categories.read_first) {
                phaseContext += `- \`${file}\`\n`;
              }
              phaseContext += `\n`;
              sectionsAdded++;
            }

            if (includePhaseContext && phaseConfig.categories.phase_context?.length > 0) {
              phaseContext += `### Implementation Context\n`;
              phaseContext += `Reference these while working (fetch relevant sections when needed):\n\n`;
              for (const file of phaseConfig.categories.phase_context) {
                phaseContext += `- \`${file}\`\n`;
              }
              phaseContext += `\n`;
              sectionsAdded++;
            }

            if (includeGateContext && phaseConfig.categories.gate_context?.length > 0) {
              phaseContext += `### Gate Context\n`;
              phaseContext += `Reference these for validation and coverage checks:\n\n`;
              for (const file of phaseConfig.categories.gate_context) {
                phaseContext += `- \`${file}\`\n`;
              }
              phaseContext += `\n`;
              sectionsAdded++;
            }

            if (sectionsAdded > 0) {
              phaseContext += `**Use grep or codebase_search to find specific information from these files.**\n\n`;
            } else {
              phaseContext += `_No context files were provided for this phase._\n\n`;
            }
          }
          else if (phaseConfig?.prd_reference?.length > 0) {
            phaseContext += `### Context Files\n`;
            phaseContext += `The following PRD files are relevant for this work:\n\n`;
            for (const file of phaseConfig.prd_reference) {
              phaseContext += `- \`${file}\`\n`;
            }
            phaseContext += `\n**Use grep or codebase_search to find specific information from these files.**\n\n`;
          }
          else if (phaseConfig?.reference?.length > 0) {
            phaseContext += `### Context Files\n`;
            phaseContext += `The following files are needed for this work:\n\n`;
            for (const file of phaseConfig.reference) {
              phaseContext += `- \`${file}\`\n`;
            }
            phaseContext += `\n**Use grep or codebase_search to find specific information from these files.**\n\n`;
          } else {
            phaseContext += `_No context files were provided for this phase._\n\n`;
          }
          
          content = content.replace(/\{\{PRD_CONTEXT\}\}/g, phaseContext);
        } else {
          content = content.replace(/\{\{PRD_CONTEXT\}\}/g, '');
        }
      }
      
    // File reference for prd-context-map.json (adapter pattern - no injection)
    if (content.includes('{{PRD_CONTEXT_MAP}}')) {
      const mapPath = path.join(this.workingDirectory, 'reference', 'prd-context-map.json');
      if (fs.existsSync(mapPath)) {
        // Tell LLM to read the file instead of injecting (adapter pattern)
        const fileReference = `## PRD Context Map from Phase 1-1

**Read the context map file created by Phase 1-1:**
\`\`\`bash
cat reference/prd-context-map.json
\`\`\`

This file contains:
- Phase mappings with PRD files for each phase
- Generated timestamp`;
        
        content = content.replace(/\{\{PRD_CONTEXT_MAP\}\}/g, fileReference);
      } else {
        content = content.replace(/\{\{PRD_CONTEXT_MAP\}\}/g, '');
      }
    }
      
      // Inject gate context for phase-1-2 gates
      if (content.includes('{{GATE_CONTEXT}}')) {
        const mapPath = path.join(this.workingDirectory, 'reference', 'prd-context-map.json');
        if (fs.existsSync(mapPath)) {
          const contextMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
          
          // Determine which phase's gate context to use based on the content
          let phaseId = null;
          if (phaseDef?.promptFile?.includes('gate-1-2')) {
            phaseId = 'phase-1-2';
          }
          
          if (phaseId) {
            const phaseConfig = contextMap.phases?.[phaseId];
            if (phaseConfig?.categories?.gate_context?.length > 0) {
              let gateContext = `## 📋 Gate Context Files\n\n`;
              gateContext += `These files help validate the completeness and quality of this phase:\n\n`;
              
              for (const file of phaseConfig.categories.gate_context) {
                gateContext += `- \`${file}\`\n`;
              }
              
              gateContext += `\n**Use these files to verify all requirements have been addressed.**\n`;
              
              content = content.replace(/\{\{GATE_CONTEXT\}\}/g, gateContext);
            } else {
              content = content.replace(/\{\{GATE_CONTEXT\}\}/g, '');
            }
          } else {
            content = content.replace(/\{\{GATE_CONTEXT\}\}/g, '');
          }
        } else {
          content = content.replace(/\{\{GATE_CONTEXT\}\}/g, '');
        }
      }
      
      return content;
    } catch (error) {
      console.warn(`⚠️  Error injecting dynamic content: ${error.message}`);
      return phaseContent;
    }
  }
  
  injectPrdContext(phaseId) {
    try {
      const mapPath = path.join(this.workingDirectory, 'reference', 'prd-context-map.json');
      if (!fs.existsSync(mapPath)) {
        return '\n\n';
      }

      const contextMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      
      // Support array of phase IDs for merged context
      const phaseIds = Array.isArray(phaseId) ? phaseId : [phaseId];
      
      // Merge phase configs with priority to first in array
      let mergedConfig = {};
      for (const id of phaseIds.reverse()) {  // Reverse to let first override
        const config = contextMap.phases?.[id];
        if (config) {
          mergedConfig = { ...mergedConfig, ...config };
        }
      }
      const phaseConfig = Object.keys(mergedConfig).length > 0 ? mergedConfig : null;

      if (!phaseConfig) {
        return '\n\n';
      }

      const references = [];

      const addReference = (title, absolutePath, description = null) => {
        if (!absolutePath || !fs.existsSync(absolutePath)) return;
        const relativePath = path.relative(this.workingDirectory, absolutePath) || path.basename(absolutePath);
        references.push({ title, relativePath: relativePath.split(path.sep).join('/'), description });
      };

      if ((phaseConfig.task_guidelines_context !== false) && contextMap.master_docs?.task_guidelines) {
        const taskGuidelinesPath = path.join(this.workingDirectory, contextMap.master_docs.task_guidelines);
        addReference('Task Planning Guidelines', taskGuidelinesPath, 'Review guidelines for planning and organizing development tasks.');
      }

      if ((phaseConfig.build_guidelines_context !== false) && contextMap.master_docs?.build_guidelines) {
        const buildGuidelinesPath = path.join(this.workingDirectory, contextMap.master_docs.build_guidelines);
        addReference('Build Implementation Guidelines', buildGuidelinesPath, 'Review governance guardrails and development best practices.');
      }

      if (phaseConfig.boilerplate_context && contextMap.master_docs?.boilerplate_readme) {
        const boilerplatePath = path.join(this.workingDirectory, contextMap.master_docs.boilerplate_readme);
        addReference('Boilerplate Technical Reference', boilerplatePath, 'Understand the baseline SaaS architecture before making changes.');
      }

      if (references.length === 0) {
        return '\n\n';
      }

      let context = '\n\n---\n\n';
      context += '## Reference Materials (MUST READ)\n\n';
      context += 'Use Claude Code\'s Read tool to open these files before continuing (example: `Read {"file_path": "path"}`):\n\n';

      for (const ref of references) {
        context += `- ${ref.title}: \`${ref.relativePath}\``;
        if (ref.description) {
          context += ` — ${ref.description}`;
        }
        context += '\n';
      }

      context += '\n---\n\n';
      return context;
    } catch (error) {
      console.warn(`⚠️  Could not inject PRD context: ${error.message}`);
      return '\n\n';
    }
  }
  
  /**
   * Load detailed task content from phases directory
   */
  loadPhaseContent(phaseDef) {
    try {
      // Check if phase has a promptFile specified (from workflow config)
      if (phaseDef.promptFile) {
        // Handle absolute paths directly
        if (path.isAbsolute(phaseDef.promptFile)) {
          const promptPath = phaseDef.promptFile;
          if (fs.existsSync(promptPath)) {
            let phaseContent = fs.readFileSync(promptPath, 'utf8');
            console.log(`📋 Using phase content from ${phaseDef.promptFile}`);
            
            // Handle template substitution for subcomponent phases
            if (phaseDef.subcomponent && phaseDef.component) {
              phaseContent = this.substituteTemplate(phaseContent, phaseDef.subcomponent, phaseDef.component);
            }
            
            // Handle template substitution for frontend build phases
            if (phaseDef.buildTargets) {
              phaseContent = this.substituteTemplate(phaseContent, null, null, phaseDef.buildTargets);
            }

            if (phaseDef.buildUnit) {
              phaseContent = this.applyBuildUnitTemplate(phaseContent, phaseDef.buildUnit);
            }
            
            // Inject dynamic content (e.g., prd-context-map.json)
            phaseContent = this.injectDynamicContent(phaseContent, phaseDef);
            
            // Prepend shared context preamble if available
            const preamblePath = path.join(__dirname, '..', 'context', 'archive', 'shared-context-preamble.md');
            let finalContent = phaseContent;
            if (fs.existsSync(preamblePath)) {
              const preamble = fs.readFileSync(preamblePath, 'utf8');
              finalContent = `${preamble}\n\n---\n\n${phaseContent}`;
              console.log('🧩 Prepended shared context preamble to phase content');
            }
            
            return finalContent;
          } else {
            const error = `Gate file not found: ${promptPath}`;
            console.error(`❌ ${error}`);
            throw new Error(error);
          }
        }
        
        const relativePath = phaseDef.promptFile;
        const fallbackPath = path.join('/workspace', phaseDef.promptFile);
        
        let promptPath = null;
        if (fs.existsSync(relativePath)) {
          promptPath = relativePath;
        } else if (fs.existsSync(fallbackPath)) {
          promptPath = fallbackPath;
        } else {
          const error = `Gate file not found at ${relativePath} or ${fallbackPath}`;
          console.error(`❌ ${error}`);
          throw new Error(error);
        }
        
        let phaseContent = fs.readFileSync(promptPath, 'utf8');
        console.log(`📋 Using phase content from ${phaseDef.promptFile}`);
        
        // Handle template substitution for subcomponent phases
        if (phaseDef.subcomponent && phaseDef.component) {
          phaseContent = this.substituteTemplate(phaseContent, phaseDef.subcomponent, phaseDef.component);
        }
        
        // Handle template substitution for frontend build phases
        if (phaseDef.buildTargets) {
          phaseContent = this.substituteTemplate(phaseContent, null, null, phaseDef.buildTargets);
        }

        if (phaseDef.buildUnit) {
          phaseContent = this.applyBuildUnitTemplate(phaseContent, phaseDef.buildUnit);
        }
        
        // Inject dynamic content (e.g., prd-context-map.json)
        phaseContent = this.injectDynamicContent(phaseContent, phaseDef);
        
        // Prepend shared context preamble if available
        const preamblePath = path.join(__dirname, '..', 'context', 'archive', 'shared-context-preamble.md');
        let finalContent = phaseContent;
        if (fs.existsSync(preamblePath)) {
          const preamble = fs.readFileSync(preamblePath, 'utf8');
          finalContent = `${preamble}\n\n---\n\n${phaseContent}`;
          console.log('🧩 Prepended shared context preamble to phase content');
        }
        
        return finalContent;
      }
      
      // Fall back to legacy phases directory
      const phaseFile = path.join(__dirname, '../phases', `${phaseDef.id}.md`);
      if (fs.existsSync(phaseFile)) {
        const phaseContent = fs.readFileSync(phaseFile, 'utf8');
        console.log(`📋 Using detailed phase content from phases/${phaseDef.id}.md`);

        // Prepend shared context preamble if available
        const preamblePath = path.join(__dirname, '..', 'context', 'archive', 'shared-context-preamble.md');
        let finalContent = phaseContent;
        if (fs.existsSync(preamblePath)) {
          const preamble = fs.readFileSync(preamblePath, 'utf8');
          finalContent = `${preamble}\n\n---\n\n${phaseContent}`;
          console.log('🧩 Prepended shared context preamble to phase content');
        }

        return finalContent;
      }
    } catch (error) {
      console.log(`⚠️  Could not load phase content: ${error.message}`);
    }
    
    // Fallback to simple task
    return phaseDef.task || `Execute ${phaseDef.sparcMode} mode for ${phaseDef.id}`;
  }
  
  /**
   * Generate output contract from workflow configuration
   */
  generateOutputContract(phaseDef, workspaceRoot = this.workingDirectory || process.cwd()) {
    if (!phaseDef?.outputContract) {
      return '';
    }
    
    const contract = phaseDef.outputContract;
    const description = contract.description || 'Follow the output requirements for this phase.';
    const phaseLabel = (phaseDef.name || phaseDef.id || 'phase').toUpperCase();

    // Handle validation-only phases (no output files required)
    if (contract.validationOnly) {
      return `\n\nPHASE OBJECTIVE: ${description}\nThis phase validates inputs only - no output files are required.`;
    }

    const resolvedBaseDir = contract.baseDirectory
      ? path.resolve(workspaceRoot, contract.baseDirectory)
      : workspaceRoot;
    const relativeBaseDir = path.relative(workspaceRoot, resolvedBaseDir);
    const hasCustomBase = relativeBaseDir && relativeBaseDir !== '' && relativeBaseDir !== '.';

    // Build contract for phases that create files
    let contractText = `\n\nMANDATORY OUTPUT CONTRACT (${phaseLabel})\n`;
    contractText += `${description}\n\n`;
    if (hasCustomBase) {
      contractText += `All paths below are relative to ${relativeBaseDir}/ from the workspace root.\n\n`;
    }
    contractText += `You must write ALL of the following files BEFORE considering this phase complete:\n`;

    const requiredFiles = contract.requiredFiles || [];
    if (requiredFiles.length === 0) {
      contractText += `- (No required files specified)\n`;
    } else {
      for (const file of requiredFiles) {
        const absoluteFilePath = path.resolve(resolvedBaseDir, file);
        let relativeFilePath = path.relative(workspaceRoot, absoluteFilePath);
        if (!relativeFilePath || relativeFilePath === '') {
          relativeFilePath = path.basename(absoluteFilePath);
        }
        const normalizedPath = relativeFilePath.split(path.sep).join('/');
        const lower = normalizedPath.toLowerCase();
        const formatHint = lower.endsWith('.json')
          ? ' (JSON only - no markdown)'
          : (lower.endsWith('.md') ? ' (Markdown only)' : '');
        contractText += `- ${normalizedPath}${formatHint}\n`;
      }
    }

    contractText += `\nFORMAT RULES:\n- JSON files: write valid JSON only (no markdown fences)\n- Markdown files: write Markdown only\n\n---\n`;

    return contractText;
  }
  
  /**
   * Kick off a phase in a detached process
   */
  async kickOffPhase(phaseDef, modeConfig, improvedPrompt = null) {
    // Lightweight health check for code-modifying phases only
    const codeModifyingPhases = ['phase-2', 'phase-3-1', 'phase-3-3', 'phase-6', 'phase-7-1', 'phase-7-3'];
    if (codeModifyingPhases.some(id => phaseDef.id?.includes(id))) {
      try {
        const { logServerStatus } = require('./server-health');
        logServerStatus(phaseDef.id);
      } catch (_) {
        // Ignore if module doesn't exist
      }
    }
    
    return new Promise((resolve, reject) => {
      // Check if phase has a custom command instead of using mode config
      if (phaseDef.command) {
        console.log(`🔧 Running custom command: ${phaseDef.command} ${(phaseDef.args || []).join(' ')}`);
        
        const child = spawn(phaseDef.command, phaseDef.args || [], {
          cwd: this.workingDirectory,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          detached: true,
          env: process.env  // Pass full environment including PATH
        });
        
        // Store the process info
        child.phaseInfo = {
          phaseDef,
          output: '',
          errorOutput: '',
          startTime: Date.now(),
          endTime: null
        };
        
        child.stdout?.on('data', (data) => {
          child.phaseInfo.output += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
          child.phaseInfo.errorOutput += data.toString();
        });
        
        child.on('exit', (code, signal) => {
          child.exitCode = code;
          child.phaseInfo.endTime = Date.now();
        });
        
        resolve(child);
        return;
      }
      
      // Use execution mode system
      const phaseContent = this.loadPhaseContent(phaseDef);

      // Prepare prompt content using workspace-relative output paths
      const workspaceRoot = this.workingDirectory || process.cwd();
      const prdContext = this.injectPrdContext(phaseDef.id);
      let outputContract = this.generateOutputContract(phaseDef, workspaceRoot);
      const basePrompt = improvedPrompt || phaseContent;

      const fullPrompt = `${prdContext}${basePrompt}${outputContract}`;
      
      if (improvedPrompt) {
        console.log(`🔄 Using improved prompt for retry attempt`);
      }
      
      // Archive a copy of prompts for debugging if needed
      if (process.env.DEBUG_PROMPTS) {
        try {
          const phasesDir = path.join(this.workingDirectory, 'log', 'prompts', 'phases');
          if (!fs.existsSync(phasesDir)) {
            fs.mkdirSync(phasesDir, { recursive: true });
          }
          const archived = path.join(phasesDir, `phase-${phaseDef.id}-${Date.now()}.txt`);
          fs.writeFileSync(archived, fullPrompt, 'utf8');
        } catch (_) {}
      }
      
      // Removed adapter-specific pre-creation of user-story directories
      
      const promptArtifact = this.debugLogger?.saveTextArtifact({
        scope: 'phase-exec',
        event: 'prompt-snapshot',
        phaseId: phaseDef.id,
        attempt: phaseDef.retryAttempt || 0,
        role: 'phase',
        kind: 'prompt',
        extension: 'md',
        content: fullPrompt
      });

      const childEnv = this.prepareChildEnv();

      // Build command using the execution mode system
      const { command, args, tempPromptFile } = this.buildCommand(modeConfig, phaseDef, fullPrompt);

      // Note: We extract session_id from Claude CLI's first output message
      // instead of pre-specifying it with --session-id flag.
      // This ensures clean process exit and proper session lifecycle.
      if (phaseDef.followUpPrompt) {
        console.log(`📋 Follow-up audit configured - will extract session ID from output`);
      }

      // Reduced retry logs: no verbose context or prompt content dumps
      // (Removed extra debug logging of pinned version)
      
      // Show command for logging (truncate long arguments and preserve quotes)
      const displayArgs = args.map(arg => {
        if (typeof arg === 'string' && arg.length > 100) {
          return `"${arg.substring(0, 50)}..." (${arg.length} chars)`;
        }
        // Add quotes around arguments that contain spaces or special characters
        if (typeof arg === 'string' && (arg.includes(' ') || arg.includes('|') || arg.includes('&') || arg.includes(';') || arg.includes('$'))) {
          return `"${arg}"`;
        }
        return arg;
      });
      if (modeConfig.providerName) {
        console.log(`🧠 Direct agent provider: ${modeConfig.providerName}`);
      }
      console.log(`🔧 Executing phase: ${command} ${displayArgs.join(' ')}`);
      let commandLineForLog = this.formatCommandLine(command, args);
      let commandArtifact = null;

      if (this.debugLogger?.isEnabled?.()) {
        this.debugLogger.log('phase-exec', 'spawn-command', {
          phaseId: phaseDef.id,
          command,
          args,
          tempPromptFile,
          retryAttempt: phaseDef.retryAttempt || 0,
          promptSnapshotPath: promptArtifact?.relativePath
        });
      }
      
      // Spawn the process in detached mode
      const stdio = ['ignore', 'pipe', 'pipe'];
      
      // Check if any arguments contain shell expansion patterns
      const needsShellExpansion = args.some(arg => 
        typeof arg === 'string' && arg.includes('$(')
      );
      
      const processLog = this.debugLogger?.createProcessLog({
        phaseId: phaseDef.id,
        attempt: phaseDef.retryAttempt || 0,
        kind: 'phase'
      });

      let child;
      const promptSource = modeConfig.promptSource || 'tempfile';

      const requiresPipe = modeConfig.pipePrompt && tempPromptFile;

      if (requiresPipe) {
        const commandLine = `${this.formatCommandLine('cat', [tempPromptFile])} | ${this.formatCommandLine(command, args)}`;
        commandLineForLog = commandLine;
        child = spawn(commandLine, {
          cwd: this.workingDirectory,
          stdio: stdio,
          shell: true,
          detached: true,
          env: childEnv
        });
      } else if (needsShellExpansion) {
        // CRITICAL: For DETACHED processes (phases), we CANNOT use pipe approach
        // because the shell completes when cat finishes, not when claude-flow finishes.
        // This causes phases to appear complete in seconds when they should run for minutes.
        
        // For detached processes, use shell expansion (files are small enough)
        const fullCommand = `${command} ${args.map(arg => 
          typeof arg === 'string' && (arg.includes(' ') || arg.includes('$')) ? `"${arg}"` : arg
        ).join(' ')}`;
        commandLineForLog = fullCommand;
        
        child = spawn(fullCommand, {
          cwd: this.workingDirectory,
          stdio: stdio,
          shell: true,
          detached: true,
          env: childEnv
        });
      } else {
        // Normal execution with args array
        child = spawn(command, args, {
          cwd: this.workingDirectory,
          stdio: stdio,
          shell: true,
          detached: true,
          env: childEnv  // Pass full environment including PATH
        });
      }

      commandArtifact = this.debugLogger?.saveTextArtifact({
        scope: 'phase-exec',
        event: 'command-line',
        phaseId: phaseDef.id,
        attempt: phaseDef.retryAttempt || 0,
        role: 'phase',
        kind: 'command',
        extension: 'sh',
        content: commandLineForLog
      }) || commandArtifact;
      
      
      // Store temp file for cleanup
      if (tempPromptFile) {
        child.tempPromptFile = tempPromptFile;
      }
      
      // Don't wait for the process to complete - just return it
      child.unref(); // Allow the parent process to exit independently
      
      // Store the process info
      child.phaseInfo = {
        phaseDef,
        output: '',
        errorOutput: '',
        startTime: Date.now(),
        endTime: null,
        outputLines: 0,
        errorLines: 0,
        swarmDetected: false,
        sessionId: null,  // Will be extracted from first stdout message
        sessionIdExtracted: false,
        debugArtifacts: {
          prompt: promptArtifact?.relativePath || null,
          command: commandArtifact?.relativePath || null,
          stdout: processLog?.stdoutPath ? path.relative(this.workingDirectory, processLog.stdoutPath) : null,
          stderr: processLog?.stderrPath ? path.relative(this.workingDirectory, processLog.stderrPath) : null
        }
      };
      
      
      // Store output for monitoring
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        child.phaseInfo.output += text;
        child.phaseInfo.outputLines++;
        
        // Extract session_id from first init message (for follow-up execution)
        // Format: {"type":"system","subtype":"init","session_id":"uuid",...}
        if (!child.phaseInfo.sessionIdExtracted && phaseDef.followUpPrompt) {
          try {
            const match = text.match(/"session_id"\s*:\s*"([a-f0-9-]{36})"/);
            if (match) {
              child.phaseInfo.sessionId = match[1];
              child.phaseInfo.sessionIdExtracted = true;
              console.log(`📋 Extracted session ID: ${match[1]}`);
            }
          } catch (e) {
            // Ignore parse errors - will retry on next chunk
          }
        }
        
        if (phaseDef.isEnhancedRetry) {
          try { process.stdout.write(text); } catch (_) {}
        }
        processLog?.writeStdout(text);
      });
      
      child.stderr?.on('data', (data) => {
        const text = data.toString();
        child.phaseInfo.errorOutput += text;
        child.phaseInfo.errorLines++;
        if (phaseDef.isEnhancedRetry) {
          try { process.stderr.write(text); } catch (_) {}
        }
        processLog?.writeStderr(text);
      });

      // Capture precise end time on exit
      child.on('exit', (code, signal) => {
        child.phaseInfo.endTime = Date.now();
        if (this.debugLogger?.isEnabled?.()) {
          this.debugLogger.log('phase-exec', 'process-exit', {
            phaseId: phaseDef.id,
            command,
            args,
            exitCode: code,
            signal,
            duration: child.phaseInfo.endTime - child.phaseInfo.startTime,
            retryAttempt: phaseDef.retryAttempt || 0,
            promptSnapshotPath: promptArtifact?.relativePath,
            commandSnapshotPath: commandArtifact?.relativePath,
            stdoutLogPath: child.phaseInfo?.debugArtifacts?.stdout || null,
            stderrLogPath: child.phaseInfo?.debugArtifacts?.stderr || null
          });
        }
        processLog?.close?.();
      });
      
      resolve(child);
    });
  }
  
  /**
   * Clean up stale MCP processes that may be hanging from previous runs
   */
  cleanupStaleMCPProcesses() {
    const { execSync } = require('child_process');
    const mcpPatterns = [
      'chrome-devtools-mcp',
      'ruv-swarm.*mcp',
      'claude-flow.*mcp',
      'flow-nexus.*mcp',
      'agentic-payments.*mcp'
    ];
    
    console.log('🧹 Cleaning up stale MCP processes...');
    
    for (const pattern of mcpPatterns) {
      try {
        // Use pkill with pattern matching - ignore errors if no processes found
        execSync(`pkill -f "${pattern}" 2>/dev/null || true`, { 
          stdio: 'ignore',
          timeout: 5000 
        });
      } catch (e) {
        // Ignore errors - process might not exist
      }
    }
    
    console.log('🧹 MCP cleanup complete');
  }

  /**
   * Execute a gate synchronously and return the result
   * Includes a 60-minute timeout to prevent indefinite hangs
   */
  async executeGate(gateFile, modeConfig, phaseOutput = null, originalPhaseDef = null) {
    // Gate execution timeout: 60 minutes
    const GATE_TIMEOUT_MS = 60 * 60 * 1000;
    
    return new Promise(async (resolve, reject) => {
      // Load gate content (only for prompt-based gates)
      // Generate gate id from the phase id or gate filename
      const gateId = originalPhaseDef?.id ? `gate-${originalPhaseDef.id}` : path.basename(gateFile, path.extname(gateFile));
      let templatePhase = { id: gateId, promptFile: gateFile };
      if (originalPhaseDef?.buildTargets) templatePhase.buildTargets = originalPhaseDef.buildTargets;
      if (originalPhaseDef?.buildUnit) templatePhase.buildUnit = originalPhaseDef.buildUnit;
      let gateContent = modeConfig.promptFormat !== 'none' ? this.loadPhaseContent(templatePhase) : null;

      // Build command using the same logic as phases, but filter out stream-json for gates
      const childEnv = {
        ...this.prepareChildEnv(),
        // Pass BUILD_UNIT_ID and BUILD_UNIT_TITLE for composite gates (Playwright + LLM)
        BUILD_UNIT_ID: originalPhaseDef?.buildUnit?.id || '',
        BUILD_UNIT_TITLE: originalPhaseDef?.buildUnit?.title || ''
      };

      const { command, args, tempPromptFile } = this.buildCommand(modeConfig, templatePhase, gateContent);
      
      // Ensure gates use --output-format json for structured output (LLM gates only)
      let filteredArgs = args.filter((arg, index) => {
        // Remove --output-format and its value if it's stream-json
        if (arg === '--output-format' && args[index + 1] === 'stream-json') {
          return false;
        }
        // Also skip the stream-json value itself
        if (index > 0 && args[index - 1] === '--output-format' && arg === 'stream-json') {
          return false;
        }
        // Remove --print flag which forces human-readable output instead of JSON
        if (arg === '--print') {
          return false;
        }
        return true;
      });
      
      // Only add --output-format json for LLM gates (.md files), not JavaScript gates (.js files)
      const isJavaScriptGate = gateFile.endsWith('.js');
      if (!isJavaScriptGate && !filteredArgs.includes('--output-format')) {
        filteredArgs.push('--output-format', 'json');
      }
      
      // Show command for logging (same logic as kickOffPhase)
      const displayArgs = filteredArgs.map(arg => {
        if (typeof arg === 'string' && arg.length > 100) {
          return `"${arg.substring(0, 50)}..." (${arg.length} chars)`;
        }
        // Add quotes around arguments that contain spaces or special characters
        if (typeof arg === 'string' && (arg.includes(' ') || arg.includes('|') || arg.includes('&') || arg.includes(';') || arg.includes('$'))) {
          return `"${arg}"`;
        }
        return arg;
      });
      if (modeConfig.providerName) {
        console.log(`🧠 Direct agent provider: ${modeConfig.providerName}`);
      }
      console.log(`🔧 Executing gate: ${command} ${displayArgs.join(' ')}`);
      let gateCommandLine = this.formatCommandLine(command, filteredArgs);
      if (this.debugLogger?.isEnabled?.()) {
        this.debugLogger.log('gate-exec', 'spawn-command', {
          gateFile,
          command,
          args: filteredArgs,
          tempPromptFile,
          executionMode: modeConfig.modeName || modeConfig.name || 'unknown',
          promptSnapshotPath: null // No prompt artifact for gate execution
        });
      }
      
      // Check if we need shell expansion (same logic as kickOffPhase)
      const needsShellExpansion = filteredArgs.some(arg => 
        typeof arg === 'string' && arg.includes('$(')
      );
      
      let child;
      const processLog = this.debugLogger?.createProcessLog({
        phaseId: templatePhase.id, // Use templatePhase.id for gate
        attempt: templatePhase.retryAttempt || 0,
        kind: 'gate'
      });
      const requiresPipe = modeConfig.pipePrompt && tempPromptFile;
      if (requiresPipe) {
        const commandLine = `${this.formatCommandLine('cat', [tempPromptFile])} | ${this.formatCommandLine(command, filteredArgs)}`;
        gateCommandLine = commandLine;
        child = spawn(commandLine, {
          cwd: this.workingDirectory,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          detached: false,
          env: childEnv
        });
      } else if (needsShellExpansion) {
        // CRITICAL FIX: Use pipe approach like Adapter to avoid E2BIG
        // Check for $(cat ...) pattern and convert to pipe
        const catMatch = filteredArgs.find(arg => 
          typeof arg === 'string' && arg.match(/\$\(cat\s+([^)]+)\)/)
        );
        
        if (catMatch) {
          // Extract the file path from $(cat /path/to/file)
          const filePathMatch = catMatch.match(/\$\(cat\s+([^)]+)\)/);
          const filePath = filePathMatch ? filePathMatch[1].trim() : null;
          
          if (filePath && fs.existsSync(filePath)) {
            // Use pipe for files to avoid E2BIG (Adapter's approach)
            const pipeFilteredArgs = filteredArgs.filter(arg => arg !== catMatch);
            const fullCommand = `cat ${filePath} | ${command} ${pipeFilteredArgs.map(arg => 
              typeof arg === 'string' && (arg.includes(' ') || arg.includes('$')) ? `"${arg}"` : arg
            ).join(' ')}`;
            gateCommandLine = fullCommand;
            
            child = spawn(fullCommand, {
              cwd: this.workingDirectory,
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: true,
              detached: false,  // Run synchronously for gates
              env: childEnv  // Pass full environment including PATH
            });
          } else {
            // Fallback if file doesn't exist
            console.error(`❌ File not found for pipe: ${filePath}`);
            const fullCommand = `${command} ${filteredArgs.map(arg => 
              typeof arg === 'string' && (arg.includes(' ') || arg.includes('$')) ? `"${arg}"` : arg
            ).join(' ')}`;
            gateCommandLine = fullCommand;
            
            child = spawn(fullCommand, {
              cwd: this.workingDirectory,
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: true,
              detached: false,
              env: childEnv
            });
          }
        } else {
          // No cat command, use original behavior
          const fullCommand = `${command} ${filteredArgs.map(arg => 
            typeof arg === 'string' && (arg.includes(' ') || arg.includes('$')) ? `"${arg}"` : arg
          ).join(' ')}`;
          gateCommandLine = fullCommand;
          
          child = spawn(fullCommand, {
            cwd: this.workingDirectory,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            detached: false,  // Run synchronously for gates
            env: childEnv  // Pass full environment including PATH
          });
        }
      } else {
        // Normal execution with args array
        child = spawn(command, filteredArgs, {
          cwd: this.workingDirectory,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          detached: false,  // Run synchronously for gates
          env: childEnv  // Pass full environment including PATH
        });
      }

      const gateCommandArtifact = this.debugLogger?.saveTextArtifact({
        scope: 'gate-exec',
        event: 'command-line',
        phaseId: templatePhase.id, // Use templatePhase.id for gate
        attempt: templatePhase.retryAttempt || 0,
        role: 'gate',
        kind: 'command',
        extension: 'sh',
        content: gateCommandLine
      }) || null;
      
      let output = '';
      let errorOutput = '';
      let timedOut = false;
      
      // Set up timeout to kill hung gate processes
      const timeoutId = setTimeout(() => {
        timedOut = true;
        console.error(`⏰ Gate execution timed out after ${GATE_TIMEOUT_MS / 60000} minutes - killing process`);
        
        try {
          // Kill the process group
          process.kill(-child.pid, 'SIGTERM');
        } catch (e) {
          try {
            child.kill('SIGTERM');
          } catch (e2) {
            console.warn(`⚠️  Could not kill gate process: ${e2.message}`);
          }
        }
        
        // Force kill after 10 seconds if still running
        setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch (e) {
            try {
              child.kill('SIGKILL');
            } catch (e2) {}
          }
        }, 10000);
      }, GATE_TIMEOUT_MS);
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
        processLog?.writeStdout(data);
      });
      
      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        processLog?.writeStderr(data);
      });
      
      child.on('close', (code) => {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Clean up temp file
        if (tempPromptFile) {
          this.cleanupFile(tempPromptFile, true);
        }
        if (this.debugLogger?.isEnabled?.()) {
          this.debugLogger.log('gate-exec', 'process-exit', {
            gateFile,
            command,
            args: filteredArgs,
            exitCode: code,
            timedOut,
            promptSnapshotPath: null, // No prompt artifact for gate execution
            commandSnapshotPath: gateCommandArtifact?.relativePath
          });
        }
        processLog?.close?.();
        
        resolve({
          exitCode: timedOut ? 124 : code, // Exit code 124 = timeout (like GNU timeout)
          output: output,
          errorOutput: timedOut ? 'Gate execution timed out after 60 minutes' : errorOutput,
          completed: code === 0 && !timedOut,
          timedOut
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Execute a follow-up audit in the same session as the phase
   * This resumes the Claude session and sends the audit prompt
   * @param {Object} phaseDef - Phase definition with followUpPrompt
   * @param {string} sessionId - The session ID from the phase execution
   * @returns {Object} Result with exitCode, output, completed status
   */
  async executeFollowUp(phaseDef, sessionId) {
    // Follow-up execution timeout: 30 minutes
    const FOLLOWUP_TIMEOUT_MS = 30 * 60 * 1000;

    return new Promise((resolve, reject) => {
      if (!phaseDef.followUpPrompt || !sessionId) {
        resolve({ completed: true, skipped: true });
        return;
      }

      console.log(`\n🔍 Running follow-up audit for ${phaseDef.id}...`);

      // Load the follow-up prompt
      const followUpPath = path.join(this.workingDirectory, phaseDef.followUpPrompt);
      if (!fs.existsSync(followUpPath)) {
        console.warn(`⚠️  Follow-up prompt not found: ${followUpPath}`);
        resolve({ completed: true, skipped: true, reason: 'prompt_not_found' });
        return;
      }

      let followUpContent = fs.readFileSync(followUpPath, 'utf8');
      
      // Apply build unit template substitution (for {{BUILD_UNIT_*}} variables)
      if (phaseDef.buildUnit) {
        followUpContent = this.applyBuildUnitTemplate(followUpContent, phaseDef.buildUnit);
      }

      // Write to temp file
      const tmpDir = path.join(this.workingDirectory, '.tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tempPromptFile = path.join(tmpDir, `${phaseDef.id}-followup-${Date.now()}.txt`);
      fs.writeFileSync(tempPromptFile, followUpContent, 'utf8');

      // Build resume command with MCP config for tool access
      const command = 'claude';
      const args = [
        '--resume', sessionId,
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--dangerously-skip-permissions',
        '--mcp-config', path.join(this.workingDirectory, '.mcp.json')
      ];

      // Send prompt content via stdin (avoid shell pipeline so timeouts can reliably kill Claude)
      // Equivalent to: cat "<tempPromptFile>" | claude <args...>
      const fullCommand = `${command} ${args.join(' ')} < "${tempPromptFile}"`;

      console.log(`🔧 Resuming session: ${sessionId}`);

      const childEnv = this.prepareChildEnv();
      const child = spawn(command, args, {
        cwd: this.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        detached: false,  // Run synchronously
        env: childEnv
      });

      // Stream prompt file into Claude stdin (like `cat file | claude ...`)
      const promptStream = fs.createReadStream(tempPromptFile, { encoding: 'utf8' });
      promptStream.on('error', (e) => {
        console.error(`⚠️  Failed to read follow-up prompt file: ${e.message}`);
        try {
          child.stdin?.end();
        } catch (_) {
          // ignore
        }
      });
      try {
        promptStream.pipe(child.stdin);
      } catch (e) {
        console.error(`⚠️  Failed to pipe follow-up prompt to Claude stdin: ${e.message}`);
        try {
          child.stdin?.end();
        } catch (_) {
          // ignore
        }
      }

      // IMPORTANT: follow-up output can be extremely large (stream-json + long sessions).
      // Never buffer the full output in memory; stream it to disk and keep only a small tail.
      const logsDir = path.join(this.workingDirectory, 'log');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const followUpLogFile = path.join(logsDir, `followup-${phaseDef.id}-${Date.now()}.log`);
      const followUpLogStream = fs.createWriteStream(followUpLogFile, { flags: 'a' });
      followUpLogStream.write(`=== Follow-up audit for ${phaseDef.id} ===\n`);
      followUpLogStream.write(`sessionId: ${sessionId}\n`);
      followUpLogStream.write(`command: ${fullCommand}\n`);
      followUpLogStream.write(`timestamp: ${new Date().toISOString()}\n\n`);

      const MAX_TAIL_BYTES = 64 * 1024; // 64KB per stream
      const appendTail = (current, chunk) => {
        const next = current + chunk;
        if (next.length <= MAX_TAIL_BYTES) return next;
        return next.slice(next.length - MAX_TAIL_BYTES);
      };

      let outputTail = '';
      let errorTail = '';
      let timedOut = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        console.error(`⏰ Follow-up audit timed out after ${FOLLOWUP_TIMEOUT_MS / 60000} minutes`);
        try {
          // Stop feeding more input
          try {
            promptStream.destroy();
          } catch (_) {
            // ignore
          }
          try {
            child.stdin?.end();
          } catch (_) {
            // ignore
          }

          // Terminate Claude (graceful, then force)
          child.kill('SIGTERM');
        } catch (e) {
          // Ignore kill errors
        }

        setTimeout(() => {
          try {
            if (child.exitCode == null) child.kill('SIGKILL');
          } catch (_) {
            // ignore
          }
        }, 10000);
      }, FOLLOWUP_TIMEOUT_MS);

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        followUpLogStream.write(chunk);
        outputTail = appendTail(outputTail, chunk);
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        followUpLogStream.write(chunk);
        errorTail = appendTail(errorTail, chunk);
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        try {
          promptStream.destroy();
        } catch (_) {
          // ignore
        }

        // Clean up temp file
        this.cleanupFile(tempPromptFile, true);
        try {
          followUpLogStream.end();
        } catch (e) {
          // Ignore stream close errors
        }

        if (timedOut) {
          resolve({
            exitCode: 124,
            output: outputTail,
            errorOutput: 'Follow-up audit timed out',
            completed: false,
            timedOut: true,
            logFile: path.relative(this.workingDirectory, followUpLogFile)
          });
          return;
        }

        if (code === 0) {
          console.log(`✅ Follow-up audit completed successfully`);
        } else {
          console.warn(`⚠️  Follow-up audit exited with code ${code}`);
          // Log error output so we can see what went wrong
          if (errorTail && errorTail.trim()) {
            const safeStderr = errorTail
              .split('\n')
              .filter(line => line.trim())
              .slice(-10)
              .map(line => {
                const trimmed = line.trimStart();
                // Prevent log processors (e.g. Railway) from auto-parsing JSON and dropping nested fields.
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  return `RAW_JSON_LINE: ${line}`;
                }
                return line;
              })
              .join('\n')
              .slice(-2000); // keep logs bounded

            console.warn(`📋 Follow-up stderr (tail):\n${safeStderr}`);
          }
          if (outputTail && outputTail.trim()) {
            // Try to extract error info from JSON stream output
            const lines = outputTail.split('\n').filter(l => l.trim());
            const lastChunk = lines.slice(-25); // keep a bit more for parsing

            // Extract high-signal errors (if any) from stream-json lines.
            const extractedErrors = [];
            for (const line of lastChunk) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed?.attributes?.errors)) {
                  extractedErrors.push(...parsed.attributes.errors.map(String));
                }
                if (Array.isArray(parsed?.errors)) {
                  extractedErrors.push(...parsed.errors.map(String));
                }
              } catch (_) {
                // Ignore parse errors; this is best-effort.
              }
            }
            if (extractedErrors.length > 0) {
              const unique = Array.from(new Set(extractedErrors)).slice(0, 10);
              console.warn(`📋 Follow-up errors (extracted):\n${unique.map(e => `- ${e}`).join('\n')}`);
            }

            // Always print a tail, but prefix JSON lines so log processors won't auto-parse them.
            const safeTail = lastChunk
              .slice(-5)
              .map(line => {
                const trimmed = line.trimStart();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  return `RAW_JSON_LINE: ${line}`;
                }
                return line;
              })
              .join('\n');

            console.warn(`📋 Follow-up output (last 5 lines):\n${safeTail}`);
          }
          console.warn(`📝 Full follow-up output saved to: ${path.relative(this.workingDirectory, followUpLogFile)}`);
        }

        resolve({
          exitCode: code,
          output: outputTail,
          errorOutput: errorTail,
          completed: code === 0,
          logFile: path.relative(this.workingDirectory, followUpLogFile)
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`❌ Follow-up audit error: ${error.message}`);
        try {
          followUpLogStream.end();
        } catch (e) {
          // Ignore stream close errors
        }
        resolve({
          exitCode: 1,
          output: '',
          errorOutput: error.message,
          completed: false,
          error: true,
          logFile: path.relative(this.workingDirectory, followUpLogFile)
        });
      });
    });
  }

  /**
   * Clean up temporary file
   */
  cleanupFile(filePath, silent = false) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // File kept for debugging (silent)
        return true;
      }
    } catch (error) {
      if (!silent) console.warn(`⚠️  Failed to clean up ${path.basename(filePath)}: ${error.message}`);
    }
    return false;
  }
}

module.exports = PhaseExecutor;
