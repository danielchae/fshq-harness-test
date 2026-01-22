/**
 * Retry Manager with Failure Context and Resume Support
 *
 * Integrates failure context management, output analysis, and resume functionality
 * with the orchestrator architecture.
 */

const fs = require('fs');
const path = require('path');

/**
 * Strip ANSI escape codes from text
 * Based on https://github.com/chalk/ansi-regex (MIT licensed)
 */
function stripAnsi(text) {
  if (typeof text !== 'string') return text;
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u001B\u009B][[()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TXZcf-nq-uy=><~]))/g, '');
}

class RetryManager {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 5,
      baseRetryDelay: options.baseRetryDelay || 2000,
      exponentialBackoff: options.exponentialBackoff !== false,
      retryDelayMultiplier: options.retryDelayMultiplier || 1.5,
      enableFailureContext: options.enableFailureContext !== false,
      enableResume: options.enableResume !== false,
      contextDirectory: options.contextDirectory || 'log/retry-contexts',
      workingDirectory: options.workingDirectory || process.cwd(),
      ...options
    };
    this.debugLogger = options.debugLogger || null;

    // State management
    this.activeRetryContexts = new Map();
    this.failureContexts = new Map();
    this.resumeStates = new Map();
    this.retryStatistics = {
      totalRetries: 0,
      successfulRetries: 0,
      resumedPhases: 0,
      contextualRetries: 0
    };

    this.ensureContextDirectory();
  }

  /**
   * Initialize or resume retry context for a phase
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseDef - Phase definition
   * @param {Object} orchestratorContext - Current orchestrator context
   * @returns {Object} Retry context (new or resumed)
   */
  async initializePhaseRetry(phaseId, phaseDef, orchestratorContext = {}) {
    // First check if we can resume from a previous failure
    const resumeState = await this.checkForResumeState(phaseId, phaseDef);
    
    if (resumeState && this.options.enableResume) {
      console.log(`🔄 Resuming phase ${phaseId} from previous failure context`);
      this.debugLogger?.log('retry', 'resume-state-found', {
        phaseId,
        attempts: resumeState.retryContext?.attempts?.length || 0,
        lastScore: resumeState.failureContext?.gateResult?.score || 0
      });
      return this.resumePhaseRetry(phaseId, phaseDef, resumeState);
    }

    // Initialize new retry context
    const retryContext = {
      phaseId,
      phaseDef,
      attempts: [],
      currentAttempt: 0,
      maxRetries: this.getPhaseMaxRetries(phaseDef),
      startTime: Date.now(),
      orchestratorContext,
      failureHistory: [],
      outputAnalysis: null,
      lastGateResult: null,
      resumedFromFailure: false
    };

    this.activeRetryContexts.set(phaseId, retryContext);
    await this.persistRetryState(phaseId, retryContext);
    this.debugLogger?.log('retry', 'retry-context-initialized', {
      phaseId,
      maxRetries: retryContext.maxRetries,
      promptFile: phaseDef.promptFile
    });

    return retryContext;
  }

  /**
   * Handle phase failure with comprehensive context analysis
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseDef - Phase definition
   * @param {Object} gateResult - Quality gate result
   * @param {Object} phaseResult - Phase execution result
   * @returns {Object} Retry decision with contextual data
   */
  async handlePhaseFailure(phaseId, phaseDef, gateResult, phaseResult = {}) {
    const retryContext = this.activeRetryContexts.get(phaseId);
    if (!retryContext) {
      throw new Error(`No retry context found for phase ${phaseId}`);
    }

    this.debugLogger?.log('retry', 'phase-failure-detected', {
      phaseId,
      attemptNumber: retryContext.currentAttempt + 1,
      maxRetries: retryContext.maxRetries,
      gateScore: gateResult?.score || 0,
      criticalFailures: gateResult?.criticalFailures || []
    });

    // Create comprehensive failure context
    const failureContext = await this.createFailureContext(
      phaseId, phaseDef, gateResult, phaseResult
    );

    // Record the attempt with failure context
    const attempt = {
      attemptNumber: retryContext.currentAttempt + 1,
      timestamp: new Date().toISOString(),
      duration: phaseResult.duration || 0,
      status: 'failed',
      gateResult,
      phaseResult,
      failureContext,
      outputSnapshot: await this.captureOutputSnapshot(phaseDef),
      improvements: this.analyzeImprovements(retryContext.lastGateResult, gateResult),
      regressions: this.analyzeRegressions(retryContext.lastGateResult, gateResult)
    };

    retryContext.attempts.push(attempt);
    retryContext.currentAttempt++;
    retryContext.lastGateResult = gateResult;
    retryContext.failureHistory.push(failureContext);

    // Determine retry strategy
    const retryDecision = await this.shouldRetry(phaseId, retryContext, gateResult);
    this.debugLogger?.log('retry', 'retry-decision', {
      phaseId,
      shouldRetry: retryDecision.shouldRetry,
      reason: retryDecision.reason,
      attemptNumber: retryContext.currentAttempt,
      maxRetries: retryContext.maxRetries
    });
    
    if (!retryDecision.shouldRetry) {
      // Save failure state for potential future resume
      await this.saveFailureStateForResume(phaseId, retryContext, failureContext);
      this.retryStatistics.totalRetries++;
      return retryDecision;
    }

    // Generate retry prompt with failure context
    const retryPrompt = await this.generateContextualRetryPrompt(
      phaseId, retryContext, failureContext
    );

    // Persist updated retry state
    await this.persistRetryState(phaseId, retryContext);

    this.retryStatistics.totalRetries++;
    this.retryStatistics.contextualRetries++;

    return {
      shouldRetry: true,
      retryStrategy: retryDecision.retryStrategy,
      retryPrompt,
      retryDelay: this.calculateRetryDelay(retryContext),
      retryContext,
      failureContext,
      adaptiveSettings: retryDecision.adaptiveSettings
    };
  }

  /**
   * Create comprehensive failure context
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseDef - Phase definition
   * @param {Object} gateResult - Quality gate result
   * @param {Object} phaseResult - Phase execution result
   * @returns {Object} Failure context
   */
  async createFailureContext(phaseId, phaseDef, gateResult, phaseResult) {
    const context = {
      phaseId,
      timestamp: new Date().toISOString(),
      failureType: this.classifyFailure(gateResult),
      gateResult: this.sanitizeGateResult(gateResult),
      phaseResult: this.sanitizePhaseResult(phaseResult),
      outputAnalysis: await this.analyzeCurrentOutputs(phaseDef),
      environmentContext: this.captureEnvironmentContext(),
      dependencyAnalysis: await this.analyzePhaseDependencies(phaseId, phaseDef),
      improvementHints: this.generateImprovementHints(gateResult, phaseDef)
    };

    this.failureContexts.set(phaseId, context);
    
    if (this.options.enableFailureContext) {
      await this.persistFailureContext(phaseId, context);
    }

    return context;
  }

  /**
   * Check for existing resume state from previous failures
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseDef - Phase definition
   * @returns {Object|null} Resume state if available
   */
  async checkForResumeState(phaseId, phaseDef) {
    const resumeFilePath = path.join(
      this.options.workingDirectory,
      this.options.contextDirectory,
      `${phaseId}-resume-state.json`
    );

    if (!fs.existsSync(resumeFilePath)) {
      return null;
    }

    try {
      const resumeData = JSON.parse(fs.readFileSync(resumeFilePath, 'utf8'));
      
      // Validate resume data is still relevant
      if (await this.isResumeStateValid(resumeData, phaseDef)) {
        return resumeData;
      } else {
        // Clean up stale resume state
        fs.unlinkSync(resumeFilePath);
        return null;
      }
    } catch (error) {
      console.warn(`Warning: Could not load resume state for ${phaseId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Resume phase retry from previous failure
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseDef - Phase definition
   * @param {Object} resumeState - Previous failure state
   * @returns {Object} Resumed retry context
   */
  resumePhaseRetry(phaseId, phaseDef, resumeState) {
    // Resume with the existing retry context
    const retryContext = {
      ...resumeState.retryContext,
      currentAttempt: resumeState.retryContext.currentAttempt,
      attempts: resumeState.retryContext.attempts,
      resumedFromFailure: true,
      resumeTimestamp: new Date().toISOString(),
      originalFailureTime: resumeState.failureTime
    };

    this.activeRetryContexts.set(phaseId, retryContext);
    this.failureContexts.set(phaseId, resumeState.failureContext);
    
    this.retryStatistics.resumedPhases++;

    console.log(`📋 Resumed ${phaseId}: ${retryContext.attempts.length} previous attempts, last score: ${resumeState.failureContext.gateResult?.score || 'unknown'}`);

    this.debugLogger?.log('retry', 'resume-phase-retry', {
      phaseId,
      previousAttempts: resumeState.retryContext?.attempts?.length || 0,
      lastScore: resumeState.failureContext?.gateResult?.score || 0
    });

    return retryContext;
  }

  /**
   * Analyze current outputs for context
   * @param {Object} phaseDef - Phase definition
   * @returns {Object} Output analysis
   */
  async analyzeCurrentOutputs(phaseDef) {
    const analysis = {
      timestamp: new Date().toISOString(),
      expectedFiles: [],
      existingFiles: [],
      missingFiles: [],
      emptyFiles: [],
      partialFiles: [],
      totalSize: 0
    };

    // Get expected files from output contract, fully qualified with baseDirectory when present
    const baseDir = this.options.workingDirectory;
    const baseDirectory = phaseDef.outputContract?.baseDirectory || '';
    if (phaseDef.outputContract?.requiredFiles) {
      analysis.expectedFiles = phaseDef.outputContract.requiredFiles.map(rel =>
        baseDirectory ? path.join(baseDirectory, rel) : rel
      );
    }

    // Analyze each expected file
    for (const filePath of analysis.expectedFiles) {
      const fullPath = path.join(baseDir, filePath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const fileInfo = {
          path: filePath,
          fullPath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          isEmpty: stats.size === 0,
          isPartial: await this.isFilePartial(fullPath, filePath)
        };
        
        analysis.existingFiles.push(fileInfo);
        analysis.totalSize += stats.size;
        
        if (stats.size === 0) {
          analysis.emptyFiles.push(filePath);
        } else if (fileInfo.isPartial) {
          analysis.partialFiles.push(filePath);
        }
      } else {
        analysis.missingFiles.push(filePath);
      }
    }

    return analysis;
  }


  /**
   * Generate contextual retry prompt with failure analysis (simplified with tempfile approach)
   * @param {string} phaseId - Phase identifier
   * @param {Object} retryContext - Retry context
   * @param {Object} failureContext - Failure context
   * @returns {string} Retry prompt
   */
  async generateContextualRetryPrompt(phaseId, retryContext, failureContext) {
    // With tempfile standardization, this becomes much simpler!
    // We just prepend retry context to the original prompt
    
    const basePrompt = await this.loadPhasePrompt(retryContext.phaseDef);
    const attemptNumber = retryContext.currentAttempt;
    
    // Create concise retry context sections
    // Add timestamp to help prevent caching
    const timestamp = new Date().toISOString();
    const retryContextHeader = `🔄 RETRY ${attemptNumber}/${retryContext.maxRetries}
${this.generateConciseFailureAnalysis(failureContext)}

**Fix these issues:**
${this.extractSpecificFailures(failureContext)}

This was what you were previously tasked to do:
---
`;

    // Simply prepend retry context to base prompt
    const retryPrompt = retryContextHeader + basePrompt;

    return retryPrompt;
  }

  /**
   * Extract specific failures from gate result
   * Strips ANSI codes and formats Playwright failures nicely without truncation
   * @param {Object} failureContext - Failure context
   * @returns {string} Formatted list of specific failures
   */
  extractSpecificFailures(failureContext) {
    if (!failureContext.gateResult?.reasons) return 'No specific failures identified';
    
    const retryContext = failureContext.gateResult.retryContext;
    
    // If we have structured failedTests from Playwright, format them nicely
    if (retryContext?.stage === 'playwright' && retryContext?.failedTests?.length > 0) {
      return retryContext.failedTests
        .slice(0, 5) // Show up to 5 failures
        .map(f => {
          const parts = [];
          if (f.test) parts.push(`Test: "${stripAnsi(f.test)}"`);
          if (f.file && f.line) parts.push(`  File: ${f.file}:${f.line}`);
          if (f.locator) parts.push(`  Locator: ${stripAnsi(f.locator)}`);
          if (f.expected) parts.push(`  Expected: ${stripAnsi(f.expected)}`);
          if (f.received) parts.push(`  Received: ${stripAnsi(String(f.received))}`);
          if (f.error && !f.locator) {
            // Show full error for non-locator errors (e.g., Prisma errors)
            parts.push(`  Error: ${stripAnsi(f.error)}`);
          }
          return `- ${parts.join('\n  ')}`;
        })
        .join('\n\n');
    }
    
    // Handle TypeScript/server errors specially
    if (retryContext?.stage === 'server_health' && retryContext?.tsErrors) {
      return `- TypeScript compilation errors:\n${stripAnsi(retryContext.tsErrors)}`;
    }
    
    // Fallback for test stages with rawOutput but empty failedTests
    if ((retryContext?.stage === 'playwright' || retryContext?.stage === 'vitest') && 
        retryContext?.rawOutput && 
        (!retryContext?.failedTests || retryContext.failedTests.length === 0)) {
      const isBackend = retryContext.stage === 'vitest';
      const testFile = retryContext.testFile || 'unknown test file';
      return `Test output couldn't be parsed. Test file: ${testFile}

Raw output:
\`\`\`
${stripAnsi(retryContext.rawOutput.slice(0, 1500))}
\`\`\`

**Action required**: Review the test file itself. The test may have:
${isBackend 
  ? '- Database/auth setup issues\n- Missing mock data or fixtures\n- Incorrect API response expectations'
  : '- A route that doesn\'t exist in your implementation\n- Selectors that don\'t match your components\n- Assumptions that need adjustment'}

Fix either the test or your implementation to match.`;
    }

    // Handle frontend test generation failures (gate-1-5)
    if (retryContext?.stage === 'frontend_test_generation') {
      const lines = [];
      if (retryContext.missingTests?.length > 0) {
        lines.push(`**Missing test files:** ${retryContext.missingTests.join(', ')}`);
      }
      if (retryContext.syntaxIssues?.length > 0) {
        lines.push('**Syntax issues:**');
        retryContext.syntaxIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.antiPatternIssues?.length > 0) {
        lines.push('**Anti-patterns detected:**');
        retryContext.antiPatternIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.insufficientCoverage?.length > 0) {
        lines.push('**Insufficient coverage:**');
        retryContext.insufficientCoverage.forEach(s => lines.push(`  - ${s}`));
      }
      if (lines.length > 0) return lines.join('\n');
    }

    // Handle backend test generation failures (gate-5-2)
    if (retryContext?.stage === 'backend_test_generation') {
      const lines = [];
      if (retryContext.missingTests?.length > 0) {
        lines.push(`**Missing test files:** ${retryContext.missingTests.map(t => `be-${t}.test.ts`).join(', ')}`);
      }
      if (retryContext.wrongImports?.length > 0) {
        lines.push('**Wrong imports (use Vitest, not Playwright):**');
        retryContext.wrongImports.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.noBackendImports?.length > 0) {
        lines.push('**Missing backend imports:**');
        retryContext.noBackendImports.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.syntaxIssues?.length > 0) {
        lines.push('**Syntax issues:**');
        retryContext.syntaxIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (lines.length > 0) return lines.join('\n');
    }

    // Handle backend integration failures (gate-7-1)
    if (retryContext?.stage === 'backend_integration') {
      const lines = [];
      if (retryContext.mockIssues?.length > 0) {
        lines.push('**Mock implementations to replace:**');
        retryContext.mockIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.todoStubIssues?.length > 0) {
        lines.push('**TODO stubs returning fake success:**');
        retryContext.todoStubIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.placeholderIssues?.length > 0) {
        lines.push('**Placeholder URLs to replace:**');
        retryContext.placeholderIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.actionIssues?.length > 0) {
        lines.push('**Missing actions:**');
        retryContext.actionIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.fetcherIssues?.length > 0) {
        lines.push('**Missing data fetchers:**');
        retryContext.fetcherIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.dependencyIssues?.length > 0) {
        lines.push('**Dependency issues:**');
        retryContext.dependencyIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.modelIssues?.length > 0) {
        lines.push('**Model issues:**');
        retryContext.modelIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (retryContext.jobIssues?.length > 0) {
        lines.push('**Background job issues:**');
        retryContext.jobIssues.forEach(s => lines.push(`  - ${s}`));
      }
      if (lines.length > 0) return lines.join('\n');
    }

    // Handle polish audit failures (gate-3-2, gate-7-2)
    if (retryContext?.stage === 'frontend_polish_audit' || retryContext?.stage === 'full_polish_audit') {
      if (retryContext.issues?.length > 0) {
        const lines = ['**Audit validation issues:**'];
        retryContext.issues.forEach(s => lines.push(`  - ${s}`));
        return lines.join('\n');
      }
    }
    
    // Fallback: show reasons without truncation, but strip ANSI
    const reasons = failureContext.gateResult.reasons || [];
    return reasons
      .slice(0, 5)
      .map(r => `- ${stripAnsi(r)}`)
      .join('\n');
  }

  

  /**
   * Generate failure analysis section
   * @param {Object} failureContext - Failure context
   * @returns {string} Failure analysis section
   */
  generateFailureAnalysisSection(failureContext) {
    const sections = [];
    
    sections.push('### 📊 FAILURE ANALYSIS');
    
    // Gate result analysis
    if (failureContext.gateResult) {
      const score = failureContext.gateResult.score || 0;
      const threshold = 0.8; // Default threshold
      sections.push(`**Quality Gate Score**: ${score.toFixed(3)} / ${threshold} (${((score/threshold)*100).toFixed(1)}% of target)`);
      
      if (failureContext.gateResult.reasons?.length > 0) {
        sections.push('**Specific Issues**:');
        failureContext.gateResult.reasons.forEach((reason, index) => {
          sections.push(`${index + 1}. ${reason}`);
        });
      }
      
      if (failureContext.gateResult.criticalFailures?.length > 0) {
        sections.push('**Critical Failures**:');
        failureContext.gateResult.criticalFailures.forEach((failure, index) => {
          sections.push(`⚠️ ${index + 1}. ${failure}`);
        });
      }
    }
    
    // Failure type classification
    sections.push(`**Failure Type**: ${failureContext.failureType.type} (${failureContext.failureType.severity} severity)`);
    
    return sections.join('\n');
  }


  /**
   * Generate output status section
   * @param {Object} outputAnalysis - Output analysis
   * @returns {string} Output status section
   */
  generateOutputStatusSection(outputAnalysis) {
    const sections = [];
    sections.push('### 📄 OUTPUT STATUS');
    
    sections.push(`**Files**: ${outputAnalysis.existingFiles.length} exist, ${outputAnalysis.missingFiles.length} missing, ${outputAnalysis.emptyFiles.length} empty`);
    sections.push(`**Total Size**: ${this.formatFileSize(outputAnalysis.totalSize)}`);
    
    if (outputAnalysis.missingFiles.length > 0) {
      sections.push('**Missing Files** (must create):');
      outputAnalysis.missingFiles.forEach(file => {
        sections.push(`❌ ${file}`);
      });
    }
    
    if (outputAnalysis.emptyFiles.length > 0) {
      sections.push('**Empty Files** (need content):');
      outputAnalysis.emptyFiles.forEach(file => {
        sections.push(`⚠️ ${file}`);
      });
    }
    
    if (outputAnalysis.partialFiles.length > 0) {
      sections.push('**Partial Files** (need completion):');
      outputAnalysis.partialFiles.forEach(file => {
        sections.push(`🔧 ${file}`);
      });
    }
    
    return sections.join('\n');
  }

  /**
   * Generate improvement guidance section
   * @param {Object} retryContext - Retry context
   * @param {Object} failureContext - Failure context
   * @returns {string} Improvement guidance section
   */
  generateImprovementGuidanceSection(retryContext, failureContext) {
    const sections = [];
    sections.push('### 💡 IMPROVEMENT GUIDANCE');
    
    // Attempt-specific guidance
    const attemptGuidance = this.getAttemptSpecificGuidance(retryContext.currentAttempt);
    if (attemptGuidance) {
      sections.push(attemptGuidance);
    }
    
    // Improvement hints from failure context
    if (failureContext.improvementHints?.length > 0) {
      sections.push('**Specific Improvements Needed**:');
      failureContext.improvementHints.forEach((hint, index) => {
        sections.push(`${index + 1}. ${hint.hint} (${hint.priority} priority)`);
      });
    }
    
    // Progress analysis
    if (retryContext.attempts.length > 1) {
      const progressAnalysis = this.analyzeProgressTrend(retryContext);
      sections.push(`**Progress Trend**: ${progressAnalysis}`);
    }
    
    return sections.join('\n');
  }

  /**
   * Generate resume context section if applicable
   * @param {Object} retryContext - Retry context
   * @returns {string|null} Resume context section
   */
  generateResumeContextSection(retryContext) {
    if (!retryContext.resumedFromFailure) {
      return null;
    }

    return `### 🔄 RESUME CONTEXT
**Resumed From**: Previous failure at ${retryContext.originalFailureTime}
**Previous Attempts**: ${retryContext.attempts.length}
**Resume Strategy**: Build upon existing work while addressing previous failure points
**Time Since Failure**: ${this.formatTimeDifference(retryContext.originalFailureTime, retryContext.resumeTimestamp)}`;
  }

  /**
   * Handle successful retry completion
   * @param {string} phaseId - Phase identifier
   * @param {Object} gateResult - Successful gate result
   */
  async handleRetrySuccess(phaseId, gateResult) {
    const retryContext = this.activeRetryContexts.get(phaseId);
    if (!retryContext) return;

    this.retryStatistics.successfulRetries++;

    // Clean up retry state files
    await this.cleanupRetryState(phaseId);

    // Log success metrics
    const duration = Date.now() - retryContext.startTime;
    const attempts = retryContext.currentAttempt + 1;
    
    console.log(`✅ Retry success for ${phaseId}: ${attempts} attempts, ${Math.round(duration/1000)}s total`);
    this.debugLogger?.log('retry', 'retry-success', {
      phaseId,
      attempts,
      totalDurationMs: duration,
      finalScore: gateResult?.score || 0
    });

    // Clean up active context
    this.activeRetryContexts.delete(phaseId);
    this.failureContexts.delete(phaseId);
  }

  /**
   * Determine if phase should be retried
   * @param {string} phaseId - Phase identifier
   * @param {Object} retryContext - Retry context
   * @param {Object} gateResult - Quality gate result
   * @returns {Object} Retry decision
   */
  async shouldRetry(phaseId, retryContext, gateResult) {
    // Check basic retry limits
    if (retryContext.currentAttempt >= retryContext.maxRetries) {
      return {
        shouldRetry: false,
        reason: `Maximum retries (${retryContext.maxRetries}) exceeded`,
        finalContext: await this.generateFinalFailureContext(retryContext)
      };
    }

    // Only skip retry for truly critical failures (not missing files or content issues)
    if (gateResult.criticalFailures?.length > 0) {
      const trulyBlocking = gateResult.criticalFailures.some(failure => 
        failure.toLowerCase().includes('fatal') ||
        failure.toLowerCase().includes('corrupted') ||
        failure.toLowerCase().includes('invalid json format') ||
        failure.toLowerCase().includes('code execution error')
      );
      
      // Don't block retry for: "system" (too generic), "missing files", "directory structure"
      
      if (trulyBlocking) {
        return {
          shouldRetry: false,
          reason: 'Truly critical failures detected (fatal/corrupted/invalid) - retry not recommended',
          criticalFailures: gateResult.criticalFailures
        };
      }
    }

    // Check for improvement potential
    const improvementAnalysis = this.analyzeImprovementPotential(retryContext, gateResult);
    if (!improvementAnalysis.hasImprovementPotential) {
      return {
        shouldRetry: false,
        reason: improvementAnalysis.reason,
        stagnationDetected: true
      };
    }

    // Determine retry strategy
    const retryStrategy = this.determineRetryStrategy(retryContext, gateResult);

    return {
      shouldRetry: true,
      retryStrategy,
      improvementGuidance: improvementAnalysis.guidance,
      adaptiveSettings: this.calculateAdaptiveSettings(retryContext)
    };
  }

  /**
   * Get phase-specific max retries
   * @param {Object} phaseDef - Phase definition
   * @returns {number} Max retries for phase
   */
  getPhaseMaxRetries(phaseDef) {
    return phaseDef.retryConfig?.maxRetries || this.options.maxRetries;
  }

  /**
   * Calculate retry delay with stepped backoff and jitter
   * @param {Object} retryContext - Retry context
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(retryContext) {
    // Use configured delays or default stepped delays: 10s, 20s, 60s, 180s
    const defaultDelays = [10000, 20000, 60000, 180000];
    const delays = this.options.retryDelays || defaultDelays;
    
    const attempt = retryContext.currentAttempt || 0;
    const baseDelay = delays[Math.min(attempt, delays.length - 1)];
    
    // Add ±20% jitter to prevent thundering herd
    const jitter = baseDelay * (0.8 + Math.random() * 0.4);
    
    return Math.round(jitter);
  }

  /**
   * Persist retry state to disk
   * @param {string} phaseId - Phase identifier
   * @param {Object} retryContext - Retry context
   */
  async persistRetryState(phaseId, retryContext) {
    if (!this.options.enableFailureContext) return;

    try {
      const stateFile = path.join(
        this.options.workingDirectory,
        this.options.contextDirectory,
        `${phaseId}-retry-state.json`
      );

      const stateData = {
        retryContext: {
          ...retryContext,
          // Remove circular references and large objects
          phaseDef: {
            id: retryContext.phaseDef.id,
            name: retryContext.phaseDef.name,
            description: retryContext.phaseDef.description,
            promptFile: retryContext.phaseDef.promptFile,
            qualityGate: retryContext.phaseDef.qualityGate,
            outputContract: retryContext.phaseDef.outputContract,
            executionMode: retryContext.phaseDef.executionMode,
            swarmConfig: retryContext.phaseDef.swarmConfig,
            dynamicPhaseGeneration: retryContext.phaseDef.dynamicPhaseGeneration
          }
        },
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
      this.debugLogger?.log('retry', 'persist-retry-state', {
        phaseId,
        stateFile,
        currentAttempt: retryContext.currentAttempt,
        maxRetries: retryContext.maxRetries
      });
    } catch (error) {
      console.warn(`Warning: Could not persist retry state for ${phaseId}: ${error.message}`);
    }
  }

  /**
   * Save failure state for potential resume
   * @param {string} phaseId - Phase identifier
   * @param {Object} retryContext - Retry context
   * @param {Object} failureContext - Failure context
   */
  async saveFailureStateForResume(phaseId, retryContext, failureContext) {
    if (!this.options.enableResume) return;

    try {
      const resumeFile = path.join(
        this.options.workingDirectory,
        this.options.contextDirectory,
        `${phaseId}-resume-state.json`
      );

      const resumeData = {
        phaseId,
        retryContext: {
          ...retryContext,
          phaseDef: {
            id: retryContext.phaseDef.id,
            name: retryContext.phaseDef.name,
            description: retryContext.phaseDef.description,
            promptFile: retryContext.phaseDef.promptFile,
            qualityGate: retryContext.phaseDef.qualityGate,
            outputContract: retryContext.phaseDef.outputContract,
            executionMode: retryContext.phaseDef.executionMode,
            swarmConfig: retryContext.phaseDef.swarmConfig,
            dynamicPhaseGeneration: retryContext.phaseDef.dynamicPhaseGeneration
          }
        },
        failureContext,
        failureTime: new Date().toISOString(),
        canResume: true
      };

      fs.writeFileSync(resumeFile, JSON.stringify(resumeData, null, 2));
      console.log(`💾 Saved resume state for ${phaseId} - can be resumed later`);
      this.debugLogger?.log('retry', 'persist-resume-state', {
        phaseId,
        resumeFile
      });
    } catch (error) {
      console.warn(`Warning: Could not save resume state for ${phaseId}: ${error.message}`);
    }
  }

  /**
   * Clean up retry state files
   * @param {string} phaseId - Phase identifier
   */
  async cleanupRetryState(phaseId) {
    const files = [
      `${phaseId}-retry-state.json`,
      `${phaseId}-resume-state.json`,
      `${phaseId}-failure-context.json`
    ];

    for (const filename of files) {
      try {
        const filepath = path.join(
          this.options.workingDirectory,
          this.options.contextDirectory,
          filename
        );
        
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          this.debugLogger?.log('retry', 'cleanup-retry-state', {
            phaseId,
            file: filepath
          });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Ensure context directory exists
   */
  ensureContextDirectory() {
    // Try relative path first, then /workspace fallback
    let contextDir = this.options.contextDirectory;
    if (!fs.existsSync(contextDir)) {
      const fallbackContextDir = path.join('/workspace', this.options.contextDirectory);
      if (fs.existsSync(fallbackContextDir)) {
        contextDir = fallbackContextDir;
      }
    }
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
  }

  // Additional helper methods would go here...
  // (truncated for brevity, but would include all the analysis methods)

  /**
   * Get retry statistics
   * @returns {Object} Retry statistics
   */
  getRetryStatistics() {
    const total = this.retryStatistics.totalRetries;
    const successful = this.retryStatistics.successfulRetries;
    
    return {
      ...this.retryStatistics,
      successRate: total > 0 ? (successful / total) : 0,
      activeRetries: this.activeRetryContexts.size
    };
  }

  /**
   * Generate concise failure analysis (simplified for tempfile approach)
   * @param {Object} failureContext - Failure context
   * @returns {string} Concise failure analysis
   */
  generateConciseFailureAnalysis(failureContext) {
    if (!failureContext.gateResult) return 'Previous attempt failed validation';
    
    const score = failureContext.gateResult.score || 0;
    return `Score: ${(score * 100).toFixed(0)}% - Focus on fixing critical issues below`;
  }

  /**
   * Generate concise output status (simplified for tempfile approach)
   * @param {Object} outputAnalysis - Output analysis
   * @returns {string} Concise output status
   */
  generateConciseOutputStatus(outputAnalysis) {
    if (!outputAnalysis) return 'No output analysis available';
    
    const parts = [];
    parts.push(`**Files**: ${outputAnalysis.existingFiles?.length || 0} exist, ${outputAnalysis.missingFiles?.length || 0} missing`);
    
    if (outputAnalysis.missingFiles?.length > 0) {
      parts.push(`**Missing**: ${outputAnalysis.missingFiles.join(', ')}`);
    }
    
    if (outputAnalysis.emptyFiles?.length > 0) {
      parts.push(`**Empty**: ${outputAnalysis.emptyFiles.join(', ')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Generate key improvements (simplified for tempfile approach)
   * @param {Object} retryContext - Retry context
   * @param {Object} failureContext - Failure context
   * @returns {string} Key improvements
   */
  generateKeyImprovements(retryContext, failureContext) {
    const improvements = [];
    
    // Attempt-specific guidance
    const attempt = retryContext.currentAttempt + 1;
    if (attempt === 2) {
      improvements.push('- Focus on the most critical missing elements first');
    } else if (attempt === 3) {
      improvements.push('- Consider alternative approaches if same issues persist');
    } else if (attempt >= 4) {
      improvements.push('- Final attempt: ensure minimum requirements are met');
    }
    
    // Failure-specific improvements
    if (failureContext.gateResult?.reasons) {
      const topReason = failureContext.gateResult.reasons[0];
      if (topReason?.includes('missing') || topReason?.includes('not found')) {
        improvements.push('- Create all required output files before content improvement');
      } else if (topReason?.includes('coverage') || topReason?.includes('incomplete')) {
        improvements.push('- Review input requirements systematically for gaps');
      } else if (topReason?.includes('quality') || topReason?.includes('detail')) {
        improvements.push('- Improve content depth and specificity');
      }
    }
    
    return improvements.length > 0 ? improvements.join('\n') : '- Address the specific issues identified above';
  }


  // Simplified placeholder methods for helper functions
  classifyFailure(gateResult) { return { type: 'quality_gate', severity: 'medium' }; }
  sanitizeGateResult(gateResult) { return gateResult; }
  sanitizePhaseResult(phaseResult) { return phaseResult; }
  captureEnvironmentContext() { return { timestamp: new Date().toISOString() }; }
  analyzePhaseDependencies(phaseId, phaseDef) { return { dependencies: [] }; }
  generateImprovementHints(gateResult, phaseDef) { return []; }
  captureOutputSnapshot(phaseDef) { return { files: [] }; }
  analyzeImprovements(prev, current) { return []; }
  analyzeRegressions(prev, current) { return []; }
  isResumeStateValid(resumeData, phaseDef) { return true; }
  isFilePartial(fullPath, filePath) { return false; }
  loadPhasePrompt(phaseDef) { 
    try {
      const promptFile = phaseDef.promptFile || 'phases/default.md';
      
      // Try relative path first, then /workspace fallback
      if (fs.existsSync(promptFile)) {
        return fs.readFileSync(promptFile, 'utf8');
      } else {
        const fallbackPath = path.join('/workspace', promptFile);
        if (fs.existsSync(fallbackPath)) {
          return fs.readFileSync(fallbackPath, 'utf8');
        }
      }
      
      return 'Default phase prompt - original file not found';
    } catch (error) {
      return 'Default phase prompt - original file not found';
    }
  }
  generateSuccessRequirements(retryContext, failureContext) { return 'Meet quality gate requirements'; }
  generateFocusedStrategy(retryContext, failureContext) { return 'Focus on addressing specific failure points'; }
  getAttemptSpecificGuidance(attemptNumber) { return `Attempt ${attemptNumber} guidance`; }
  analyzeProgressTrend(retryContext) { return 'Analyzing progress...'; }
  formatTimeDifference(from, to) { return 'some time ago'; }
  generateFinalFailureContext(retryContext) { return { summary: 'Final failure analysis' }; }
  analyzeImprovementPotential(retryContext, gateResult) { return { hasImprovementPotential: true }; }
  determineRetryStrategy(retryContext, gateResult) { return { name: 'progressive', approach: 'systematic' }; }
  calculateAdaptiveSettings(retryContext) { return {}; }
  persistFailureContext(phaseId, context) { return Promise.resolve(); }
  formatFileSize(bytes) { return `${Math.round(bytes / 1024)} KB`; }
}

module.exports = RetryManager;
