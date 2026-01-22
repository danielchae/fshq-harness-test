/**
 * Samus Builder SPARC Orchestrator
 * High-level orchestration of SPARC workflows using modular components
 */

const path = require('path');
const fs = require('fs');

// Import modular components
const WorkflowManager = require('./lib/workflow-manager');
const PhaseExecutor = require('./lib/phase-executor');
const ProcessMonitor = require('./lib/process-monitor');
const FileUtils = require('./lib/file-utils');
const DebugLogger = require('./lib/debug-logger');
const TaskStatusUpdater = require('./lib/task-status-updater');

// Import retry system integration
const OrchestratorRetryIntegration = require('./lib/retry/orchestrator-integration');

// Import continuous testing integration (if available)
let ContinuousTestingIntegration = null;
try {
  ContinuousTestingIntegration = require('./lib/continuous-testing/orchestrator-integration');
} catch (_) {
  // Continuous testing is optional
}

// Import utility modules
const GateParser = require('./lib/gate-parser');
const GateContextGatherer = require('./lib/gate-context-gatherer');
const TokenTracker = require('./lib/token-tracker');

const VALIDATION = {
  MIN_RESPONSE_LENGTH: 10,
  REQUIRED_GATE_FIELDS: ['passed']
};

const GATE_TYPES = {
  JAVASCRIPT: '.js',
  MARKDOWN: '.md'
};

class DetachedSPARCOrchestrator {
  constructor(options = {}) {
    this.options = {
      namespace: 'cfbuild-detached',
      workingDirectory: process.cwd(),
      checkInterval: 5000,  // Single monitoring interval (5 seconds)
      maxRetries: 5,
      retryDelay: 2000,
      // Stepped retry delays: 10s, 20s, 1min, 3min (handles API overload gracefully)
      retryDelays: [10000, 20000, 60000, 180000],
      nonInteractive: true,
      workflowConfig: null,
      // Retry system options
      enableRetrySystem: options.enableRetrySystem !== false,
      enableResume: options.enableResume !== false,
      enableFailureContext: options.enableFailureContext !== false,
      ...options
    };
    
    // Initialize components
    this.workflowManager = new WorkflowManager(this.options);
    this.workflowId = this.workflowManager.workflowId;

    this.debugLogger = new DebugLogger({
      workingDirectory: this.options.workingDirectory,
      workflowId: this.workflowId
    });

    this.phaseExecutor = new PhaseExecutor({
      workingDirectory: this.options.workingDirectory,
      namespace: this.options.namespace,
      debugLogger: this.debugLogger
    });
    // PhaseExecutor for all execution
    this.processMonitor = new ProcessMonitor({
      workingDirectory: this.options.workingDirectory,
      checkInterval: this.options.checkInterval,
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
      debugLogger: this.debugLogger
    });
    this.monitoringStarted = false;
    
    // Set up ProcessMonitor callback
    this.processMonitor.onPhaseComplete = async (phaseId, result) => {
      // Check if this is a gate phase
      if (phaseId.startsWith('gate-')) {
        await this.handleGateCompletion(phaseId, result);
      } else {
        await this.handlePhaseCompletion(phaseId, result);
      }
    };
    
    // Initialize retry system
    if (this.options.enableRetrySystem) {
      this.retrySystem = new OrchestratorRetryIntegration(this, {
        enableRetrySystem: this.options.enableRetrySystem,
        enableResume: this.options.enableResume,
        enableFailureContext: this.options.enableFailureContext,
        maxRetries: this.options.maxRetries,
        baseRetryDelay: this.options.retryDelay
      });
    }
        
    this.workflowStatus = 'idle';
    // Ensure nuclear restart tracking set exists
    this.nuclearRestartedPhases = new Set();
    this.globalNuclearRestartAttempted = false;
    
    // Initialize token tracker for usage analytics
    this.tokenTracker = new TokenTracker({ workingDirectory: this.options.workingDirectory });
    
    // Checkpoint tracking for resume capability
    this.dynamicPhaseCounter = 0;        // Counter for dynamic phases (resets per parent phase)
    this.currentDynamicParent = null;    // Track current parent to reset counter on switch
    this.lastSnapshotBranch = null;      // Last successful snapshot branch name
    this.lastSnapshotPhase = null;       // Phase ID of last snapshot
  }
  
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    console.log(`🚀 Initializing SPARC Orchestrator`);
    console.log(`📋 Workflow ID: ${this.workflowId}`);
    this.debugLogger.log('orchestrator', 'initialize', {
      workflowId: this.workflowId,
      options: {
        workingDirectory: this.options.workingDirectory,
        namespace: this.options.namespace,
        maxRetries: this.options.maxRetries,
        retryDelay: this.options.retryDelay
      }
    });
    
    // Check if .swarm and .hive-mind directories exist
    const swarmDir = path.join(this.options.workingDirectory, '.swarm');
    const hiveMindDir = path.join(this.options.workingDirectory, '.hive-mind');
    
    if (!fs.existsSync(swarmDir) && !fs.existsSync(hiveMindDir)) {
      console.log('📌 Note: Claude Flow swarm directories not initialized');
    }
    
    if (!FileUtils.isClaudeFlowAvailable(this.options.workingDirectory)) {
      throw new Error('Claude-Flow not found locally. Please ensure it\'s available via npx or local installation.');
    }
    
