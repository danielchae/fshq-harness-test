/**
 * Continuous Testing Integration
 * Adds automated browser-based testing at key checkpoints in the build workflow.
 * Supports both Claude and Gemini CLI providers with MCP validation.
 * 
 * ARCHITECTURE (Hybrid Approach):
 * 
 * 1. Server Health (Fast, Every File Write)
 *    - Claude Code hooks run check-or-start-dev-server.sh after writes
 *    - If server crashes, agent sees error immediately and can fix
 *    - No browser testing, just HTTP health check
 * 
 * 2. Browser Testing (Thorough, Less Frequent)
 *    - This module runs full browser-based testing with MCP tools
 *    - Takes screenshots, checks console errors, validates UI
 *    - Runs at MILESTONES (integration checks) and every N build phases
 * 
 * This hybrid approach gives:
 * - Fast feedback on compilation errors (hooks)
 * - Thorough functional testing at checkpoints (this module)
 * - Significantly reduced build time vs testing every phase
 */

const fs = require('fs');
const path = require('path');
const Tester = require('./tester');

class ContinuousTestingIntegration {
  /**
   * Validate environment and MCP configuration for the provider
   */
  static validateEnvironment(orchestrator) {
    const workingDir = orchestrator.options.workingDirectory;
    const provider = orchestrator.workflowManager?.directAgentConfig?.continuousTestingProvider || 'claude';
    
    const issues = [];
    const warnings = [];
    
    console.log(`🔍 Validating environment for ${provider} continuous testing...`);
    
    if (provider === 'gemini') {
      // Check Gemini-specific requirements
      
      // 1. Check for GEMINI_API_KEY
      if (!process.env.GEMINI_API_KEY) {
        issues.push('GEMINI_API_KEY environment variable not set');
      }
      
      // 2. Check for .gemini/settings.json (MCP config)
      const geminiSettingsPath = path.join(workingDir, '.gemini', 'settings.json');
      if (fs.existsSync(geminiSettingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(geminiSettingsPath, 'utf8'));
          if (settings.mcpServers?.['chrome-devtools']) {
            console.log('   ✓ chrome-devtools MCP configured for Gemini');
          } else {
            warnings.push('chrome-devtools MCP not configured in .gemini/settings.json');
          }
        } catch (e) {
          warnings.push(`Could not parse .gemini/settings.json: ${e.message}`);
        }
      } else {
        warnings.push('No .gemini/settings.json found - MCP tools may be unavailable');
      }
      
      // 3. Check if Chrome is running (for browser MCP)
      const chromeCheck = this._checkChromeRunning();
      if (!chromeCheck) {
        warnings.push('Chrome not detected on port 9222 - browser testing will be limited');
      } else {
        console.log('   ✓ Chrome DevTools accessible on port 9222');
      }
      
    } else if (provider === 'claude') {
      // Check Claude-specific requirements
      
      // 1. Check for ANTHROPIC_API_KEY
      if (!process.env.ANTHROPIC_API_KEY) {
        issues.push('ANTHROPIC_API_KEY environment variable not set');
      }
      
      // 2. Check for .mcp.json
      const mcpConfigPath = path.join(workingDir, '.mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
          if (mcpConfig.mcpServers?.['chrome-devtools']) {
            console.log('   ✓ chrome-devtools MCP configured for Claude');
          }
        } catch (e) {
          warnings.push(`Could not parse .mcp.json: ${e.message}`);
        }
      } else {
        warnings.push('No .mcp.json found - MCP tools may be unavailable');
      }
    }
    
    // Check log directory exists
    const logDir = path.join(workingDir, 'log');
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        console.log('   ✓ Created log directory');
      } catch (e) {
        warnings.push(`Could not create log directory: ${e.message}`);
      }
    }
    
    // Report findings
    if (issues.length > 0) {
      console.log('   ❌ Issues found:');
      issues.forEach(i => console.log(`      - ${i}`));
    }
    if (warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      warnings.forEach(w => console.log(`      - ${w}`));
    }
    
    return {
      valid: issues.length === 0,
      issues,
      warnings,
      provider
    };
  }
  
  /**
   * Check if Chrome is running with debugging port
   */
  static _checkChromeRunning() {
    try {
      const { execSync } = require('child_process');
      const result = execSync('curl -s http://localhost:9222/json/version 2>/dev/null', { timeout: 2000 });
      return result && result.toString().includes('webSocketDebuggerUrl');
    } catch {
      return false;
    }
  }

  /**
   * Ensure Chrome is running, restart if needed.
   * Called before browser-based testing to guarantee Chrome availability.
   * @returns {boolean} true if Chrome is available after check/restart
   */
  static ensureChromeRunning() {
    const { execSync } = require('child_process');
    
    // Quick check first - if Chrome is healthy, return immediately
    if (this._checkChromeRunning()) {
      return true;
    }
    
    console.log('🔄 Chrome not responding, attempting restart...');
    
    try {
      // Run the self-healing Chrome script
      execSync('bash /workspace/scripts/check-or-start-chrome.sh', {
        timeout: 30000,
        stdio: ['ignore', 'inherit', 'inherit']
      });
      
      // Verify it's now running
      if (this._checkChromeRunning()) {
        console.log('✅ Chrome restarted successfully');
        return true;
      } else {
        console.warn('⚠️  Chrome restart script completed but Chrome still not responding');
        return false;
      }
    } catch (error) {
      console.error(`❌ Chrome restart failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Add testing to orchestrator
   */
  static async enhance(orchestrator) {
    // Check if disabled
    if (process.env.DISABLE_CONTINUOUS_TESTING === 'true' || 
        process.env.CONTINUOUS_TESTING === 'false') {
      console.log('📌 Continuous testing disabled');
      return;
    }

    console.log('🔧 Adding continuous testing...');
    
    // Validate environment
    const validation = this.validateEnvironment(orchestrator);
    if (!validation.valid) {
      console.log('❌ Cannot enable continuous testing due to configuration issues');
      return;
    }
    
    // Create tester instance
    const tester = new Tester({
      workingDirectory: orchestrator.options.workingDirectory,
      directAgentResolver: (isFirstMessage, sessionId) => {
        if (!orchestrator.workflowManager?.buildDirectAgentSessionArgs) {
          return null;
        }
        return orchestrator.workflowManager.buildDirectAgentSessionArgs(isFirstMessage, sessionId);
      }
    });

    // Store on orchestrator
    orchestrator.continuousTester = tester;

    // Phase descriptions for clearer messages
    const phaseDescriptions = {
      'phase-4': 'Gate validated: Frontend testing and validation passed.',
      'phase-2': 'Gate validated: New frontend component built and tested.',
      'phase-6': 'Gate validated: New backend component built and tested.'
    };

    // Counter for build phases to run browser testing every N phases
    // Server health is now handled by Claude Code hooks after every file write
    let buildPhaseCounter = 0;
    const BROWSER_TEST_INTERVAL = 5; // Run full browser testing every 5 build phases

    // Hook into executeAndValidateGate to test AFTER gates pass
    const originalExecuteGate = orchestrator.executeAndValidateGate.bind(orchestrator);
    orchestrator.executeAndValidateGate = async function(phaseDef, gateContext, isJustGate) {
      // Run the original gate validation
      const result = await originalExecuteGate(phaseDef, gateContext, isJustGate);
      
      // Gate passed if we get here (it throws on failure)
      const gateId = phaseDef.qualityGate?.file?.replace('gates/', '').replace('.md', '').replace('.js', '');
      
      // Identify build phase gates (phase-2 and phase-6 dynamic phases)
      const isBuildPhaseGate = 
        gateId?.startsWith('gate-2-composite') ||
        gateId?.startsWith('gate-6-composite');
      
      // Always test on major milestones (integration checks and phase-4)
      const isMilestoneGate = 
        gateId === 'gate-4-frontend-validator' ||
        gateId === 'gate-7-1-integration-validator';
      
      // Increment counter for build phases
      if (isBuildPhaseGate) {
        buildPhaseCounter++;
        console.log(`📊 Build phase ${buildPhaseCounter} completed (browser test every ${BROWSER_TEST_INTERVAL})`);
      }
      
      // Determine if we should run browser testing
      const shouldTest = 
        isMilestoneGate || // Always test milestones
        (isBuildPhaseGate && buildPhaseCounter % BROWSER_TEST_INTERVAL === 0); // Every N build phases
      
      if (shouldTest) {
        const testReason = isMilestoneGate 
          ? `Milestone gate: ${gateId}` 
          : `Every ${BROWSER_TEST_INTERVAL} build phases (phase ${buildPhaseCounter})`;
        console.log(`🧪 Running browser testing: ${testReason}`);
        
        // Ensure Chrome is healthy before browser testing
        const chromeReady = ContinuousTestingIntegration.ensureChromeRunning();
        if (!chromeReady) {
          console.warn('⚠️  Chrome unavailable - browser testing will run in limited mode');
        }
        
        // Initialize on first test
        if (!tester.isInitialized) {
          try {
            console.log('🔧 Initializing continuous testing for the first time...');
            const initialized = await tester.initialize();
            if (!initialized) {
              console.warn('⚠️  Testing initialization returned false - continuing in limited mode');
            }
          } catch (error) {
            console.warn(`⚠️  Testing initialization failed: ${error.message}`);
            // Non-blocking - continue without testing
            return result;
          }
        }
        
        // Get appropriate description
        let description = phaseDescriptions[phaseDef.id];
        if (!description) {
          if (phaseDef.id.startsWith('phase-2-')) {
            description = phaseDescriptions['phase-2'];
          } else if (phaseDef.id.startsWith('phase-6-')) {
            description = phaseDescriptions['phase-6'];
          } else {
            description = `We validated ${phaseDef.name || phaseDef.id} successfully.`;
          }
        }
        
        console.log(`🔍 Testing after ${gateId} passed...`);
        
        try {
          await tester.testApp(description);
        } catch (error) {
          console.warn(`⚠️  Testing failed: ${error.message}`);
          // Non-blocking - continue workflow
        }
      }
      
      return result;
    };

    // Cleanup on completion
    const originalComplete = orchestrator.completeWorkflow.bind(orchestrator);
    orchestrator.completeWorkflow = async function() {
      if (tester) {
        tester.cleanup();
      }
      return await originalComplete();
    };

    console.log(`✅ Continuous testing ready (${validation.provider})`);
    if (validation.warnings.length > 0) {
      console.log(`   Note: ${validation.warnings.length} warnings - browser testing may be limited`);
    }
  }
}

module.exports = ContinuousTestingIntegration;
