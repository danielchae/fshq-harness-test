/**
 * Continuous Tester
 * Maintains a persistent AI session to test the app throughout the workflow.
 * Supports both Claude and Gemini CLI providers.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TokenTracker = require('../token-tracker');

// Timeout configuration (in milliseconds)
const TIMEOUTS = {
  INIT: 300000,      // 5 minutes for initialization
  TEST: 420000,      // 7 minutes for subsequent tests
  KILL_GRACE: 5000   // 5 seconds grace period after timeout before force kill
};

class Tester {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.sessionId = crypto.randomUUID();
    this.isInitialized = false;
    this.directAgentResolver = options.directAgentResolver || null;
    this.tokenTracker = new TokenTracker({ workingDirectory: this.workingDirectory });
    this.provider = null;  // Detected provider (claude/gemini)
    this.initAttempts = 0;
    this.maxInitAttempts = 2;
  }

  /**
   * Initialize testing session with full gate prompt
   */
  async initialize() {
    console.log(`🤖 Starting continuous testing session...`);
    
    // Detect provider before initialization
    this._detectProvider();
    
    const gatePromptPath = path.join(
      this.workingDirectory,
      'gates',
      'gate-0-continuous-testing.md'
    );

    if (!fs.existsSync(gatePromptPath)) {
      console.warn('⚠️  gate-0-continuous-testing.md not found');
      return false;
    }

    const gatePrompt = fs.readFileSync(gatePromptPath, 'utf8')
      .replace(/\{\{SESSION_ID\}\}/g, this.sessionId)
      .replace(/\{\{CURRENT_PHASE\}\}/g, 'phase-1')
      .replace(/\{\{PROVIDER\}\}/g, this.provider || 'unknown');

    try {
      this.initAttempts++;
      const result = await this._sendWithTimeout(gatePrompt, true, TIMEOUTS.INIT);
      
      if (result.success) {
        console.log('✅ Testing session initialized');
        this.isInitialized = true;
        return true;
      }
      
      // Check for tool unavailability in response
      if (result.output?.includes('tools not available') || 
          result.output?.includes('health_check_only')) {
        console.log('⚠️  Browser tools unavailable - running in limited mode');
        this.isInitialized = true;  // Still mark as initialized for health checks
        return true;
      }
      
      return false;
    } catch (error) {
      const isTimeout = error.message.includes('timed out');
      const timeoutSeconds = Math.round(TIMEOUTS.INIT / 1000);
      const promptChars = gatePrompt.length;
      console.error(
        `❌ Failed to initialize testing: ${error.message} ` +
        `(provider=${this.provider || 'unknown'}, timeout=${timeoutSeconds}s, ` +
        `promptChars=${promptChars}, attempt=${this.initAttempts}/${this.maxInitAttempts})`
      );
      
      // Retry once on timeout
      if (isTimeout && this.initAttempts < this.maxInitAttempts) {
        console.log('🔄 Retrying initialization with simpler prompt...');
        return this._initializeSimple();
      }
      
      return false;
    }
  }

  /**
   * Simplified initialization when full prompt times out
   */
  async _initializeSimple() {
    const simplePrompt = `You are a testing agent. Check if http://localhost:3000 is accessible and responding. Return JSON: { "tested": true, "app_status": "running|error", "working": true|false }`;
    
    try {
      const result = await this._sendWithTimeout(simplePrompt, true, TIMEOUTS.INIT);
      if (result.success) {
        console.log('✅ Testing session initialized (limited mode)');
        this.isInitialized = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Simple initialization also failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Detect which provider is being used
   */
  _detectProvider() {
    if (typeof this.directAgentResolver === 'function') {
      const resolved = this.directAgentResolver(true, this.sessionId);
      this.provider = resolved?.provider || 'claude';
    } else {
      this.provider = 'claude';
    }
    console.log(`🧪 Continuous tester using ${this.provider} CLI`);
  }

  /**
   * Test the application - simple message
   */
  async testApp(description) {
    if (!this.isInitialized) {
      console.warn('⚠️  Testing session not initialized');
      return;
    }

    console.log(`🔍 Testing: ${description.substring(0, 50)}...`);

    const simplePrompt = `${description} Please test the application again at http://localhost:3000 and fix any issues you find.

Reminder: Do NOT run these commands:
- Never run \`npm run build\` or \`pnpm build\` (crashes the orchestrator).
- Never run \`pkill -f node\` or broad kill commands (kills the orchestrator).
- Do not run \`npm install\` / \`pnpm install\` unless explicitly instructed.`;

    try {
      const result = await this._sendWithTimeout(simplePrompt, false, TIMEOUTS.TEST);
      
      if (result.success) {
        this._logTestResult(result.output);
      }
    } catch (error) {
      console.error(`❌ Testing failed: ${error.message}`);
      // Non-blocking - continue workflow
    }
  }

  /**
   * Log test result from output
   */
  _logTestResult(output) {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const status = JSON.parse(jsonMatch[0]);
        console.log(`✅ Testing complete: ${status.app_status || 'done'}`);
        if (status.fixes_applied?.length > 0) {
          console.log(`   Fixed: ${status.fixes_applied.join(', ')}`);
        }
        if (status.issues_found?.length > 0) {
          console.log(`   Issues: ${status.issues_found.join(', ')}`);
        }
      } else {
        console.log('✅ Testing complete');
      }
    } catch {
      console.log('✅ Testing complete');
    }
  }

  /**
   * Send command with timeout wrapper
   */
  async _sendWithTimeout(prompt, isFirstMessage, timeout) {
    return Promise.race([
      this._sendCommand(prompt, isFirstMessage),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Command timed out after ${timeout / 1000}s`));
        }, timeout);
      })
    ]);
  }

  /**
   * Send command to AI provider
   */
  async _sendCommand(prompt, isFirstMessage = false) {
    return new Promise((resolve, reject) => {
      // Write prompt to temp file
      const tmpDir = path.join(this.workingDirectory, '.tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tempFile = path.join(tmpDir, `continuous-test-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, prompt, 'utf8');
      
      let providerLabel = 'claude';
      let command = 'claude';
      let args = null;

      if (typeof this.directAgentResolver === 'function') {
        const resolved = this.directAgentResolver(isFirstMessage, this.sessionId);
        if (resolved?.command) {
          providerLabel = resolved.provider || providerLabel;
          command = resolved.command;
          args = Array.isArray(resolved.args) ? [...resolved.args] : null;
        }
      }

      // Default args for Claude if not resolved
      if (!args) {
        args = [
          '--print',
          '--output-format', 'json',
          '--dangerously-skip-permissions',
          '--mcp-config', '/workspace/.mcp.json'
        ];
        if (isFirstMessage) {
          args.push('--session-id', this.sessionId);
        } else {
          args.push('--resume', this.sessionId);
        }
      }

      const fullCommand = `cat ${tempFile} | ${command} ${args.join(' ')}`;
      
      if (process.env.DEBUG_TESTING) {
        console.log(`[DEBUG] Command: ${fullCommand}`);
        console.log(`[DEBUG] Provider: ${providerLabel}`);
        console.log(`[DEBUG] Session ID: ${this.sessionId}`);
      }
      
      const child = spawn(fullCommand, {
        cwd: this.workingDirectory,
        shell: true,
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';
      let killed = false;

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', async (code, signal) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
        
        if (process.env.DEBUG_TESTING) {
          console.log(`[DEBUG] Exit code: ${code}, Signal: ${signal}`);
          if (errorOutput) console.log(`[DEBUG] Stderr: ${errorOutput.substring(0, 500)}`);
        }
        
        // Track tokens (non-blocking)
        try {
          await this.tokenTracker.trackFromOutput(output, providerLabel);
        } catch {
          // Ignore token tracking errors
        }
        
        if (killed) {
          reject(new Error('Process was killed due to timeout'));
          return;
        }
        
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            // Handle both Claude (result) and Gemini (response) formats
            const outputText = result.result || result.response || output;
            resolve({
              success: true,
              output: outputText,
              sessionId: result.session_id || this.sessionId
            });
          } catch {
            // If not JSON, still consider success
            resolve({
              success: true,
              output: output,
              sessionId: this.sessionId
            });
          }
        } else {
          let errorMsg = `${providerLabel} exited with code ${code}`;
          if (signal) errorMsg += ` (signal: ${signal})`;
          if (errorOutput) {
            // Truncate long error messages
            const truncatedError = errorOutput.substring(0, 500);
            errorMsg += `: ${truncatedError}`;
          }
          reject(new Error(errorMsg));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Store reference to kill if needed
      this._currentChild = child;
      this._killChild = () => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, TIMEOUTS.KILL_GRACE);
      };
    });
  }

  /**
   * Kill any running command
   */
  abort() {
    if (this._killChild) {
      console.log('🛑 Aborting continuous testing command...');
      this._killChild();
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    console.log('🧹 Testing session complete');
    this.abort();
  }
}

module.exports = Tester;
