/**
 * Autonomous Nuclear Restart Module
 * Makes the orchestrator self-sufficient - no wrapper needed
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutonomousRestart {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.orchestratorPath = options.orchestratorPath || path.join(this.workingDirectory, 'orchestrator.js');
    this.workflowPath = options.workflowPath || path.join(this.workingDirectory, 'workflow.json');
  }


  /**
   * Kill all claude-flow processes
   */
  async killClaudeFlowProcesses() {
    console.log('   Killing all claude-flow processes...');
    
    return new Promise((resolve) => {
      const kill = spawn('pkill', ['-9', '-f', 'claude-flow'], {
        shell: true
      });
      
      kill.on('close', () => {
        console.log('   ✅ Processes terminated');
        resolve();
      });
      
      // Even if pkill fails (no processes), continue
      kill.on('error', () => resolve());
      
      // Timeout after 3 seconds
      setTimeout(resolve, 3000);
    });
  }

  /**
   * Track failed phase for nuclear restart
   */
  trackFailedPhase(phaseId) {
    const trackFile = path.join(this.workingDirectory, '.last-failed-phase');
    fs.writeFileSync(trackFile, phaseId, 'utf8');
  }
  
  /**
   * Find the failed phase from tracking file
   */
  findFailedPhase() {
    // Use simple tracking file
    const trackFile = path.join(this.workingDirectory, '.last-failed-phase');
    if (fs.existsSync(trackFile)) {
      const phaseId = fs.readFileSync(trackFile, 'utf8').trim();
      return phaseId;
    }
    
    // Fallback: check /workspace path
    const workspaceTrackFile = '/workspace/.last-failed-phase';
    if (fs.existsSync(workspaceTrackFile)) {
      const phaseId = fs.readFileSync(workspaceTrackFile, 'utf8').trim();
      return phaseId;
    }
    
    return null;
  }

  /**
   * Perform autonomous nuclear restart
   * This runs INSIDE the orchestrator process before exit
   */
  async performNuclearRestart(phaseId) {
    console.log('\n🔥 NUCLEAR RESTART - AUTONOMOUS MODE');
    console.log('   Orchestrator will restart itself...');
    
    // Track the failed phase if provided
    if (phaseId) {
      this.trackFailedPhase(phaseId);
    }
    
    // Kill claude-flow processes
    await this.killClaudeFlowProcesses();
    
    // Wait for stabilization
    console.log('   Waiting 3 seconds for system stabilization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Determine failed phase
    const failedPhase = phaseId || this.findFailedPhase();
    
    if (!failedPhase) {
      console.log('   ❌ Could not determine failed phase - exiting');
      process.exit(1);
    }
    
    console.log(`   🚀 Restarting from phase: ${failedPhase}`);
    
    // Build restart command
    const args = [
      this.orchestratorPath,
      `--workflow=${this.workflowPath}`,
      `--start=${failedPhase}`
    ];
    
    console.log(`   Executing: node ${args.join(' ')}`);
    
    // Spawn new orchestrator process
    const child = spawn('node', args, {
      cwd: this.workingDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        NUCLEAR_RESTART: 'true',
        RESUMED_FROM_PHASE: failedPhase
      }
    });
    
    // Handle child process completion
    child.on('exit', (code) => {
      console.log(`\n   Nuclear restart completed with exit code: ${code}`);
      
      if (code === 0) {
        // Success
        console.log('   ✅ Nuclear restart successful');
      } else if (code === 99) {
        // Another nuclear restart requested - already flagged, just exit
        console.log('   ⚠️  Nested nuclear restart prevented');
      }
      
      // Exit with child's code
      process.exit(code || 0);
    });
    
    child.on('error', (err) => {
      console.error('   ❌ Failed to restart orchestrator:', err.message);
      process.exit(1);
    });
  }

  /**
   * Install nuclear restart handler in orchestrator
   * Call this from orchestrator's triggerNuclearRestart
   */
  static async handleNuclearExit(orchestrator, phaseDef, failureReason) {
    const restart = new AutonomousRestart({
      workingDirectory: orchestrator.options.workingDirectory
    });
    
    // Track the failed phase
    restart.trackFailedPhase(phaseDef.id);
    
    // Save failure state
    orchestrator.processMonitor.markPhaseFailed(phaseDef.id, failureReason);
    
    // Perform autonomous restart
    await restart.performNuclearRestart(phaseDef.id);
    
    // This line should never be reached (process.exit in performNuclearRestart)
    // But if it does, exit with 99 for wrapper compatibility
    process.exit(99);
  }
}

module.exports = AutonomousRestart;