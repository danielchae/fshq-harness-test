/**
 * Process Monitor Module
 * Monitors detached processes and manages phase lifecycle
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ProcessMonitor {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.checkInterval = options.checkInterval || 5000;  // Default 5 seconds
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 1000;
    this.debugLogger = options.debugLogger || null;
    
    this.activePhases = new Map();
    this.phaseResults = new Map();
    this.checkIntervalId = null;
  }
  
  /**
   * Start monitoring active phases
   */
  startMonitoring(onPhaseComplete) {
    // Check for completion more frequently (every second)
    // But only log status on the checkInterval
    let lastStatusLog = 0;
    this.debugLogger?.log('monitor', 'start-monitoring', {
      pollIntervalMs: 1000,
      checkInterval: this.checkInterval
    });
    
    this.checkIntervalId = setInterval(async () => {
      const now = Date.now();
      // const shouldLog = this.checkInterval != false && (now - lastStatusLog) >= this.checkInterval;
      
      // // Show active phases status only on checkInterval
      // if (shouldLog && this.activePhases.size > 0) {
      //   for (const [phaseId, phaseInfo] of this.activePhases.entries()) {
      //     const duration = Math.round((Date.now() - phaseInfo.startTime) / 1000);
      //     console.log(`⏳ Phase ${phaseId} working (${duration}s elapsed) [PID: ${phaseInfo.process.pid}]`);
      //   }
      //   lastStatusLog = now;
      // }
      
      const results = await this.checkPhaseStatus();
      // Handle any completed phases immediately
      for (const { phaseId, result } of results) {
        if (onPhaseComplete) {
          await onPhaseComplete(phaseId, result);
        }
      }
    }, 1000); // Check every second for completion
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    console.log(`🛑 Monitoring loop stopped`);
    this.debugLogger?.log('monitor', 'stop-monitoring', {});
  }
  
  /**
   * Track a new active phase
   */
  trackPhase(phaseId, phaseDef, process) {
    this.activePhases.set(phaseId, {
      phaseDef,
      process,
      startTime: Date.now(),
      status: 'running',
      retryCount: 0,
      gateRetryCount: 0,
      processingGate: false
    });
    
    console.log(`✅ Phase ${phaseId} kicked off in detached process (PID: ${process.pid})`);
    this.debugLogger?.log('monitor', 'phase-tracked', {
      phaseId,
      pid: process.pid,
      promptFile: phaseDef.promptFile,
      retryAttempt: phaseDef.retryAttempt || 0
    });
  }
  
  /**
   * Check the status of all active phases
   */
  async checkPhaseStatus() {
    const results = [];
    
    for (const [phaseId, phaseInfo] of this.activePhases.entries()) {
      const result = await this.checkSinglePhaseStatus(phaseId, phaseInfo);
      if (result) {
        results.push({ phaseId, result });
      }
    }
    
    return results;
  }
  
  /**
   * Check status of a single phase
   */
  async checkSinglePhaseStatus(phaseId, phaseInfo, silent = false) {
    const { process, startTime, phaseDef, processingGate } = phaseInfo;
    
    // Skip if already processing gate for this phase
    if (processingGate) {
      return;
    }
    
    // Check if process is still running (including hive-mind manual completion)
    if (process.killed || process.exitCode !== null || process.hiveMindCompleted || process.swarmCompleted) {
      // Mark as processing gate immediately to prevent duplicate detection
      phaseInfo.processingGate = true;
      
      // Process has finished
      const endTime = process.phaseInfo?.endTime || Date.now();
      const duration = endTime - startTime;
      
      const exitCode = process.exitCode !== null ? process.exitCode : (process.hiveMindCompleted ? 0 : 1);
      
      // Store result
      const result = {
        phaseId,
        name: phaseDef.name,
        sparcMode: phaseDef.sparcMode,
        exitCode,
        duration,
        completed: exitCode === 0,
        timestamp: new Date().toISOString(),
        output: process.phaseInfo?.output || '',
        errorOutput: process.phaseInfo?.errorOutput || '',
        debugArtifacts: process.phaseInfo?.debugArtifacts || null
      };
      this.debugLogger?.log('monitor', 'phase-process-exited', {
        phaseId,
        exitCode,
        duration,
        retryAttempt: phaseDef.retryAttempt || 0,
        hiveMindCompleted: process.hiveMindCompleted || false,
        swarmCompleted: process.swarmCompleted || false
      });
      
      // Clean up temp files if any
      if (process.tempPromptFile) {
        this.cleanupFile(process.tempPromptFile);
      }
      
      return result;
    } else {
      // Process is still running - don't log individual phase status here
      // Status will be shown in the main monitoring summary
      return null;
    }
  }
  
  /**
   * Monitor hive-mind output for completion signals
   */
  monitorHiveMindOutput(child, executionMode) {
    if (executionMode !== 'hive-mind' && executionMode !== '__fallback_default') {
      return;
    }
    
    let sessionId = null;
    let completionDetected = false;
    let output = '';
    let errorOutput = '';
    
    const handleOutput = (data, isStderr = false) => {
      const chunk = data.toString();
      
      // Accumulate output for regular monitoring
      if (isStderr) {
        errorOutput += chunk;
      } else {
        output += chunk;
      }
      
      // Extract session ID
      const sessionMatch = chunk.match(/Session ID: (session-[a-z0-9-]+)/);
      if (sessionMatch && !sessionId) {
        sessionId = sessionMatch[1];
        child.sessionId = sessionId;
        console.log(`🔗 Extracted session ID: ${sessionId}`);
      }
      
      // Monitor for completion signals
      // Swarm completion detection
      if (chunk.includes('"type":"result","subtype":"success"') || chunk.includes('SWARM EXECUTION COMPLETE')) {
        if (!completionDetected) {
          completionDetected = true;
          console.log(`✅ Swarm execution completed successfully!`);
          child.swarmCompleted = true;
          child.exitCode = 0;
          return; // Let the process exit naturally
        }
      }
      
      // Hive-mind idle detection  
      if (chunk.includes('Performance auto-tuned: concurrency_decreased')) {
        if (!completionDetected && sessionId) {
          completionDetected = true;
          console.log(`🎯 Hive-mind idle detected (concurrency decreased)! Stopping session ${sessionId}...`);
          
          // Stop the hive-mind session
          // Prefer global command, fallback to npx with specific version
          const version = process.env.CLAUDE_FLOW_VERSION || 'latest';
          let stopCmd = 'claude-flow';
          let stopArgs = ['hive-mind', 'stop', sessionId];
          
          try {
            require('child_process').execSync('claude-flow --version', { stdio: 'ignore', timeout: 30000 });
          } catch (_) {
            // Global not available, fallback to npx
            stopCmd = 'npx';
            stopArgs = ['--yes', `claude-flow@${version}`, 'hive-mind', 'stop', sessionId];
          }

          const stopChild = spawn(stopCmd, stopArgs, {
            cwd: this.workingDirectory,
            stdio: 'inherit'
          });
          
          stopChild.on('close', (code) => {
            console.log(`🛑 Session ${sessionId} stop command completed with code ${code}`);
            // Mark as manually completed and kill the process
            child.hiveMindCompleted = true;
            child.exitCode = 0; // Set exit code for monitoring logic
            try {
              process.kill(child.pid, 'SIGTERM');
              console.log(`🔪 Killed hive-mind process ${child.pid}`);
            } catch (error) {
              console.warn(`⚠️  Could not kill process ${child.pid}: ${error.message}`);
            }
            
            // Cleanup temp prompt file if it exists
            if (child.tempPromptFile) {
              this.cleanupFile(child.tempPromptFile);
            }
          });
        }
      }
    };
    
    child.stdout?.on('data', (data) => handleOutput(data, false));
    child.stderr?.on('data', (data) => handleOutput(data, true));
    
    // Store accumulated output on child for later use
    child.phaseOutput = { output, errorOutput };
  }
  
  /**
   * Mark phase as completed
   */
  markPhaseCompleted(phaseId, result) {
    this.phaseResults.set(phaseId, {
      ...result,
      status: 'completed'
    });
    this.activePhases.delete(phaseId);
    
    // Clean up stale resume state when phase succeeds
    this.cleanupResumeState(phaseId);
    this.debugLogger?.log('monitor', 'phase-mark-completed', {
      phaseId,
      duration: result.duration,
      exitCode: result.exitCode
    });
  }
  
  /**
   * Mark phase as failed
   */
  markPhaseFailed(phaseId, error, gateResult = null) {
    const phaseInfo = this.activePhases.get(phaseId);
    if (!phaseInfo) return;
    
    this.phaseResults.set(phaseId, {
      phaseId,
      name: phaseInfo.phaseDef.name,
      sparcMode: phaseInfo.phaseDef.sparcMode,
      status: 'failed',
      duration: Date.now() - phaseInfo.startTime,
      error: error.message || error,
      gateReasons: gateResult?.reasons || [],
      gateCriticalFailures: gateResult?.criticalFailures || [],
      retryCount: phaseInfo.retryCount || 0,
      timestamp: new Date().toISOString()
    });
    
    this.activePhases.delete(phaseId);
    this.debugLogger?.log('monitor', 'phase-mark-failed', {
      phaseId,
      error: error.message || error,
      retryCount: phaseInfo.retryCount || 0,
      gateCriticalFailures: gateResult?.criticalFailures || []
    });
  }
  
  /**
   * Update phase retry count
   */
  updatePhaseRetry(phaseId, retryCount) {
    const phaseInfo = this.activePhases.get(phaseId);
    if (phaseInfo) {
      phaseInfo.retryCount = retryCount;
      phaseInfo.processingGate = false;
    }
  }
  
  /**
   * Get current status summary
   */
  getStatus() {
    const activePhaseCount = this.activePhases.size;
    const completedPhaseCount = Array.from(this.phaseResults.values()).filter(p => p.status === 'completed').length;
    const failedPhaseCount = Array.from(this.phaseResults.values()).filter(p => p.status === 'failed').length;
    
    return {
      activePhases: activePhaseCount,
      completedPhases: completedPhaseCount,
      failedPhases: failedPhaseCount,
      activePhaseIds: Array.from(this.activePhases.keys()),
      phases: Array.from(this.phaseResults.values())
    };
  }
  
  /**
   * Stop all active phases
   */
  stopAllPhases() {
    for (const [phaseId, phaseInfo] of this.activePhases.entries()) {
      console.log(`🔪 Killing phase ${phaseId} (PID: ${phaseInfo.process.pid})`);
      try {
        phaseInfo.process.kill('SIGTERM');
      } catch (error) {
        console.warn(`⚠️  Could not kill process ${phaseInfo.process.pid}: ${error.message}`);
      }
      this.debugLogger?.log('monitor', 'phase-killed', {
        phaseId,
        pid: phaseInfo.process.pid
      });
    }
    this.activePhases.clear();
  }
  
  /**
   * Clean up temporary file
   */
  cleanupFile(filePath, silent = false) {
    try {
      if (fs.existsSync(filePath)) {
        // fs.unlinkSync(filePath); // DISABLED FOR DEBUGGING
        // File kept for debugging (silent)
        return true;
      }
    } catch (error) {
      if (!silent) console.warn(`⚠️  Failed to clean up ${path.basename(filePath)}: ${error.message}`);
    }
    return false;
  }
  
  /**
   * Clean up stale resume state when phase succeeds
   * @param {string} phaseId - Phase identifier
   */
  cleanupResumeState(phaseId) {
    try {
      const resumeFile = path.join(
        process.cwd(), 
        'log/retry-contexts',
        `${phaseId}-resume-state.json`
      );
      
      if (fs.existsSync(resumeFile)) {
        fs.unlinkSync(resumeFile);
        console.log(`🧹 Cleaned up stale resume state for ${phaseId}`);
        this.debugLogger?.log('monitor', 'cleanup-resume-state', {
          phaseId,
          file: resumeFile
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not cleanup resume state for ${phaseId}: ${error.message}`);
    }
  }
}

module.exports = ProcessMonitor;
