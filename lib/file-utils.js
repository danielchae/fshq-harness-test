/**
 * File Utilities Module
 * Common file system operations and helpers
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FileUtils {
  /**
   * Ensure required output directories exist
   */
  static ensureOutputDirectories(workingDirectory, phaseDefinitions) {
    const dirs = new Set();

    // Extract directories from workflow phase output contracts
    for (const phaseDef of phaseDefinitions) {
      const contract = phaseDef.outputContract;
      if (!contract) {
        continue;
      }

      const baseDir = contract.baseDirectory ? path.normalize(contract.baseDirectory) : '';
      if (baseDir && baseDir !== '.' && baseDir !== path.sep) {
        dirs.add(baseDir);
      }

      // Add subdirectories based on required files
      for (const file of contract.requiredFiles || []) {
        const fileDir = path.dirname(file);
        if (fileDir && fileDir !== '.' && fileDir !== path.sep) {
          const relPath = baseDir ? path.join(baseDir, fileDir) : fileDir;
          dirs.add(path.normalize(relPath));
        }
      }
    }

    for (const rel of dirs) {
      if (!rel || rel === '.' || rel === path.sep) {
        continue;
      }

      const dirPath = path.resolve(workingDirectory, rel);
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      } catch (e) {
        console.warn(`⚠️  Could not create directory ${dirPath}: ${e.message}`);
      }
    }
  }
  
  /**
   * Check if claude-flow is available locally
   */
  static isClaudeFlowAvailable(workingDirectory) {
    // Use version from env var if set, otherwise default to 'latest'
    const version = process.env.CLAUDE_FLOW_VERSION || 'latest';
    
    try {
      // Prefer global CLI (pre-installed in Docker)
      try {
        execSync('claude-flow --version', {
          stdio: 'ignore',
          cwd: workingDirectory,
          timeout: 30000
        });
        console.log('✅ Claude Flow available via global CLI');
        return true;
      } catch (_) {}

      // Fallback to npx with specific version (increased timeout)
      console.log(`🔎 Verifying Claude Flow via npx (${version})`);
      execSync(`npx --yes claude-flow@${version} --version`, {
        stdio: 'ignore',
        cwd: workingDirectory,
        timeout: 60000  // Increased timeout from 30s to 60s
      });
      console.log(`✅ Claude Flow available via npx (${version})`);
      return true;
    } catch (error) {
      console.log(`⚠️  Claude Flow npx probe failed - continuing without blocking`);
      return true; // Do not block; orchestrator will try to run with npx anyway
    }
  }
  
  /**
   * Generate improved prompt based on gate feedback
   */
  static async generateImprovedPrompt(phaseDef, gateResult, workingDirectory) {
    // If there's a template prompt, append improvement hints
    if (phaseDef.promptFile) {
      // Try relative path first, then /workspace fallback
      let promptPath = phaseDef.promptFile;
      if (!fs.existsSync(promptPath)) {
        const fallbackPath = path.join('/workspace', phaseDef.promptFile);
        if (fs.existsSync(fallbackPath)) {
          promptPath = fallbackPath;
        } else {
          throw new Error(`Prompt file not found at ${phaseDef.promptFile} or ${fallbackPath}`);
        }
      }
      let promptContent = fs.readFileSync(promptPath, 'utf8');
      
      // Apply template substitution if this is a dynamic phase
      if (phaseDef.subcomponent && phaseDef.component) {
        const PhaseExecutor = require('./phase-executor');
        const executor = new PhaseExecutor({ workingDirectory });
        promptContent = executor.substituteTemplate(promptContent, phaseDef.subcomponent, phaseDef.component);
      }
      
      // Resolve authoritative target files from outputContract
      const workspaceRoot = workingDirectory || process.cwd();
      const targetFiles = [];
      if (phaseDef.outputContract) {
        const baseDir = phaseDef.outputContract.baseDirectory
          ? path.resolve(workspaceRoot, phaseDef.outputContract.baseDirectory)
          : workspaceRoot;
        for (const rf of (phaseDef.outputContract.requiredFiles || [])) {
          const absolutePath = path.resolve(baseDir, rf);
          let relativePath = path.relative(workspaceRoot, absolutePath);
          if (!relativePath || relativePath === '') {
            relativePath = path.basename(absolutePath);
          }
          targetFiles.push(relativePath.split(path.sep).join('/'));
        }
      }
      
      // Get gate logs for reference - try relative first, then /workspace fallback
      let logsDir = 'log';
      if (!fs.existsSync(logsDir)) {
        const fallbackLogsDir = '/workspace/log';
        if (fs.existsSync(fallbackLogsDir)) {
          logsDir = fallbackLogsDir;
        }
      }
      let gateLogs = 'Not available';
      try {
        const logFiles = fs.readdirSync(logsDir)
          .filter(f => f.startsWith(`llm-gate-${phaseDef.id}-`) && f.endsWith('.log'))
          .sort();
        if (logFiles.length > 0) {
          gateLogs = path.join(logsDir, logFiles[logFiles.length - 1]);
        }
      } catch (e) {
        // Logs directory might not exist yet
      }
      
      // Add improvement guidance based on gate feedback
      const improvementSection = `

## 🔄 RETRY ATTEMPT (Attempt ${(phaseDef.gateRetryCount || 1) + 1}/3)

This is a RETRY attempt. The previous output did not meet quality standards.

### Previous Attempt Information:
- **Target Files**:\n${(targetFiles.length ? targetFiles.map(f => `  - ${f}`).join('\\n') : '  - (no outputContract files defined)')}
- **Gate Score**: ${gateResult.score || 'N/A'}
- **Gate Feedback Log**: ${gateLogs || 'Not available'}

### IMPORTANT: Check Existing Outputs
1. **CHECK** the target files listed above (exact paths)
2. **REVIEW** any existing files - these are your previous attempts
3. **BUILD UPON** the existing work - don't start from scratch
4. **IMPROVE** the areas identified below
5. **PRESERVE** what was already good in the previous attempt

### Issues to Address:
${gateResult.reasons?.map(r => `❌ ${r}`).join('\n') || '❌ Improve overall quality and completeness'}

### Specific Feedback:
${gateResult.feedback || 'Improve coverage, add more detail, ensure all requirements are addressed.'}

### Quality Gate Requirements:
- **Coverage**: Must achieve 90%+ coverage where applicable
- **Completeness**: Every story must have detailed acceptance criteria
- **Traceability**: Each story must trace back to specific requirements
- **Error Handling**: Include error scenarios and edge cases
- **Testability**: Acceptance criteria must be measurable and testable

### How to Improve:
1. Load and review your previous output files
2. Identify gaps in coverage (check against SOW and user flows)
3. Enhance existing stories with more detail
4. Add missing stories for uncovered requirements
5. Ensure all acceptance criteria are specific and testable
6. Add error handling and edge cases to each story

### Expected Output:
Write EXACTLY and ONLY to the following required files (overwrite if present):\n${(targetFiles.length ? targetFiles.map(f => `- ${f}`).join('\\n') : '- (no required files found)')}
`;
      
      return promptContent + improvementSection;
    }
    
    return null;
  }
  
  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  }
}

module.exports = FileUtils;