    console.log(`✅ SPARC Orchestrator initialized successfully`);
    return true;
  }
  
  /**
   * Helper: Get workspace path
   */
  getWorkspacePath(...segments) {
    return path.join(this.options.workingDirectory, ...segments);
  }
  
  /**
   * Format phase progress for console display
   * Uses two-tier numbering: stable parent phase + sub-task position
   * @param {Object} phaseDef - Phase definition
   * @returns {string} Formatted progress string
   */
  formatPhaseProgress(phaseDef) {
    const parentNum = phaseDef.parentPhaseNumber || (this.workflowManager.currentPhaseIndex + 1);
    const totalParent = phaseDef.totalParentPhases || this.workflowManager.staticPhaseCount || this.workflowManager.phaseDefinitions.length;
    
    // Static phase (no sub-task)
    if (!phaseDef.subTaskNumber) {
      return `Phase ${parentNum}/${totalParent}: ${phaseDef.name}`;
    }
    
    // Dynamic sub-task
    const parentName = phaseDef._originalPhaseName || 'Build';
    return `Phase ${parentNum}/${totalParent}: ${parentName}\n   📦 Task ${phaseDef.subTaskNumber}/${phaseDef.totalSubTasks}: ${phaseDef.name}`;
  }
  
  logResourceSnapshot(event, extra = {}) {
    const snapshot = {
      event,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: null,
      processCount: null,
      ...extra
    };

    try {
      const mem = process.memoryUsage();
      snapshot.memory = {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers
      };
    } catch (_) {
      // best-effort only
    }

    try {
      const { execSync } = require('child_process');
      const out = execSync('ps -e --no-headers | wc -l', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000
      }).trim();
      const count = Number(out);
      if (Number.isFinite(count)) snapshot.processCount = count;
    } catch (_) {
      // best-effort only (ps can fail under EAGAIN)
    }

    try {
      // Format human-readable resource log
      const eventLabel = snapshot.event === 'phase-start' ? 'Phase Start' : 
                         snapshot.event === 'phase-exit' ? 'Phase Exit' : 
                         snapshot.event.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const memMB = snapshot.memory ? `${Math.round(snapshot.memory.rss / 1024 / 1024)}MB RSS, ${Math.round(snapshot.memory.heapUsed / 1024 / 1024)}MB heap` : 'N/A';
      const procs = snapshot.processCount !== null ? `${snapshot.processCount} procs` : '';
      const phase = snapshot.phaseId ? `phase=${snapshot.phaseId}` : '';
      const duration = snapshot.durationMs ? `duration=${Math.round(snapshot.durationMs / 1000)}s` : '';
      const exit = snapshot.exitCode !== undefined ? `exit=${snapshot.exitCode}` : '';
      const parts = [phase, memMB, procs, duration, exit].filter(Boolean).join(', ');
      console.log(`📊 Resources (${eventLabel}): ${parts}`);
    } catch (_) {
      // ignore
    }
  }
  
  /**
   * Helper: Check if gate is JavaScript
   */
  isJavaScriptGate(gateFile) {
    return gateFile.endsWith(GATE_TYPES.JAVASCRIPT);
  }

  /**
   * Read the last N lines of a text file without loading the whole thing.
   * Returns null if unavailable.
   */
  tailTextFile(filePath, { maxBytes = 16384, maxLines = 30 } = {}) {
    try {
      const stat = fs.statSync(filePath);
      const size = stat.size || 0;
      if (size <= 0) return null;

      const start = Math.max(0, size - maxBytes);
      const length = size - start;
      const fd = fs.openSync(filePath, 'r');
      try {
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, start);
        const text = buffer.toString('utf8');
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
        if (lines.length === 0) return null;
        return lines.slice(-maxLines).join('\n');
      } finally {
        try { fs.closeSync(fd); } catch (_) {}
      }
    } catch (_) {
      return null;
    }
  }

  printIndentedBlock(prefix, text) {
    if (!text) return;
    const lines = String(text).split(/\r?\n/);
    for (const line of lines) {
      console.log(`${prefix}${line}`);
    }
  }

  /**
   * Best-effort JSON parsing for JavaScript gate output.
   *
   * JS gates are expected to output JSON ONLY to stdout (the orchestrator parses stdout).
   * However, older gates (or unexpected errors) may leak human-readable logs into stdout.
   * This helper attempts to recover by locating the last JSON object in the text.
   */
  _tryParseJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Fast path: pure JSON
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      // fall through
    }

    // Recovery path: find the last line that starts a JSON object and parse from there
    const lines = trimmed.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim?.() || '';
      if (!line.startsWith('{')) continue;
      const candidate = lines.slice(i).join('\n').trim();
      try {
        return JSON.parse(candidate);
      } catch (_) {
        // keep searching upward
      }
    }

    return null;
  }

  _parseJavaScriptGateJson(gateResult) {
    return (
      this._tryParseJsonFromText(gateResult?.output) ||
      this._tryParseJsonFromText(gateResult?.errorOutput) ||
      null
    );
  }

  _isTransientLlmGateFailure(gateResult) {
    const text = `${gateResult?.errorOutput || ''}\n${gateResult?.output || ''}`;
    if (!text) return false;

    // Common transient provider failures seen in production logs
    if (/overloaded_error/i.test(text)) return true;
    if (/API Error:\s*(500|502|503|504|529)\b/i.test(text)) return true;
    if (/\brate[_-]?limit/i.test(text)) return true;

    return false;
  }
  
  /**
   * Helper: Check if phase is gate-only (no content to execute)
   */
  isGateOnlyPhase(phaseDef) {
    return !phaseDef.promptFile && !phaseDef.command && !phaseDef.scriptFile;
  }

  updateFrontendTaskStatus(phaseDef, status) {
    // Only update status for frontend build unit phases (phase-2 generates frontend tasks)
    if (!phaseDef?.buildUnit?.id) {
      return;
    }
    if (phaseDef._originalPhase !== 'phase-2') {
      return;
    }

    const taskId = phaseDef.buildUnit.id;
    const updated = TaskStatusUpdater.setFrontendTaskStatus(this.options.workingDirectory, taskId, status);
    if (updated) {
      console.log(`📌 Frontend task '${taskId}' status updated to '${status}'.`);
      this.debugLogger.log('task-status', 'frontend-status-updated', {
        taskId,
        status
      });
    }
  }
  
  /**
   * Validate that required MCP tools are available
   * Warns if browser tools are not configured but doesn't fail
   */
  async validateMCPTools() {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    try {
      // Check if claude CLI is available
      execSync('which claude', { stdio: 'ignore' });
      
      // Check if Chrome DevTools MCP is configured
      const mcpList = execSync('claude mcp list 2>/dev/null || true', { encoding: 'utf-8' });
      
      if (mcpList.includes('chrome-devtools')) {
        console.log('✅ Chrome DevTools MCP configured');
        this.debugLogger.log('orchestrator', 'mcp-validation-success', {
          message: 'Chrome DevTools MCP available'
        });
        return;
      }

      // Not in global registry - verify project config exists (preferred for one-shot phase/gate calls)
      const workingDir = this.options?.workingDirectory || process.cwd();
      const mcpConfigPath = path.join(workingDir, '.mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
          if (cfg?.mcpServers?.['chrome-devtools']) {
            console.log('✅ Chrome DevTools MCP configured via .mcp.json');
            this.debugLogger.log('orchestrator', 'mcp-validation-success', {
              message: 'Chrome DevTools MCP available via .mcp.json'
            });
            return;
          }
        } catch (_) {
          // fall through to warning
        }
      }

      // Chrome DevTools MCP not in list and no usable .mcp.json
      console.log('⚠️  Chrome DevTools MCP not detected (missing from `claude mcp list` and/or .mcp.json)');
      this.debugLogger.log('orchestrator', 'mcp-validation-warning', {
        message: 'Chrome DevTools MCP not detected',
        availableServers: mcpList.split('\n').filter(line => line.trim()),
        mcpConfigPath
      });
    } catch (error) {
      // Claude CLI not available or other error - not critical
      this.debugLogger.log('orchestrator', 'mcp-validation-skipped', {
        message: 'Could not validate MCP tools',
        error: error.message
      });
    }
  }
  
  /**
   * Start a complete CFBuild workflow in detached mode
   */
  async startWorkflow(workflowDefinition = {}, inputFiles = {}) {
    this.debugLogger.log('orchestrator', 'startWorkflow-called', {
      workflowId: this.workflowId,
      providedDefinition: workflowDefinition,
      inputFiles: Object.keys(inputFiles || {})
    });
    // Load workflow config
    if (this.options.workflowConfig) {
      if (!this.workflowManager.loadWorkflowConfig(this.options.workflowConfig)) {
        throw new Error('Failed to load workflow configuration');
      }
    }
    
    if (this.workflowManager.phaseDefinitions.length === 0) {
      throw new Error('No workflow configuration loaded! Please specify a workflow with --workflow=<config.json>');
    }
    
    // Claude Flow version from environment variable (or 'latest' as fallback)
    const cfVersion = process.env.CLAUDE_FLOW_VERSION || 'latest';
    console.log(`📦 Using claude-flow version ${cfVersion}`);
    this.debugLogger.log('orchestrator', 'claude-flow-version', {
      version: cfVersion,
      source: process.env.CLAUDE_FLOW_VERSION ? 'env' : 'default'
    });
    
    // Apply workflow settings
    this.applyWorkflowSettings();
    this.debugLogger.log('orchestrator', 'workflow-settings-applied', {
      effectiveOptions: {
        namespace: this.options.namespace,
        maxRetries: this.options.maxRetries,
        checkInterval: this.options.checkInterval
      }
    });
    
    // Initialize continuous testing if available (after workflow config loaded)
    if (ContinuousTestingIntegration) {
      try {
        await ContinuousTestingIntegration.enhance(this);
      } catch (error) {
        console.warn(`⚠️  Continuous testing setup failed: ${error.message}`);
        // Non-blocking - continue without testing
      }
    }
    
    // Validate that required MCP tools are available
    await this.validateMCPTools();
    
    this.workflowStatus = 'running';
    
    // Set starting phase if specified
    const phaseStartId = workflowDefinition.phaseStartId || process.env.CFBUILD_START_PHASE;
    const singlePhaseId = workflowDefinition.singlePhaseId;
    
    if (singlePhaseId) {
      // Run only the specified phase (--phase=xxx)
      this.workflowManager.setStartPhase(singlePhaseId, false);
    } else if (phaseStartId) {
      // Start from specified phase and continue (--start=xxx)
      this.workflowManager.setStartPhase(phaseStartId, true);
    }
    
    // Ensure output directories exist
    FileUtils.ensureOutputDirectories(this.options.workingDirectory, this.workflowManager.phaseDefinitions);
    
    // Start the first phase
    await this.startNextPhase();
    
    // Ensure monitoring loop is active
    if (!this.monitoringStarted) {
      this.processMonitor.startMonitoring(this.processMonitor.onPhaseComplete);
      this.monitoringStarted = true;
    }
    return {
      workflowId: this.workflowId,
      status: 'started',
      totalPhases: this.workflowManager.phaseDefinitions.length,
      currentPhase: this.workflowManager.currentPhaseIndex,
      message: 'Workflow started in detached mode'
    };
  }
  
  /**
   * Apply workflow settings to components
   */
  applyWorkflowSettings() {
    if (this.workflowManager.workflowSettings.checkInterval) {
      this.options.checkInterval = this.workflowManager.workflowSettings.checkInterval;
      this.processMonitor.checkInterval = this.workflowManager.workflowSettings.checkInterval;
    }
    if (this.workflowManager.workflowSettings.namespace) {
      this.options.namespace = this.workflowManager.workflowSettings.namespace;
      this.phaseExecutor.namespace = this.workflowManager.workflowSettings.namespace;
    }
    if (this.workflowManager.workflowSettings.retrySystem?.maxRetries) {
      this.options.maxRetries = this.workflowManager.workflowSettings.retrySystem.maxRetries;
      if (this.processMonitor) {
        this.processMonitor.maxRetries = this.options.maxRetries;
      }
    }
  }
  
  /**
   * Start the next phase in the sequence
   */
  async startNextPhase() {
    if (this.workflowStatus === 'failed') {
      console.log(`🛑 Workflow has failed. Not starting new phases.`);
      this.debugLogger.log('orchestrator', 'skip-start-next-phase', {
        reason: 'workflow-failed',
        currentPhaseIndex: this.workflowManager.currentPhaseIndex
      });
      return;
    }
    
    if (this.workflowManager.isComplete()) {
      await this.completeWorkflow();
      return;
    }
    
    const phaseDef = this.workflowManager.getCurrentPhase();
    this.debugLogger.log('phase', 'start-next-phase', {
      phaseId: phaseDef.id,
      name: phaseDef.name,
      index: this.workflowManager.currentPhaseIndex,
      totalPhases: this.workflowManager.phaseDefinitions.length,
      retryAttempt: phaseDef.retryAttempt || 0
    });
    
    // Ensure all previous logs are flushed before announcing new phase
    await new Promise(resolve => setImmediate(resolve));
    
    this.logResourceSnapshot('phase-start', {
      phaseId: phaseDef.id,
      parentPhaseNumber: phaseDef.parentPhaseNumber,
      totalParentPhases: phaseDef.totalParentPhases,
      subTaskNumber: phaseDef.subTaskNumber,
      totalSubTasks: phaseDef.totalSubTasks
    });
    console.log(`\n🚀 ${this.formatPhaseProgress(phaseDef)}`);
    
    try {
      await this.kickOffPhase(phaseDef);
    } catch (error) {
      console.error(`❌ Failed to start phase ${phaseDef.id}: ${error.message}`);
      this.debugLogger.log('phase', 'kickoff-error', {
        phaseId: phaseDef.id,
        error: error.message,
        stack: error.stack
      });
      await this.handlePhaseFailure(phaseDef, error);
    }
  }
  
  
  /**
   * Kick off a phase in a detached process
   */
  async kickOffPhase(phaseDef, improvedPrompt = null) {
    // Wait a tick to ensure previous logs are flushed
    await new Promise(resolve => setImmediate(resolve));
    
    // CRITICAL FIX: Check for dynamic phase generation FIRST
    // Generator phases need to create child phases before attempting execution
    if (phaseDef.dynamicPhaseGeneration?.enabled) {
      console.log(`🔄 Phase ${phaseDef.id} requires dynamic phase generation...`);
      this.debugLogger.log('phase', 'dynamic-generation-needed', {
        phaseId: phaseDef.id,
        mode: phaseDef.dynamicPhaseGeneration.mode,
        manifestPath: phaseDef.dynamicPhaseGeneration.manifestPath
      });
      
      // Generate the dynamic phases
      await this.workflowManager.generateDynamicPhases(phaseDef, this.options.workingDirectory);
      
      // After generation, the phase definitions have been updated
      // Move to next phase (which will be the first generated phase)
      this.workflowManager.nextPhase();
      
      // Start the first generated phase
      await this.startNextPhase();
      return;
    }
    
    // Handle snapshot-only phases (gitSnapshot set but no content/gate)
    // These phases exist solely to create a git snapshot checkpoint
    if (phaseDef.gitSnapshot && !phaseDef.promptFile && !phaseDef.command && !phaseDef.scriptFile && !phaseDef.qualityGate?.file) {
      console.log(`📸 Phase ${phaseDef.id} is snapshot-only - progressing directly`);
      this.debugLogger.log('phase', 'snapshot-only-phase', {
        phaseId: phaseDef.id,
        snapshotName: phaseDef.snapshotName || phaseDef.id
      });
      // Snapshot creation is handled by handlePhaseProgression when phaseDef.gitSnapshot is true
      await this.handlePhaseProgression(phaseDef);
      return;
    }
    
    // Check if phase has no content to execute (gate-only phase)
    if (!phaseDef.promptFile && !phaseDef.command && !phaseDef.scriptFile) {
      console.log(`🎯 Phase ${phaseDef.id} has no content to execute - running gate directly`);
      this.debugLogger.log('phase', 'gate-only-phase', {
        phaseId: phaseDef.id,
        qualityGate: phaseDef.qualityGate?.file
      });
      
      // Execute the gate directly without creating a process
      await this.executeGateOnlyPhase(phaseDef);
      
      return;
    }
    
    // Regular phase execution
    const executionMode = this.workflowManager.determineExecutionMode(phaseDef);
    console.log(`🎯 Using execution mode: ${executionMode} for phase ${phaseDef.id}`);
    this.debugLogger.log('phase', 'kickoff', {
      phaseId: phaseDef.id,
      executionMode,
      promptFile: phaseDef.promptFile,
      command: phaseDef.command,
      scriptFile: phaseDef.scriptFile,
      retryAttempt: phaseDef.retryAttempt || 0
    });
    
    const modeConfig = this.workflowManager.getModeConfiguration(executionMode);

    this.updateFrontendTaskStatus(phaseDef, 'in_progress');

    const phaseProcess = await this.phaseExecutor.kickOffPhase(phaseDef, modeConfig, improvedPrompt);
    
    this.processMonitor.monitorHiveMindOutput(phaseProcess, executionMode);
    this.processMonitor.trackPhase(phaseDef.id, phaseDef, phaseProcess);
  }
  
  /**
   * Execute a gate-only phase directly
   */
  async executeGateOnlyPhase(phaseDef) {
    // Safety check for undefined qualityGate
    if (!phaseDef.qualityGate?.file) {
      console.error(`❌ Phase ${phaseDef.id} has no qualityGate defined but was treated as gate-only`);
      this.debugLogger.log('gate', 'missing-quality-gate', {
        phaseId: phaseDef.id,
        hasQualityGate: Boolean(phaseDef.qualityGate),
        hasDynamicGeneration: Boolean(phaseDef.dynamicPhaseGeneration)
      });
      throw new Error(`Phase ${phaseDef.id} has no content to execute and no quality gate defined`);
    }
    
    console.log(`🔧 Running quality gate: ${phaseDef.qualityGate.file}`);
    this.debugLogger.log('gate', 'execute-gate-only', {
      phaseId: phaseDef.id,
      gateFile: phaseDef.qualityGate?.file
    });
    
    // For gate-only phases, gather context about what files have been created
    const gateContext = await GateContextGatherer.gatherContext(phaseDef, this.options.workingDirectory);
    
    try {
      await this.executeAndValidateGate(phaseDef, gateContext, false);
      
      // Add explicit completion log for gate-only phases
      console.log(`✅ Gate-only phase ${phaseDef.id} completed successfully`);
      this.debugLogger.log('gate', 'gate-only-success', {
        phaseId: phaseDef.id,
        gateFile: phaseDef.qualityGate?.file
      });
      
      // If we get here, gate passed - progress to next phase
      await this.handlePhaseProgression(phaseDef);
    } catch (error) {
      console.log(`❌ Gate-only phase failed: ${error.message}`);
      this.debugLogger.log('gate', 'gate-only-failure', {
        phaseId: phaseDef.id,
        gateFile: phaseDef.qualityGate?.file,
        error: error.message
      });
      this.failWorkflow();
    }
  }
  
  /**
   * Execute and validate a quality gate (consolidated logic)
   * @param {Object} phaseDef - Phase definition
   * @param {string} gateContext - Optional context for gate execution
   * @param {boolean} markPhaseCompleted - Whether to mark phase as completed
   * @returns {Object} Validation result
   * @throws {Error} If gate execution or validation fails
   */
  async executeAndValidateGate(phaseDef, gateContext = null, markPhaseCompleted = false) {
    // Execute the gate directly using PhaseExecutor
    const gatePhase = { qualityGate: phaseDef.qualityGate };
    const gateExecutionMode = this.workflowManager.determineExecutionMode(gatePhase);
    const gateModeConfig = this.workflowManager.getModeConfiguration(gateExecutionMode);    
    this.debugLogger.log('gate', 'execute-gate', {
      phaseId: phaseDef.id,
      gateFile: phaseDef.qualityGate?.file,
      executionMode: gateExecutionMode,
      markPhaseCompleted
    });
    
    // Ensure Chrome is running for gates that require browser testing
    // These gates use Chrome DevTools MCP for browser-based validation
    const browserGates = [
      'gate-3-1-ui-review-validator',
      'gate-3-frontend-validator',
      'gate-5b-integration-validator'
    ];
    const gateFile = phaseDef.qualityGate?.file || '';
    const needsBrowser = browserGates.some(g => gateFile.includes(g));
    
    if (needsBrowser) {
      console.log('🌐 Gate requires browser - ensuring Chrome is ready...');
      try {
        const { execSync } = require('child_process');
        execSync('bash /workspace/scripts/check-or-start-chrome.sh', {
          timeout: 30000,
          stdio: ['ignore', 'inherit', 'inherit']
        });
      } catch (error) {
        console.warn(`⚠️  Chrome restart attempt failed: ${error.message}`);
        // Continue anyway - gate may still work in limited mode
      }
    }
    
    // Retry API errors once after 2 seconds
    let gateResult = await this.phaseExecutor.executeGate(phaseDef.qualityGate.file, gateModeConfig, gateContext, phaseDef);
    
    // Retry transient LLM provider errors with exponential backoff (LLM gates only)
    if (!this.isJavaScriptGate(phaseDef.qualityGate.file)) {
      const maxAttempts = 3; // total attempts including the initial execution
      let attempt = 1;

      while (attempt < maxAttempts && gateResult.exitCode !== 0 && this._isTransientLlmGateFailure(gateResult)) {
        const baseDelayMs = 2000;
        const jitterMs = Math.floor(Math.random() * 500);
        const delayMs = Math.min(15000, baseDelayMs * (2 ** (attempt - 1)) + jitterMs);
        const nextAttempt = attempt + 1;
        console.log(`⚠️  Transient LLM gate error detected, retrying in ${delayMs}ms (attempt ${nextAttempt}/${maxAttempts})...`);

        await new Promise(resolve => setTimeout(resolve, delayMs));
      gateResult = await this.phaseExecutor.executeGate(phaseDef.qualityGate.file, gateModeConfig, gateContext, phaseDef);
        attempt = nextAttempt;
      }
    }
    
    // For JavaScript gates, parse the output first (whether pass or fail)
    if (this.isJavaScriptGate(phaseDef.qualityGate.file)) {
      let parsedGateResult;
      
      try {
        // Always save a transcript first (even if parsing fails)
        const logsDir = this.getWorkspacePath('log');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const logFile = path.join(logsDir, `js-gate-${phaseDef.id}-${Date.now()}.log`);
        fs.writeFileSync(logFile, `=== JS Gate Output ===\n${gateResult.output}\n\n=== Error Output ===\n${gateResult.errorOutput || 'none'}`);

        // Parse the JSON output from the JS gate (best-effort)
        parsedGateResult = this._parseJavaScriptGateJson(gateResult);
        if (!parsedGateResult) {
          const snippet = (gateResult.output || gateResult.errorOutput || '').trim().substring(0, 300);
          throw new Error(`Could not parse JSON from JS gate output. Snippet: ${snippet}`);
        }
        
        if (parsedGateResult.passed) {
          console.log(`🟢 JavaScript gate passed for ${phaseDef.id} (score: ${parsedGateResult.score || 1})`);
          this.debugLogger.log('gate', 'js-gate-success', {
            phaseId: phaseDef.id,
            score: parsedGateResult.score || 1,
            reasons: parsedGateResult.reasons || []
          });
          
          if (markPhaseCompleted) {
            this.processMonitor.markPhaseCompleted(phaseDef.id, gateResult);
          }
          
          return parsedGateResult;
        } else {
          // Gate failed - throw error but include parsed details
          console.error(`❌ JavaScript gate failed for ${phaseDef.id} (score: ${parsedGateResult.score || 0})`);
          if (parsedGateResult.reasons?.length > 0) {
            console.error(`   Reasons: ${parsedGateResult.reasons.join('; ')}`);
          }
          if (parsedGateResult.criticalFailures?.length > 0) {
            console.error(`   Critical: ${parsedGateResult.criticalFailures.join('; ')}`);
          }
          this._logJavaScriptGateFailureDetails(parsedGateResult);
          this.debugLogger.log('gate', 'js-gate-failure', {
            phaseId: phaseDef.id,
            score: parsedGateResult.score || 0,
            reasons: parsedGateResult.reasons || [],
            criticalFailures: parsedGateResult.criticalFailures || []
          });
          
          const error = new Error(`Gate validation failed: ${parsedGateResult.reasons?.join(', ') || 'Unknown reason'}`);
          error.gateResult = parsedGateResult;  // Attach parsed result to error
          throw error;
        }
      } catch (parseError) {
        // If parsing fails, treat as execution failure
        if (parseError.gateResult) {
          // This is our intentional error with attached gateResult
          throw parseError;
        }
        
        console.error(`❌ Failed to parse JS gate output: ${parseError.message}`);
        throw new Error(`Gate execution failed: ${gateResult.errorOutput || parseError.message}`);
      }
    }
    
    // For LLM gates, check completion first
    if (!gateResult.completed) {
      // When Claude CLI itself fails (crashes, timeout, etc.), capture error details
      const errorDetails = gateResult.errorOutput || gateResult.output || 'Unknown error';
      const error = new Error(`Gate execution failed with exit code ${gateResult.exitCode}: ${errorDetails.substring(0, 200)}`);
      
      // Create a gateResult object with the error details for retry context
      error.gateResult = {
        passed: false,
        score: 0,
        reasons: [`LLM gate execution failed with exit code ${gateResult.exitCode}`, errorDetails.substring(0, 500)],
        criticalFailures: [],  // Not critical - allow retries
        retryRecommended: true
      };
      
      console.error(`❌ LLM gate execution failed with exit code ${gateResult.exitCode}`);
      console.error(`   Error output: ${errorDetails.substring(0, 200)}`);
      this.debugLogger.log('gate', 'llm-gate-execution-error', {
        phaseId: phaseDef.id,
        gateFile: phaseDef.qualityGate?.file,
        exitCode: gateResult.exitCode,
        errorSnippet: errorDetails.substring(0, 500)
      });
      
      throw error;
    }
    
    console.log(`✅ Gate completed successfully`);
    this.debugLogger.log('gate', 'llm-gate-complete', {
      phaseId: phaseDef.id,
      gateFile: phaseDef.qualityGate?.file
    });
    
    // For LLM gates, validate the JSON result
    const validationResult = this.validateGateResult(gateResult.output, phaseDef);
    
    if (!validationResult.passed) {
      console.error(`❌ LLM gate failed for ${phaseDef.id} (score: ${validationResult.score || 0})`);
      if (validationResult.reasons?.length > 0) {
        console.error(`   Reasons: ${validationResult.reasons.join('; ')}`);
      }
      if (validationResult.criticalFailures?.length > 0) {
        console.error(`   Critical: ${validationResult.criticalFailures.join('; ')}`);
      }
      this.debugLogger.log('gate', 'llm-gate-failure', {
        phaseId: phaseDef.id,
        score: validationResult.score || 0,
        reasons: validationResult.reasons || [],
        criticalFailures: validationResult.criticalFailures || []
      });
      
      const error = new Error(`Gate validation failed: ${validationResult.reasons?.join(', ')}`);
      error.gateResult = validationResult;  // Attach parsed result to error
      throw error;
    }
    
    console.log(`🟢 Gate validation passed for ${phaseDef.id}`);
    this.debugLogger.log('gate', 'llm-gate-success', {
      phaseId: phaseDef.id,
      score: validationResult.score || 1,
      reasons: validationResult.reasons || []
    });
    
    if (markPhaseCompleted) {
      this.processMonitor.markPhaseCompleted(phaseDef.id, gateResult);
    }
    
    return validationResult;
  }


  /**
   * Check if phase failed due to E2BIG (argument list too long)
   * This happens when claude-flow swarm can't spawn claude due to prompt size
   */
  _isE2BIGFailure(result) {
    const errorOutput = result.errorOutput || '';
    return errorOutput.includes('E2BIG') || errorOutput.includes('Argument list too long');
  }

  _logJavaScriptGateFailureDetails(parsedGateResult) {
    const retryContext = parsedGateResult?.retryContext || {};
    const failedTests = Array.isArray(retryContext.failedTests) ? retryContext.failedTests : [];
    const tsErrors = typeof retryContext.tsErrors === 'string' ? retryContext.tsErrors.trim() : '';
    const serverLogs = typeof retryContext.serverLogs === 'string' ? retryContext.serverLogs.trim() : '';

    if (failedTests.length > 0) {
      console.error('   Failed tests:');
      for (const failure of failedTests.slice(0, 3)) {
        const testName = failure?.test || 'Unknown test';
        const file = failure?.file ? `${failure.file}${failure.line ? `:${failure.line}` : ''}` : null;
        const label = file ? `${testName} (${file})` : testName;
        console.error(`     - ${label}`);
        if (failure?.locator) {
          console.error(`       Locator: ${String(failure.locator).trim()}`);
        }
        if (failure?.expected) {
          console.error(`       Expected: ${String(failure.expected).trim()}`);
        }
        if (failure?.received) {
          console.error(`       Received: ${String(failure.received).trim()}`);
        }
        if (failure?.timeout) {
          console.error(`       Timeout: ${failure.timeout}ms`);
        }
        if (failure?.error) {
          const snippet = String(failure.error).trim().slice(0, 200);
          if (snippet) {
            console.error(`       Error: ${snippet}`);
          }
        }
      }
      return;
    }

    if (tsErrors) {
      console.error('   TypeScript errors (first 5 lines):');
      const errorLines = tsErrors.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 5);
      for (const line of errorLines) {
        console.error(`     - ${line}`);
      }
      return;
    }

    if (serverLogs) {
      console.error('   Server logs (last 5 lines):');
      const logLines = serverLogs.split('\n').map(line => line.trimEnd()).filter(Boolean);
      const tail = logLines.slice(-5);
      for (const line of tail) {
        console.error(`     - ${line}`);
      }
    }
  }

  /**
   * Handle phase completion
   */
  async handlePhaseCompletion(phaseId, result) {
    const phaseInfo = this.processMonitor.activePhases.get(phaseId);
    if (!phaseInfo) return;
    
    const phaseDef = phaseInfo.phaseDef;
    
    // E2BIG FALLBACK: If swarm failed with E2BIG, permanently switch to direct claude
    // This also affects retries - once E2BIG is detected, we stay on direct mode
    if (this._isE2BIGFailure(result) && phaseDef.executionMode?.includes('swarm')) {
      const originalMode = phaseDef.executionMode;
      console.log(`⚠️  E2BIG detected in ${phaseId} - switching from ${originalMode} to direct claude mode`);
      this.debugLogger.log('phase', 'e2big-fallback', { phaseId, originalMode });
      
      // Permanently change execution mode so retries also use direct mode
      phaseDef.executionMode = 'default';
      
      // Clean up old tracking
      this.processMonitor.activePhases.delete(phaseId);
      
      // Re-run with direct claude mode (uses workflow.json directAgent config)
      const directModeConfig = this.workflowManager.getModeConfiguration('default');
      const phaseProcess = await this.phaseExecutor.kickOffPhase(phaseDef, directModeConfig);
      this.processMonitor.trackPhase(phaseDef.id, phaseDef, phaseProcess);
      return;  // Wait for new process - don't proceed to gate yet
    }

    const isGateOnly = this.isGateOnlyPhase(phaseDef);
    this.logResourceSnapshot('phase-exit', {
      phaseId,
      exitCode: result.exitCode,
      durationMs: result.duration
    });
    this.debugLogger.log('phase', 'completion-detected', {
      phaseId,
      isGateOnly,
      completed: result.completed,
      exitCode: result.exitCode,
      duration: result.duration
    });
    
    // Guardrail: Claude CLI can intermittently emit certain terminal errors
    // in stream-json mode *after* it already emitted a success result. This
    // yields exit=1 and causes wasteful retries even though the phase work
    // already succeeded.
    //
    // If we detect these exact signatures in the stdout tail *and* the same tail
    // contains a success marker, treat the phase as completed.
    if (!result.completed && result.exitCode !== 0) {
      try {
        const artifacts = result.debugArtifacts || phaseInfo.process?.phaseInfo?.debugArtifacts || null;
        const stdoutPath = artifacts?.stdout
          ? path.join(this.options.workingDirectory, artifacts.stdout)
          : null;
        if (stdoutPath) {
          const tail = this.tailTextFile(stdoutPath, { maxBytes: 131072, maxLines: 200 }) || '';
          const hasExecutionError = tail.includes('"subtype":"error_during_execution"');
          const hasStreamModeError = hasExecutionError &&
            tail.includes('only prompt commands are supported in streaming mode');
          const hasEventExportError = hasExecutionError && (
            tail.includes('Failed to export') ||
            tail.includes('events failed to export') ||
            tail.includes('event logging')
          );
          const hasSuccessMarker =
            tail.includes('"subtype":"success"') ||
            tail.includes('"type":"result","subtype":"success"');

          if (hasSuccessMarker && (hasStreamModeError || hasEventExportError)) {
            const errorSignature = hasStreamModeError
              ? 'only prompt commands are supported in streaming mode'
              : 'event export failed';
            console.warn(
              `⚠️  Detected Claude CLI terminal error AFTER success for ${phaseId} (${errorSignature}); treating phase as completed to avoid retry storm`
            );
            this.debugLogger.log('phase', 'phase-spurious-cli-error-ignored', {
              phaseId,
              exitCode: result.exitCode,
              errorSignature
            });
            result = {
              ...result,
              completed: true,
              exitCode: 0
            };
          }
        }
      } catch (_) {
        // Fall back to normal failure handling
      }
    }

    if (result.completed) {
      if (phaseDef.qualityGate) {
        // Regular phase with quality gate
        console.log(`✅ Phase ${phaseId} completed`);
        
        // Execute follow-up audit if configured (for dynamic phases)
        const sessionId = phaseInfo.process?.phaseInfo?.sessionId;
        if (phaseDef.followUpPrompt && sessionId) {
          this.debugLogger.log('phase', 'follow-up-starting', {
            phaseId,
            sessionId,
            followUpPrompt: phaseDef.followUpPrompt
          });
          
          try {
            const followUpResult = await this.phaseExecutor.executeFollowUp(phaseDef, sessionId);
            
            if (followUpResult.skipped) {
              console.log(`⏭️  Follow-up skipped: ${followUpResult.reason || 'not configured'}`);
            } else if (!followUpResult.completed) {
              console.warn(`⚠️  Follow-up audit did not complete successfully (exit code: ${followUpResult.exitCode})`);
              if (followUpResult.errorOutput) {
                console.warn(`📋 Error details: ${followUpResult.errorOutput.substring(0, 300)}`);
              }
              // Continue to gate anyway - audit is best-effort
            }
            
            this.debugLogger.log('phase', 'follow-up-completed', {
              phaseId,
              completed: followUpResult.completed,
              skipped: followUpResult.skipped
            });
          } catch (followUpError) {
            console.warn(`⚠️  Follow-up audit error: ${followUpError.message}`);
            // Continue to gate anyway - audit is best-effort
          }
        }
        
        this.debugLogger.log('phase', 'phase-completed-awaiting-gate', {
          phaseId,
          gateFile: phaseDef.qualityGate?.file
        });
        
        try {
          // Execute and validate gate (gates read files directly - no embedded output)
          await this.executeAndValidateGate(phaseDef, null, true);
          
          // If we get here, gate passed
          this.updateFrontendTaskStatus(phaseDef, 'completed');
          await this.handlePhaseProgression(phaseDef, result.output);
        } catch (error) {
          // Error details already logged in executeAndValidateGate - don't duplicate
          console.log('💾 Keeping database for retry context');
          // Don't reset - keep database for retry to use
          // Pass gateResult if it was attached to the error (for JS gates)
          await this.handlePhaseFailure(phaseDef, error, error.gateResult);
        }
      } else {
        // Regular phase without quality gate
        console.log(`🟢 No quality gate for ${phaseId} - marking as completed`);
        this.processMonitor.markPhaseCompleted(phaseId, result);
        this.updateFrontendTaskStatus(phaseDef, 'completed');
        
        await this.handlePhaseProgression(phaseDef, result.output);
      }
    } else {
      if (isGateOnly) {
        console.log(`❌ Gate-only phase ${phaseId} failed with exit code ${result.exitCode}`);
        console.log(`🚫 Gate-only phases do not retry - marking as failed`);
        this.processMonitor.markPhaseFailed(phaseId, 'Gate-only execution failed', result);
        this.failWorkflow();
      } else {
        console.log(`❌ Phase ${phaseId} failed (exit=${result.exitCode})`);
        
        const artifacts = result.debugArtifacts || phaseInfo.process?.phaseInfo?.debugArtifacts || null;
        if (artifacts?.prompt) console.log(`   📄 prompt: ${artifacts.prompt}`);
        if (artifacts?.command) console.log(`   🧾 command: ${artifacts.command}`);
        if (artifacts?.stdout) console.log(`   📄 stdout: ${artifacts.stdout}`);
        if (artifacts?.stderr) console.log(`   📄 stderr: ${artifacts.stderr}`);
        
        // Print a small tail to make failures actionable without overwhelming logs
        const stderrTail = artifacts?.stderr
          ? this.tailTextFile(path.join(this.options.workingDirectory, artifacts.stderr), { maxBytes: 32768, maxLines: 40 })
          : null;
        const stdoutTail = artifacts?.stdout
          ? this.tailTextFile(path.join(this.options.workingDirectory, artifacts.stdout), { maxBytes: 32768, maxLines: 20 })
          : null;

        if (stderrTail) {
          console.log(`   📋 stderr tail:`);
          this.printIndentedBlock('   ', stderrTail);
        } else if (stdoutTail) {
          console.log(`   📋 stdout tail:`);
          this.printIndentedBlock('   ', stdoutTail);
        }

        this.debugLogger.log('phase', 'phase-failure-detected', {
          phaseId,
          exitCode: result.exitCode,
          gateDuringPhase: Boolean(phaseDef.qualityGate)
        });
        await this.handlePhaseFailure(phaseDef, new Error(`Process exited with code ${result.exitCode}`));
      }
    }
  }
  
  
  /**
   * Handle gate completion and validation
   */
  async handleGateCompletion(gatePhaseId, result) {
    const gateInfo = this.processMonitor.activePhases.get(gatePhaseId);
    if (!gateInfo) {
      console.log(`❌ No gate info found for ${gatePhaseId}`);
      this.debugLogger.log('gate', 'gate-info-missing', {
        gatePhaseId
      });
      return;
    }
    
    const phaseDef = gateInfo.originalPhaseDef;
    const originalPhaseId = gateInfo.originalPhaseId;
    const originalResult = gateInfo.originalResult;
    
    if (result.completed) {
      console.log(`✅ Gate ${gatePhaseId} completed. Validating result...`);
      
      // Validate the gate result
      const gateResult = this.validateGateResult(result.output, phaseDef);
      this.debugLogger.log('gate', 'gate-process-complete', {
        gatePhaseId,
        originalPhaseId,
        passed: gateResult.passed,
        score: gateResult.score || 0
      });
      
      if (!gateResult.passed) {
        await this.handleGateFailure(originalPhaseId, gateInfo, phaseDef, gateResult);
        return;
      }
      
      console.log(`🟢 Gate validation passed for ${originalPhaseId}`);
      
      // Mark the original phase as completed
      this.processMonitor.markPhaseCompleted(originalPhaseId, originalResult);
      
      // Clean up gate tracking
      this.processMonitor.activePhases.delete(gatePhaseId);
      
      await this.handlePhaseProgression(phaseDef, originalResult?.output);
    } else {
      console.log(`❌ Gate ${gatePhaseId} failed`);
      this.debugLogger.log('gate', 'gate-process-failed', {
        gatePhaseId,
        originalPhaseId,
        exitCode: result.exitCode
      });
      await this.handleGateFailure(originalPhaseId, gateInfo, phaseDef, {
        passed: false,
        score: 0,
        reasons: [`Gate execution failed with exit code ${result.exitCode}`],
        criticalFailures: [`gate_execution_failed`]
      });
    }
  }
  
  /**
   * Validate gate result from log files
   */
  validateGateResult(output, phaseDef) {
    try {
      if (!output || typeof output !== 'string') {
        return {
          passed: false,
          score: 0,
          reasons: ['No output received from gate execution'],
          criticalFailures: ['no_gate_output']
        };
      }
      
      // Save gate response to log file for debugging
      const logsDir = this.getWorkspacePath('log');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFile = path.join(logsDir, `llm-gate-${phaseDef.id}-${Date.now()}.log`);
      fs.writeFileSync(logFile, `=== LLM Gate Response ===\n${output}\n`);
      
      // Parse gate JSON using GateParser module
      const gateResult = GateParser.parseGateJSON(output);
      
      if (!gateResult) {
        return {
          passed: false,
          score: 0,
          reasons: ['Failed to parse gate JSON response'],
          criticalFailures: ['json_parse_error']
        };
      }
      
      // Validate required fields
      if (typeof gateResult.passed !== 'boolean') {
        return {
          passed: false,
          score: 0,
          reasons: ['Gate result missing required "passed" field'],
          criticalFailures: ['invalid_output_format']
        };
      }
      
      return gateResult;
    } catch (error) {
      return {
        passed: false,
        score: 0,
        reasons: [`Failed to parse gate result: ${error.message}`],
        criticalFailures: ['json_parse_error']
      };
    }
  }
  
  /**
   * Trigger a nuclear restart after all retry attempts are exhausted.
   */
  async triggerNuclearRestart(phaseDef, failureReason, gateResult = null, attemptCount = 0) {
    const phaseId = phaseDef.id;

    if (this.nuclearRestartedPhases.has(phaseId) || this.globalNuclearRestartAttempted) {
      console.log(`⚠️  Nuclear restart already triggered for ${phaseId} – skipping duplicate request`);
      return false;
    }

    this.nuclearRestartedPhases.add(phaseId);

    console.log(`\n🔥 NUCLEAR RESTART NEEDED`);
    console.log(`   Phase: ${phaseId} after ${attemptCount} retry attempts`);
    console.log(`   Saving phase state and requesting process restart...`);

    this.globalNuclearRestartAttempted = true;

    // Clear retry state files to reset counter for nuclear restart
    // This ensures the phase gets a fresh set of retries after nuclear restart
    const retryContextDir = path.join(this.options.workingDirectory, 'log', 'retry-contexts');
    const retryStateFile = path.join(retryContextDir, `${phaseId}-retry-state.json`);
    const resumeStateFile = path.join(retryContextDir, `${phaseId}-resume-state.json`);
    
    if (fs.existsSync(retryStateFile)) {
      fs.unlinkSync(retryStateFile);
      console.log(`   Cleared retry state for fresh restart (reset counter to 0)`);
    }
    if (fs.existsSync(resumeStateFile)) {
      fs.unlinkSync(resumeStateFile);
      console.log(`   Cleared resume state for fresh restart`);
    }

    this.processMonitor.activePhases.delete(phaseId);
    this.processMonitor.markPhaseFailed(phaseId, failureReason, gateResult);

    // Send failure event to Inngest (webapp integration)
    await this.sendFailureToInngest(phaseDef, failureReason, gateResult);

    const isAutonomousMode = process.env.AUTONOMOUS_RESTART !== 'false' && !process.env.DOCKER_MODE;

    if (isAutonomousMode) {
      console.log(`   Using autonomous restart mode...`);
      const AutonomousRestart = require('./lib/autonomous-restart');
      await AutonomousRestart.handleNuclearExit(this, phaseDef, failureReason);
      return true;
    }

    const trackingFile = path.join(this.options.workingDirectory, '.nuclear-restart-phase');
    fs.writeFileSync(trackingFile, phaseId, 'utf8');
    console.log(`   Saved restart phase: ${phaseId}`);
    console.log(`   Exiting with code 99 for wrapper to handle restart...\n`);
    process.exit(99);
  }
  
  /**
   * Handle gate failure with retry logic
   */
  async handleGateFailure(phaseId, phaseInfo, phaseDef, gateResult) {
    console.error(`🚫 Quality gate failed for ${phaseId}`);
    this.updateFrontendTaskStatus(phaseDef, 'pending');
    
    // Only check server for code-modifying phase gates
    const codeModifyingPhases = ['phase-2', 'phase-3-1', 'phase-3-3', 'phase-6', 'phase-7-1', 'phase-7-3'];
    
    if (codeModifyingPhases.some(id => phaseId?.includes(id))) {
      try {
        const { checkServerHealth } = require('./lib/server-health');
        const { healthy, code } = checkServerHealth();
        
        if (!healthy && code === '500') {
          console.log(`⚠️  Server returned 500 after ${phaseId} - likely compilation error`);
          gateResult.reasons = gateResult.reasons || [];
          gateResult.criticalFailures = gateResult.criticalFailures || [];
          gateResult.reasons.push('Server health check failed (500 error)');
          gateResult.criticalFailures.push('Dev server crashed with compilation errors');
        }
      } catch (_) {
        // Ignore if module doesn't exist
      }
    }
    
    if (gateResult.criticalFailures?.length) {
      console.error(`   Critical: ${gateResult.criticalFailures.join('; ')}`);
    }
    if (gateResult.reasons?.length) {
      console.error(`   Reasons: ${gateResult.reasons.join('; ')}`);
    }
    this.debugLogger.log('gate', 'gate-failure', {
      phaseId,
      gateFile: phaseDef.qualityGate?.file,
      reasons: gateResult.reasons || [],
      criticalFailures: gateResult.criticalFailures || [],
      score: gateResult.score || 0
    });
    
    this.processMonitor.activePhases.delete(phaseId);
    this.processMonitor.markPhaseFailed(phaseId, 'Quality gate failed', gateResult);
    this.failWorkflow();
  }
  
  /**
   * Handle phase progression after successful completion
   * Checks for workflow completion automatically
   * @param {Object} phaseDef - Phase definition
   * @param {string} phaseOutput - Optional phase output for Gemini token extraction
   */
  async handlePhaseProgression(phaseDef, phaseOutput = null) {
    // Commit phase changes for granular history
    await this.commitPhaseChanges(phaseDef);
    
    // Send token usage analytics to Inngest (pass output for Gemini token extraction)
    await this.tokenTracker.processAndSend(phaseOutput);
    
    // Check if snapshot requested for this phase
    if (phaseDef.gitSnapshot) {
      const snapshotName = phaseDef.snapshotName || phaseDef.id;
      const snapshotBranch = await this.createGitSnapshot(snapshotName);
      if (snapshotBranch) {
        this.lastSnapshotBranch = snapshotBranch;
        this.lastSnapshotPhase = phaseDef.id;
      }
    }
    
    // Checkpoint every 5 dynamic phases for phase-2 and phase-6
    if (phaseDef._dynamicPhase && phaseDef._originalPhase) {
      const parentId = phaseDef._originalPhase;
      if (parentId === 'phase-2' || parentId === 'phase-6') {
        // Reset counter when switching between parent phases (phase-2 vs phase-6)
        if (this.currentDynamicParent !== parentId) {
          this.dynamicPhaseCounter = 0;
          this.currentDynamicParent = parentId;
        }
        this.dynamicPhaseCounter++;
        if (this.dynamicPhaseCounter % 5 === 0) {
          console.log(`📸 Creating checkpoint snapshot (every 5 dynamic phases in ${parentId})`);
          const snapshotBranch = await this.createGitSnapshot(phaseDef.id);
          if (snapshotBranch) {
            this.lastSnapshotBranch = snapshotBranch;
            this.lastSnapshotPhase = phaseDef.id;
          }
        }
      }
    }
    
    if (this.workflowManager.runSinglePhase) {
      console.log(`✅ Single phase execution complete`);
      await this.completeWorkflow();
      return;
    }
    
    // Note: Dynamic phase generation now happens in kickOffPhase BEFORE execution
    // This ensures generator phases create their children before attempting to run
    if (this.workflowManager.isDynamicPhaseGenerationComplete(phaseDef.id)) {
      const originalPhase = this.workflowManager.findOriginalPhaseForDynamic(phaseDef.id);
      
      // Check if the original phase (e.g., phase-2) had gitSnapshot flag
      // and this is the last dynamic phase completing (marked as _finalPhase)
      if (originalPhase?.gitSnapshot && phaseDef._finalPhase) {
        const snapshotName = originalPhase.snapshotName || originalPhase.id;
        const snapshotBranch = await this.createGitSnapshot(snapshotName);
        if (snapshotBranch) {
          this.lastSnapshotBranch = snapshotBranch;
          this.lastSnapshotPhase = originalPhase.id;
        }
      }
      
      if (originalPhase?.dynamicPhaseGeneration?.stopAfterGeneration && 
          this.workflowManager.phaseStartId === originalPhase.id) {
        console.log(`✅ Dynamic phase generation complete`);
        await this.completeWorkflow();
      } else {
        this.workflowManager.nextPhase();
        await this.startNextPhase();
      }
    } else {
      this.workflowManager.nextPhase();
      
      // Then start next phase or complete workflow
      // Note: startNextPhase() handles completion internally
      await this.startNextPhase();
    }
  }
  
  /**
   * Handle phase failure with retry logic
   * @param {Object} phaseDef - Phase definition
   * @param {Error} error - Error that caused failure
   * @param {Object} gateResult - Optional gate result if failure was due to gate validation
   */
  async handlePhaseFailure(phaseDef, error, gateResult = null) {
    const phaseInfo = this.processMonitor.activePhases.get(phaseDef.id);
    if (!phaseInfo) return;
    this.debugLogger.log('phase', 'handle-phase-failure', {
      phaseId: phaseDef.id,
      error: error.message,
      hasGateResult: Boolean(gateResult)
    });
    this.updateFrontendTaskStatus(phaseDef, 'pending');
    
    if (this.isGateOnlyPhase(phaseDef)) {
      console.log(`❌ Gate-only phase ${phaseDef.id} failed - not retrying`);
      this.processMonitor.markPhaseFailed(phaseDef.id, error);
      this.failWorkflow();
      return;
    }
    
    this.processMonitor.activePhases.delete(phaseDef.id);
    this.processMonitor.markPhaseFailed(phaseDef.id, error);
    this.failWorkflow();
  }
  
  /**
   * Handle workflow completion - success or failure
   */
  async handleWorkflowCompletion(status) {
    console.log('📊 Workflow completion handler called');
  }
  
  async completeWorkflow() {
    if (this.workflowStatus === 'completed') return;
    this.workflowStatus = 'completed';
    
    if (this.processMonitor) {
      this.processMonitor.stopMonitoring();
      this.monitoringStarted = false;
    }
    
    console.log(`\n🎉 All phases completed! Workflow finished.`);
    this.debugLogger.log('orchestrator', 'workflow-completed', { 
      workflowId: this.workflowId,
      finalBranch: this.lastSnapshotBranch || null
    });
  }
  
  /**
   * Set workflow failure status
   */
  failWorkflow() {
    this.workflowStatus = 'failed';
    this.debugLogger.log('orchestrator', 'workflow-failed', {
      workflowId: this.workflowId
    });
  }
  
  /**
   * Get current workflow status
   */
  getStatus() {
    const monitorStatus = this.processMonitor.getStatus();
    
    const status = {
      workflowId: this.workflowId,
      status: this.workflowStatus,
      totalPhases: this.workflowManager.phaseDefinitions.length,
      staticPhaseCount: this.workflowManager.staticPhaseCount,
      currentPhase: this.workflowManager.currentPhaseIndex,
      completedPhases: monitorStatus.completedPhases,
      failedPhases: monitorStatus.failedPhases,
      activePhases: monitorStatus.activePhases,
      progress: `${monitorStatus.completedPhases}/${this.workflowManager.phaseDefinitions.length} phases completed (${this.workflowManager.staticPhaseCount} base phases)`,
      activePhaseIds: monitorStatus.activePhaseIds,
      phases: monitorStatus.phases,
      timestamp: new Date().toISOString()
    };

    // Add retry statistics if available
    if (this.retrySystem) {
      status.retryStats = this.retrySystem.getRetryStatistics();
    }

    return status;
  }
  
  /**
   * Stop the workflow
   */
  stopWorkflow() {
    console.log(`🛑 Stopping workflow ${this.workflowId}`);
    this.processMonitor.stopAllPhases();
    this.workflowStatus = 'stopped';
    this.processMonitor.stopMonitoring();
    this.monitoringStarted = false;
    this.debugLogger.log('orchestrator', 'workflow-stopped', {
      workflowId: this.workflowId
    });
    return {
      workflowId: this.workflowId,
      status: 'stopped',
      message: 'Workflow stopped by user'
    };
  }

  /**
   * Commit changes after phase completion for granular history
   * @param {Object} phaseDef - Phase definition with id and name
   */
  async commitPhaseChanges(phaseDef) {
    try {
      const { execSync, spawnSync } = require('child_process');
      
      // Check if there are any changes to commit
      const status = execSync('git status --porcelain', {
        cwd: this.options.workingDirectory,
        encoding: 'utf-8'
      }).trim();
      
      if (!status) {
        return; // Nothing to commit
      }
      
      // Stage all changes
      execSync('git add -A', { cwd: this.options.workingDirectory, stdio: 'pipe' });
      
      // Commit with descriptive message (use spawnSync to avoid shell escaping issues)
      const message = `${phaseDef.name} (${phaseDef.id})`;
      const result = spawnSync('git', ['commit', '-m', message], { 
        cwd: this.options.workingDirectory, 
        stdio: 'pipe' 
      });
      
      if (result.status !== 0) {
        throw new Error(result.stderr?.toString() || 'Commit failed');
      }
      
      console.log(`📝 Committed: ${message}`);
    } catch (error) {
      // Non-blocking - continue workflow if commit fails
      console.warn(`⚠️ Commit skipped: ${error.message}`);
    }
  }

  /**
   * Create a git snapshot after phase completion
   * @param {string} phaseId - ID of the phase that just completed
   * @returns {string|null} - The snapshot branch name if successful, null otherwise
   */
  async createGitSnapshot(phaseId) {
    console.log(`📸 Creating git snapshot for ${phaseId}...`);
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(this.options.workingDirectory, 'scripts/git-snapshot.sh');
      
      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.warn(`⚠️ Git snapshot script not found at ${scriptPath}`);
        return null;
      }
      
      // Execute snapshot script and capture output for branch name
      const output = execSync(`bash ${scriptPath} ${phaseId}`, {
        encoding: 'utf-8',
        cwd: this.options.workingDirectory,
        env: {
          ...process.env,
          GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
          GITHUB_APP_ID: process.env.GITHUB_APP_ID,
          GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
          GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID,
          INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY
        }
      });
      
      // Print the output so it's still visible in logs
      if (output) {
        // Hide machine-readable parser line to reduce noise.
        const cleanedOutput = output.replace(/^SNAPSHOT_BRANCH:.*$/gm, '').trimEnd();
        if (cleanedOutput) {
          process.stdout.write(`${cleanedOutput}\n`);
        }
      }
      
      // Parse the branch name from output
      const branchMatch = output.match(/SNAPSHOT_BRANCH:\s*(\S+)/);
      const branchName = branchMatch ? branchMatch[1] : null;
      
      if (branchName) {
        console.log(`📌 Checkpoint branch: ${branchName}`);
      }
      
      this.debugLogger.log('snapshot', 'snapshot-created', {
        phaseId: phaseId,
        branchName: branchName,
        timestamp: new Date().toISOString()
      });
      
      return branchName;
    } catch (error) {
      console.error(`⚠️ Snapshot failed (non-fatal): ${error.message}`);
      this.debugLogger.log('snapshot', 'snapshot-failed', {
        phaseId: phaseId,
        error: error.message
      });
      // Continue workflow - snapshots are non-blocking
      return null;
    }
  }

  /**
   * Send failure event to Inngest (webapp integration)
   * Called when nuclear restart is triggered
   */
  async sendFailureToInngest(phaseDef, failureReason, gateResult) {
    const https = require('https');
    const eventKey = process.env.INNGEST_EVENT_KEY;
    
    if (!eventKey) {
      console.log(`⚠️  INNGEST_EVENT_KEY not set - skipping failure notification`);
      return;
    }
    
    // Extract build identifier from RAILWAY_SERVICE_NAME (e.g., "fshq-build-3" -> "build-3")
    const serviceName = process.env.RAILWAY_SERVICE_NAME || '';
    const branchMatch = serviceName.match(/(re)?build-\d+/);
    const branch = branchMatch ? branchMatch[0] : 'local';
    
    const payload = JSON.stringify({
      name: 'builder/output.ready',
      data: {
        status: 'soft-error',  // Distinct from 'failure' - indicates resumable failure with checkpoint data
        branch,
        failedPhase: phaseDef.id,
        failedPhaseName: phaseDef.name,
        lastCheckpointPhase: this.lastSnapshotPhase,
        snapshotBranch: this.lastSnapshotBranch,
        repositoryName: process.env.GITHUB_REPOSITORY || '',
        failureReason: typeof failureReason === 'string' ? failureReason : (failureReason?.message || 'Unknown error'),
        gateScore: gateResult?.score,
        gateReasons: gateResult?.reasons,
        timestamp: new Date().toISOString()
      }
    });
    
    return new Promise((resolve) => {
      const req = https.request(`https://inn.gs/e/${eventKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Failure event sent to Inngest`);
          this.debugLogger.log('inngest', 'failure-event-sent', {
            phaseId: phaseDef.id,
            snapshotBranch: this.lastSnapshotBranch
          });
        } else {
          console.warn(`⚠️  Inngest failure event returned HTTP ${res.statusCode}`);
        }
        resolve();
      });
      
      req.on('error', (error) => {
        console.warn(`⚠️  Failed to send Inngest failure event: ${error.message}`);
        resolve(); // Don't block on failure
      });
      
      req.write(payload);
      req.end();
    });
  }

}

