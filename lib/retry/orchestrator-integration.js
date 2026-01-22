/**
 * Orchestrator integration for the retry system.
 *
 * Provides seamless integration between the retry manager
 * and the orchestrator architecture.
 */

const RetryManager = require('./retry-manager');

class OrchestratorRetryIntegration {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.options = {
      enableRetrySystem: options.enableRetrySystem !== false,
      enableResume: options.enableResume !== false,
      enableFailureContext: options.enableFailureContext !== false,
      ...options
    };

    // Initialize retry manager
    this.retryManager = new RetryManager({
      workingDirectory: orchestrator.options.workingDirectory,
      maxRetries: orchestrator.options.maxRetries,
      baseRetryDelay: orchestrator.options.retryDelay,
      retryDelays: orchestrator.options.retryDelays,
      debugLogger: orchestrator.debugLogger,
      ...options
    });

    // Track integration state
    this.integrationActive = this.options.enableRetrySystem;
    this.originalMethods = new Map();
    
    if (this.integrationActive) {
      this.integrateWithOrchestrator();
    }
  }

  /**
   * Integrate the retry system with orchestrator
   */
  integrateWithOrchestrator() {
    // Store original methods for potential restoration
    this.originalMethods.set('handlePhaseFailure', this.orchestrator.handlePhaseFailure);
    this.originalMethods.set('handleGateFailure', this.orchestrator.handleGateFailure);
    this.originalMethods.set('startNextPhase', this.orchestrator.startNextPhase);

    // Override orchestrator methods with retry-aware versions
    this.orchestrator.handlePhaseFailure = this.handlePhaseFailure.bind(this);
    this.orchestrator.handleGateFailure = this.handleGateFailure.bind(this);
    this.orchestrator.startNextPhase = this.startNextPhaseWithRetry.bind(this);
  }

  /**
   * Phase failure handler with comprehensive retry logic
   * @param {Object} phaseDef - Phase definition
   * @param {Error} error - Phase error
   * @param {Object} actualGateResult - Optional actual gate result from validation
   */
  async handlePhaseFailure(phaseDef, error, actualGateResult = null) {
    const phaseId = phaseDef.id;
    
    try {
      // Initialize retry context if not exists
      if (!this.retryManager.activeRetryContexts.has(phaseId)) {
        await this.retryManager.initializePhaseRetry(phaseId, phaseDef, {
          workflowStatus: this.orchestrator.workflowStatus,
          currentPhaseIndex: this.orchestrator.workflowManager.currentPhaseIndex
        });
      }

      // Create phase result from error
      const phaseResult = {
        status: 'failed',
        error: error.message,
        duration: 0, // Would be calculated from actual execution time
        timestamp: new Date().toISOString()
      };

      // Use actual gate result if provided, otherwise create mock for process failures
      const gateResult = actualGateResult || {
        passed: false,
        score: 0,
        reasons: [`Process failure: ${error.message}`],
        criticalFailures: ['process_execution_failed'],
        timestamp: new Date().toISOString()
      };

      // Use retry logic with actual or mock gate result
      const retryDecision = await this.retryManager.handlePhaseFailure(
        phaseId, phaseDef, gateResult, phaseResult
      );

      const combinedErrorText = `${gateResult?.errorOutput || ''}\n${gateResult?.output || ''}\n${error?.message || ''}`;
      const hasOverloadSignal = /API Error:\s*529\b/i.test(combinedErrorText) ||
        /overloaded_error/i.test(combinedErrorText) ||
        /\brate[_-]?limit/i.test(combinedErrorText);

      if (retryDecision.shouldRetry) {
        console.log(`🔄 Retrying process failure in ${phaseId}`);
        if (hasOverloadSignal) {
          console.log(`⚠️  Detected API overload/rate-limit signal (e.g. 529); applying backoff before retry`);
        }
        
        // Apply backoff for process failures to handle API overload (529) errors
        // Delays: 10s, 20s, 60s, 180s - gives API time to recover
        const attempt = retryDecision.retryContext?.currentAttempt || 0;
        const defaultDelays = [10000, 20000, 60000, 180000]; // 10s, 20s, 1min, 3min
        const delays = this.orchestrator.options.retryDelays || defaultDelays;
        const baseDelay = delays[Math.min(attempt, delays.length - 1)];
        
        // Add ±20% jitter to prevent thundering herd
        const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
        
        console.log(`⏱️ Waiting ${Math.round(delay / 1000)}s before retry (attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await this.executeRetryAttempt(phaseDef, retryDecision);
        return;
      }

      console.error(`❌ Retry attempts exhausted for ${phaseId}: ${retryDecision.reason}`);

      // Attempt nuclear restart via orchestrator when retries are exhausted
      try {
        const retryContext = this.retryManager.activeRetryContexts.get(phaseId);
        const currentAttempt = retryContext?.currentAttempt ?? 0;
        await this.orchestrator.triggerNuclearRestart(
          phaseDef,
          'phase_failure',
          gateResult,
          currentAttempt
        );
      } catch (nuclearError) {
        console.error(`⚠️  Nuclear restart handoff failed: ${nuclearError.message}`);
      }
      
      // Mark phase as failed and stop workflow - DO NOT call original handlePhaseFailure
      // which would reset retry counters and create an infinite loop
      this.orchestrator.processMonitor.markPhaseFailed(phaseId, error);
      this.orchestrator.failWorkflow();
      return;
      
    } catch (integrationError) {
      console.error(`❌ Retry integration error: ${integrationError.message}`);
      // Fall back to original method
      return this.originalMethods.get('handlePhaseFailure').call(this.orchestrator, phaseDef, error);
    }
  }

  /**
   * Gate failure handler with contextual retry
   * @param {string} phaseId - Phase identifier
   * @param {Object} phaseInfo - Phase information
   * @param {Object} phaseDef - Phase definition
   * @param {Object} gateResult - Quality gate result
   */
  async handleGateFailure(phaseId, phaseInfo, phaseDef, gateResult) {
    try {
      // Initialize retry context if not exists
      if (!this.retryManager.activeRetryContexts.has(phaseId)) {
        await this.retryManager.initializePhaseRetry(phaseId, phaseDef, {
          workflowStatus: this.orchestrator.workflowStatus,
          currentPhaseIndex: this.orchestrator.workflowManager.currentPhaseIndex
        });
      }

      // Calculate phase duration
      const duration = Date.now() - phaseInfo.startTime;
      
      const phaseResult = {
        status: 'completed_with_gate_failure',
        duration,
        outputFiles: [], // Would be populated from actual scan
        timestamp: new Date().toISOString()
      };

      // Use retry logic
      const retryDecision = await this.retryManager.handlePhaseFailure(
        phaseId, phaseDef, gateResult, phaseResult
      );

      if (retryDecision.shouldRetry) {
        console.log(`🔄 Retrying gate failure for ${phaseId} (attempt ${retryDecision.retryContext.currentAttempt + 1}/${retryDecision.retryContext.maxRetries})`);
        console.log(`💡 Strategy: ${retryDecision.retryStrategy.name}`);
        
        // Apply retry delay if configured
        if (retryDecision.retryDelay && retryDecision.retryDelay > 0) {
          console.log(`⏱️ Waiting ${Math.round(retryDecision.retryDelay / 1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDecision.retryDelay));
        }
        
        // Clean up old phase tracking
        this.orchestrator.processMonitor.activePhases.delete(phaseId);
        
        // Execute retry with contextual prompt
        await this.executeRetryAttempt(phaseDef, retryDecision);
        return;
      }

      console.error(`❌ Retry attempts exhausted for ${phaseId}: ${retryDecision.reason}`);
      
      if (retryDecision.finalContext) {
        console.log('📊 Final Analysis:', JSON.stringify(retryDecision.finalContext, null, 2));
      }

      // Attempt nuclear restart via orchestrator when retries are exhausted
      try {
        const retryContext = this.retryManager.activeRetryContexts.get(phaseId);
        const currentAttempt = retryContext?.currentAttempt ?? 0;
        await this.orchestrator.triggerNuclearRestart(
          phaseDef,
          'gate_failure',
          gateResult,
          currentAttempt
        );
      } catch (nuclearError) {
        console.error(`⚠️  Nuclear restart handoff failed: ${nuclearError.message}`);
      }

      // Mark phase as failed and stop workflow - DO NOT call original handleGateFailure
      // which would reset retry counters and create an infinite loop
      this.orchestrator.processMonitor.markPhaseFailed(phaseId, 'Quality gate failed after retry attempts', gateResult);
      this.orchestrator.failWorkflow();
      
    } catch (integrationError) {
      console.error(`❌ Gate retry integration error: ${integrationError.message}`);
      // Fall back to original method
      return this.originalMethods.get('handleGateFailure').call(this.orchestrator, phaseId, phaseInfo, phaseDef, gateResult);
    }
  }

  /**
   * Phase startup with resume capability
   */
  async startNextPhaseWithRetry() {
    const phaseDef = this.orchestrator.workflowManager.getCurrentPhase();
    if (!phaseDef) {
      // No more phases to execute
      return;
    }
    const phaseId = phaseDef.id;

    // Check for resume capability before starting
    if (this.options.enableResume) {
      const resumeState = await this.retryManager.checkForResumeState(phaseId, phaseDef);
      
      if (resumeState) {
        console.log(`🔄 Resume opportunity detected for ${phaseId}`);
        console.log(`📋 Previous failure: ${resumeState.failureContext.failureType.type}`);
        console.log(`📊 Last score: ${resumeState.failureContext.gateResult?.score || 'unknown'}`);
        
        // Initialize with resume context
        await this.retryManager.initializePhaseRetry(phaseId, phaseDef, {
          workflowStatus: this.orchestrator.workflowStatus,
          currentPhaseIndex: this.orchestrator.workflowManager.currentPhaseIndex,
          resumeAvailable: true
        });
      }
    }

    // Call original startNextPhase method
    return this.originalMethods.get('startNextPhase').call(this.orchestrator);
  }

  /**
   * Execute a retry attempt using a contextual prompt (simplified with tempfile standardization)
   * @param {Object} phaseDef - Phase definition
   * @param {Object} retryDecision - Retry decision with contextual data
   */
  async executeRetryAttempt(phaseDef, retryDecision) {
    try {
      // Clean up stale MCP processes before retry to prevent resource leaks
      // This is especially important after gate timeouts which may leave orphaned processes
      try {
        this.orchestrator.phaseExecutor.cleanupStaleMCPProcesses();
      } catch (cleanupError) {
        console.warn(`⚠️  MCP cleanup warning: ${cleanupError.message}`);
      }
      
      // Since all execution modes now use tempfiles, this is much simpler!
      // The phase executor will automatically create a tempfile from the promptFile content
      // We just need to temporarily create a retry prompt file
      
      // Reduced logging: omit verbose retry diagnostics
      
      const retryPromptFile = await this.createRetryPromptFile(phaseDef, retryDecision.retryPrompt);
      this.orchestrator.debugLogger?.log('retry', 'retry-prompt-created', {
        phaseId: phaseDef.id,
        retryPromptFile,
        attemptNumber: (retryDecision.retryContext.currentAttempt || 0) + 1
      });
      
      // Store original prompt file and temporarily use the retry version
      const originalPromptFile = phaseDef.promptFile;
      phaseDef.promptFile = retryPromptFile;
      
      try {
        // Mark retry context BEFORE kicking off
        // Store the retry context in the phase definition so it persists
        phaseDef.retryContext = retryDecision.retryContext;
        phaseDef.retryAttempt = (retryDecision.retryContext.currentAttempt || 0) + 1;
        
        // Reduced logging: do not print retry prompt content
        
        // Use the orchestrator's kickOffPhase method directly
        // This ensures proper integration with ProcessMonitor's completion callbacks
        this.orchestrator.debugLogger?.log('retry', 'retry-attempt-start', {
          phaseId: phaseDef.id,
          retryAttempt: phaseDef.retryAttempt,
          promptFile: phaseDef.promptFile
        });
        await this.orchestrator.kickOffPhase(phaseDef);
        
        // The ProcessMonitor will handle completion and gate re-evaluation
        // We don't need to track it separately here
        
      } finally {
        // Restore original prompt file
        phaseDef.promptFile = originalPromptFile;
        delete phaseDef.retryAttempt;
        delete phaseDef.retryContext;
        
        // Clean up the retry prompt file after delay
        setTimeout(() => {
          this.cleanupRetryPromptFile(retryPromptFile);
        }, 60000);
      }
      
    } catch (error) {
      console.error(`❌ Failed to execute retry attempt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create retry prompt file (simplified with tempfile standardization)
   * @param {Object} phaseDef - Phase definition
   * @param {string} retryPrompt - Retry prompt content
   * @returns {string} Path to retry prompt file
   */
  async createRetryPromptFile(phaseDef, retryPrompt) {
    const fs = require('fs');
    const path = require('path');
    
    const workingDir = path.resolve(this.orchestrator.options.workingDirectory);
    const tempDir = path.join(workingDir, '.tmp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const retryFile = path.join(tempDir, `retry-${phaseDef.id}-${Date.now()}.md`);
    console.log(`📝 Creating retry prompt file: ${retryFile}`);

    fs.writeFileSync(retryFile, retryPrompt);

    this.orchestrator.debugLogger?.log('retry', 'retry-prompt-written', {
      phaseId: phaseDef.id,
      retryFile
    });

    return retryFile;
  }

  /**
   * Clean up retry prompt file
   * @param {string} retryFile - Path to retry prompt file
   */
  cleanupRetryPromptFile(retryFile) {
    try {
      const fs = require('fs');
      if (fs.existsSync(retryFile)) {
        fs.unlinkSync(retryFile);
        this.orchestrator.debugLogger?.log('retry', 'retry-prompt-cleanup', {
          retryFile
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not cleanup retry prompt file: ${error.message}`);
    }
  }

  /**
   * Handle successful retry completion
   * @param {string} phaseId - Phase identifier
   * @param {Object} gateResult - Successful gate result
   */
  async handleRetrySuccess(phaseId, gateResult) {
    if (!this.integrationActive) return;
    
    const retryContext = this.retryManager.activeRetryContexts.get(phaseId);
    if (!retryContext) return;

    // Calculate improvement metrics
    const improvement = {
      previousScore: retryContext.lastGateResult?.score || 0,
      currentScore: gateResult.score || 1,
      attempts: retryContext.currentAttempt + 1,
      duration: Date.now() - retryContext.startTime
    };

    console.log(`✅ Retry successful for ${phaseId} after ${improvement.attempts} attempts`);
    console.log(`📈 Score improvement: ${improvement.previousScore.toFixed(3)} → ${improvement.currentScore.toFixed(3)}`);
    console.log(`⏱️ Total retry time: ${Math.round(improvement.duration / 1000)}s`);
    this.orchestrator.debugLogger?.log('retry', 'retry-success-summary', {
      phaseId,
      attempts: improvement.attempts,
      previousScore: improvement.previousScore,
      currentScore: improvement.currentScore,
      durationMs: improvement.duration
    });

    await this.retryManager.handleRetrySuccess(phaseId, gateResult);
  }

  /**
   * Get retry statistics
   * @returns {Object} Retry statistics
   */
  getRetryStatistics() {
    if (!this.integrationActive) {
      return { enabled: false };
    }

    return {
      enabled: true,
      ...this.retryManager.getRetryStatistics(),
      integrationVersion: '1.0.0'
    };
  }

  /**
   * Check if phase can be resumed
   * @param {string} phaseId - Phase identifier
   * @returns {boolean} Whether phase can be resumed
   */
  async canResumePhase(phaseId) {
    if (!this.options.enableResume) return false;
    
    const phaseDef = this.orchestrator.workflowManager.phaseDefinitions.find(p => p.id === phaseId);
    if (!phaseDef) return false;
    
    const resumeState = await this.retryManager.checkForResumeState(phaseId, phaseDef);
    return resumeState !== null;
  }

  /**
   * Disable retry integration
   */
  disable() {
    if (!this.integrationActive) return;

    // Restore original methods
    for (const [methodName, originalMethod] of this.originalMethods) {
      this.orchestrator[methodName] = originalMethod;
    }

    this.integrationActive = false;
    console.log('🔧 Retry system disabled - reverted to original orchestrator methods');
  }

  /**
   * Enable retry integration
   */
  enable() {
    if (this.integrationActive) return;

    this.integrateWithOrchestrator();
    this.integrationActive = true;
  }
}

module.exports = OrchestratorRetryIntegration;