// Main CLI function
async function main() {
  console.log('🌊 Samus Builder SPARC Workflow');
  console.log('==================================\n');
  
  const args = process.argv.slice(2);
  const phaseArg = args.find(arg => arg.startsWith('--phase='));
  const startArg = args.find(arg => arg.startsWith('--start='));
  const startPhase = startArg ? startArg.split('=')[1] : null;
  const singlePhase = phaseArg ? phaseArg.split('=')[1] : null;
  const workflowArg = args.find(arg => arg.startsWith('--workflow='));
  const workflowConfig = workflowArg ? workflowArg.split('=')[1] : null;
  
  try {
    const orchestrator = new DetachedSPARCOrchestrator({
      namespace: 'cfbuild-production-detached',
      workingDirectory: process.cwd(),
      checkInterval: 5000,  // Check every 5 seconds
      startPhase: startPhase,
      singlePhase: singlePhase,
      workflowConfig: workflowConfig || 'workflow.json'
    });
    
    await orchestrator.initialize();
    
    await orchestrator.startWorkflow({ 
      phaseStartId: startPhase,
      singlePhaseId: singlePhase 
    }, {});
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, stopping workflow...');
      orchestrator.stopWorkflow();
      process.exit(130);  // 128 + SIGINT(2) = interrupted, not completed
    });
    
    // Monitor loop
    // Check for completion every second
    while (true) {
      const status = orchestrator.getStatus();
      
      if (status.status === 'completed' || status.status === 'failed') {
        console.log(`\n🎉 Workflow finished with status: ${status.status}`);
        
        const reportPath = path.join(process.cwd(), 'log', `workflow-report-${Date.now()}.json`);
        if (!fs.existsSync(path.dirname(reportPath))) {
          fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        }
        fs.writeFileSync(reportPath, JSON.stringify(status, null, 2));
        console.log(`📄 Report saved to: ${reportPath}`);
        
        // Print helpful commands
        console.log('\n' + '='.repeat(60));
        console.log('📋 WORKFLOW COMPLETE');
        console.log('='.repeat(60));
        console.log('\n💡 Next steps:');
        console.log('   1. Press Ctrl+C to exit');
        console.log('   2. cd workspace');
        console.log('   3. Run phases:');
        console.log('      node orchestrator.js --phase=phase-#');
        console.log('      node orchestrator.js --start=phase-#');
        console.log('\n💡 Check outputs:');
        console.log('   cat prd-context-map.json | jq .');
        console.log('   ls -la prd/');
        console.log('='.repeat(60) + '\n');
        
        // Exit cleanly
        process.exit(status.status === 'completed' ? 0 : 1);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error(`❌ Workflow failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Samus Builder SPARC Workflow');
    console.log('=============================\n');
    console.log('Usage: node orchestrator.js [options]\n');
    console.log('Options:');
    console.log('  --help, -h       Show this help message');
    console.log('  --phase=<id>     Run only the specified phase');
    console.log('  --start=<id>     Start from specified phase and continue');
    console.log('  --workflow=<file> Use custom workflow config');
    process.exit(0);
  }
  
  main().catch(console.error);
}

module.exports = { DetachedSPARCOrchestrator, main };
