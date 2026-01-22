/**
 * Workflow Manager Module
 * Manages workflow configuration, phase definitions, and phase progression
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Constants
const COMPONENT_INDEX_PADDING = 2;
const COMPONENT_INDEX_PAD_CHAR = '0';

// Execution mode names
const EXECUTION_MODES = {
  DEFAULT: 'default',
  GATE_DEFAULT: 'gate-default',
  JS_DEFAULT: 'js-default'
};

class WorkflowManager {
  constructor(options = {}) {
    this.workflowId = `cfbuild-detached-${Date.now()}`;
    this.phaseDefinitions = [];
    this.workflowSettings = {};
    this.workflowExecutionModes = {};
    this.currentPhaseIndex = 0;
    this.runSinglePhase = false;
    this.phaseStartId = null;
    this.inputValidationDone = false;
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.staticPhaseCount = 0;     // Count of base phases from workflow.json (stable denominator)
    this.directAgentConfig = null;
    this.directAgentProviderName = 'claude';
    
    // Fallback mode definitions (clean names for workflow override)
    this.fallbackModes = {
      'default': {
        'command': 'claude',
        'args': ['$(cat {tempPromptFile})'],
        'flags': ['--print', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
        'promptFormat': 'tempfile'
      },
      'gate-default': {
        'command': 'claude',
        'args': ['$(cat {tempPromptFile})'],
        'flags': ['--output-format', 'json', '--dangerously-skip-permissions'],
        'promptFormat': 'tempfile'
      },
      'js-default': {
        'command': 'node',
        'args': ['{scriptFile}'],
        'flags': [],
        'promptFormat': 'none'
      }
    };
  }
  
  /**
   * Load workflow configuration from JSON file
   */
  loadWorkflowConfig(configPath) {
    try {
      const fullPath = path.resolve(configPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Workflow config not found: ${fullPath}`);
      }
      
      const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      // Validate required fields
      if (!config.phases || !Array.isArray(config.phases)) {
        throw new Error('Workflow config must have a "phases" array');
      }
      
      // Load phases, settings, and execution modes
      this.phaseDefinitions = config.phases;
      this.workflowSettings = config.settings || {};
      this.workflowExecutionModes = config.executionModes || {};
      this.directAgentConfig = this.normalizeDirectAgentConfig(this.workflowSettings?.directAgent);
      this.applyDirectAgentOverrides();
      
      // Assign parent phase numbers to static phases (stable X/Y denominator)
      this.staticPhaseCount = this.phaseDefinitions.length;
      this.phaseDefinitions.forEach((phase, index) => {
        phase.parentPhaseNumber = index + 1;
        phase.totalParentPhases = this.staticPhaseCount;
        phase.subTaskNumber = null;   // null = not a sub-task
        phase.totalSubTasks = null;
      });
      
      // Use version from env var if set, otherwise default to 'latest'
      const version = process.env.CLAUDE_FLOW_VERSION || 'latest';
      const specifier = `claude-flow@${version}`;
      let cfCommand = 'claude-flow';  // Prefer global command
      
      // Check if global command is available
      try {
        execSync('claude-flow --version', { stdio: 'ignore', timeout: 30000 });
      } catch (_) {
        // Global not available, use npx fallback
        cfCommand = `npx --yes ${specifier}`;
      }
      
      // Replace placeholders in execution modes
      for (const modeName of Object.keys(this.workflowExecutionModes)) {
        const mode = this.workflowExecutionModes[modeName];
        if (mode && typeof mode === 'object' && typeof mode.command === 'string') {
          if (mode.command.includes('{claudeFlowSpecifier}')) {
            mode.command = mode.command.replace('{claudeFlowSpecifier}', specifier);
          }
          if (mode.command.includes('{claudeFlowCommand}')) {
            mode.command = mode.command.replace('{claudeFlowCommand}', cfCommand);
          }
        }
      }
      
      console.log(`✅ Loaded workflow: ${config.name || 'Unnamed'} (${config.phases.length} phases)`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load workflow config: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Set the starting phase for the workflow
   */
  setStartPhase(phaseStartId, continueAfter = false) {
    if (!phaseStartId) return;
    
    this.phaseStartId = phaseStartId;
    const normalizedPhaseId = phaseStartId.match(/^\d+$/) ? `phase-${phaseStartId}` : phaseStartId;
    
    // Check if this looks like a dynamic phase by matching parent phase IDs
    const parentPhase = this.phaseDefinitions
      .filter(phase => phase.dynamicPhaseGeneration?.enabled)
      .filter(phase => normalizedPhaseId.startsWith(`${phase.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0];
    
    if (parentPhase) {
      const parentPhaseId = parentPhase.id;
      const taskId = normalizedPhaseId.slice(parentPhaseId.length + 1);
      console.log(`🔍 Detected dynamic phase restart: ${normalizedPhaseId}`);
      console.log(`   Parent phase: ${parentPhaseId}, Task ID: ${taskId}`);
      
      // Try to regenerate dynamic phases from manifest
      const workingDirectory = this.workingDirectory || process.cwd();
      const regenerated = this._regenerateDynamicPhasesForRestart(parentPhase, workingDirectory, taskId);
      
      if (regenerated) {
        // Find the regenerated phase
        const phase = this._findPhaseById(normalizedPhaseId);
        if (phase) {
          const idx = this.phaseDefinitions.findIndex(p => p.id === phase.id);
          this.currentPhaseIndex = idx;
          console.log(`✅ Successfully resumed from dynamic phase: ${phase.id}`);
          this.runSinglePhase = false; // Continue through remaining phases
          return;
        }
      }
      console.warn(`⚠️  Could not regenerate dynamic phase ${normalizedPhaseId}, starting from parent`);
    }
    
    // Check if this phase has dynamic generation enabled
    const phaseWithDynamicGeneration = this._findPhaseById(normalizedPhaseId, { 
      requireDynamicGeneration: true 
    });
    
    if (phaseWithDynamicGeneration) {
      const idx = this.phaseDefinitions.findIndex(p => p.id === phaseWithDynamicGeneration.id);
      this.currentPhaseIndex = idx;
      console.log(`⏭️  Starting from ${phaseWithDynamicGeneration.id} (will run ${phaseWithDynamicGeneration.name} with dynamic phase generation)`);
      // Don't set runSinglePhase = true for phases with dynamic generation
    } else {
      const phase = this._findPhaseById(normalizedPhaseId, { caseInsensitive: true });
      if (phase) {
        const idx = this.phaseDefinitions.findIndex(p => p.id === phase.id);
        this.currentPhaseIndex = idx;
        if (continueAfter) {
          console.log(`⏭️  Starting from specified phase: ${phase.id} (requested: ${phaseStartId}) and continuing`);
          this.runSinglePhase = false;
        } else {
          console.log(`⏭️  Starting from specified phase: ${phase.id} (requested: ${phaseStartId}) - single phase only`);
          this.runSinglePhase = true;
        }
      } else {
        console.warn(`⚠️  Requested start phase '${phaseStartId}' not found. Starting from beginning.`);
        console.warn(`   Available phases: ${this.phaseDefinitions.map(p => p.id).join(', ')}`);
      }
    }
  }
  
  /**
   * Get the current phase definition
   */
  getCurrentPhase() {
    if (this.currentPhaseIndex >= this.phaseDefinitions.length) {
      return null;
    }
    return this.phaseDefinitions[this.currentPhaseIndex];
  }
  
  /**
   * Move to the next phase
   */
  nextPhase() {
    this.currentPhaseIndex++;
    return this.getCurrentPhase();
  }
  
  /**
   * Check if workflow is complete
   */
  isComplete() {
    return this.currentPhaseIndex >= this.phaseDefinitions.length;
  }
  
  /**
   * Generate dynamic phases based on workflow configuration
   */
  async generateDynamicPhases(phaseDef, workingDirectory) {
    if (!phaseDef.dynamicPhaseGeneration?.enabled) {
      return;
    }
    
    const config = phaseDef.dynamicPhaseGeneration;
    
    try {
      // Load the manifest 
      const manifestPath = path.join(workingDirectory, config.manifestPath);
      
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found at ${manifestPath}`);
      }
      
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Handle different generation modes
      if (config.mode === 'frontend-build') {
        return this.generateFrontendPhases(phaseDef, manifest, config, workingDirectory);
      }
      
      if (config.mode === 'backend-build') {
        return this.generateBackendPhases(phaseDef, manifest, config, workingDirectory);
      }
      
      if (config.mode === 'checklist-remediation') {
        return this.generateChecklistRemediationPhases(phaseDef, manifest, config, workingDirectory);
      }
      
      // Original user story generation logic
      console.log(`📋 Loaded manifest with ${manifest.components?.length || 0} components`);
      
      // Generate phases for each subcomponent
      const dynamicPhases = [];
      
      for (let componentIndex = 0; componentIndex < (manifest.components || []).length; componentIndex++) {
        const component = manifest.components[componentIndex];
        // Add index to component for template substitution
        component.index = String(componentIndex + 1).padStart(COMPONENT_INDEX_PADDING, COMPONENT_INDEX_PAD_CHAR);
        
        for (const subcomponent of component.subcomponents || []) {
          const phaseId = `${phaseDef.id}-${subcomponent.id}`;
          
          const subcomponentPhase = {
            id: phaseId,
            name: `${phaseDef.name}: ${subcomponent.name}`,
            description: `${config.subcomponentTemplate.description || 'Process'} ${subcomponent.name}`,
            sparcMode: phaseDef.sparcMode || 'architect',
            promptFile: config.subcomponentTemplate.promptFile,
            subcomponent: subcomponent,
            component: component,
            qualityGate: config.subcomponentTemplate.qualityGate,
            _dynamicPhase: true,
            _originalPhase: phaseDef.id
          };
          
          dynamicPhases.push(subcomponentPhase);
          console.log(`➕ Generated phase: ${phaseId} - ${subcomponentPhase.name}`);
        }
      }
      
      // Add final phases from configuration
      for (const finalPhaseConfig of config.finalPhases || []) {
        const finalPhase = {
          id: `${phaseDef.id}-${finalPhaseConfig.id}`,
          name: finalPhaseConfig.name,
          description: finalPhaseConfig.description,
          sparcMode: phaseDef.sparcMode || 'architect',
          promptFile: finalPhaseConfig.promptFile,
          outputContract: finalPhaseConfig.outputContract, // Copy outputContract from config
          qualityGate: finalPhaseConfig.qualityGate,
          _dynamicPhase: true,
          _originalPhase: phaseDef.id,
          _finalPhase: true
        };
        
        dynamicPhases.push(finalPhase);
        console.log(`➕ Generated final phase: ${finalPhase.id} - ${finalPhase.name}`);
      }
      
    // Assign two-tier numbering: parent phase + sub-task position
    const totalSubTasks = dynamicPhases.length;
    dynamicPhases.forEach((phase, index) => {
      phase.parentPhaseNumber = phaseDef.parentPhaseNumber;
      phase.totalParentPhases = this.staticPhaseCount;
      phase.subTaskNumber = index + 1;
      phase.totalSubTasks = totalSubTasks;
      phase._originalPhaseName = phaseDef.name;  // Store parent name for display
    });
    
    // Insert the new phases into the workflow AFTER the current phase
    const insertionIndex = this.currentPhaseIndex + 1;
    this.phaseDefinitions.splice(insertionIndex, 0, ...dynamicPhases);
    
    console.log(`✅ Generated ${dynamicPhases.length} dynamic phases for ${phaseDef.name}`);
    console.log(`📊 Workflow expanded to ${this.phaseDefinitions.length} phases (${this.staticPhaseCount} base + ${totalSubTasks} sub-tasks)`);
      
    } catch (error) {
      console.error(`❌ Failed to generate dynamic phases: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate frontend build phases from manifest
   */
  async generateFrontendPhases(phaseDef, manifest, config, workingDirectory, isRegeneration = false) {
    console.log(`🎨 Generating frontend build phases`);

    const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
    if (tasks.length === 0) {
      console.warn('⚠️  frontend-task-list.json has no tasks; skipping dynamic phase generation.');
      return;
    }

    // Create backend-handoff.md file for Phase 2
    const handoffPath = path.join(workingDirectory, 'reference', 'backend-handoff.md');
    if (!fs.existsSync(handoffPath)) {
      const handoffTemplate = `# Backend Implementation Handoff

> Frontend developer notes for backend implementation.

## Overview

This document contains helpful notes from frontend developers to backend developers.
These are observations, mock patterns, and assumptions made during frontend development that might be useful for the backend implementation.

---

## Task Notes

<!-- Frontend tasks will add any relevant notes for backend below -->
`;
      fs.writeFileSync(handoffPath, handoffTemplate, 'utf8');
      console.log(`📝 Created backend-handoff.md for frontend → backend communication`);
    } else {
      console.log(`📝 Backend handoff document already exists`);
    }

    const tasksById = new Map();
    tasks.forEach(task => {
      if (task?.id) {
        tasksById.set(task.id, task);
      }
    });

    const totalFrontendTasks = tasks.length;
    const completedFrontendTasks = tasks.filter(task => (task.status || '').toLowerCase() === 'completed').length;

    let totalBackendTasks = null;
    try {
      const backendManifestPath = path.join(workingDirectory, 'reference', 'backend-task-list.json');
      if (fs.existsSync(backendManifestPath)) {
        const backendManifest = JSON.parse(fs.readFileSync(backendManifestPath, 'utf8'));
        if (Array.isArray(backendManifest.tasks)) {
          totalBackendTasks = backendManifest.tasks.length;
        } else {
          totalBackendTasks = 0;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Unable to read backend-task-list.json for counts: ${error.message}`);
      totalBackendTasks = null;
    }

    const planPhases = Array.isArray(manifest.executionPlan?.phases)
      ? manifest.executionPlan.phases
      : [];

    const seenTaskIds = new Set();
    const dynamicPhases = [];
    let sequenceCounter = 1;

    const normalizeArray = (value) => Array.isArray(value) ? value : [];

    const createBuildUnitContext = (task, phaseMeta, indexInPhase, totalInPhase) => ({
      id: task.id,
      title: task.title || task.name || task.id,
      type: task.type || 'unspecified',
      status: task.status || 'pending',
      description: task.description || '',
      dependencies: normalizeArray(task.dependencies),
      acceptanceCriteria: normalizeArray(task.acceptanceCriteria),
      prdReferences: normalizeArray(task.prdReference),
      uiDependencies: normalizeArray(task.uiDependencies),
      subtasks: normalizeArray(task.subtasks),
      lastUpdated: task.lastUpdated || null,
      phase: phaseMeta ? {
        order: phaseMeta.order ?? null,
        name: phaseMeta.name || null,
        rationale: phaseMeta.rationale || null,
        estimatedHours: phaseMeta.estimatedHours ?? null,
        indexInPhase,
        totalInPhase
      } : null,
      sequence: sequenceCounter++,
      frontendTotal: totalFrontendTasks,
      frontendCompleted: completedFrontendTasks,
      backendTotal: totalBackendTasks,
      shouldUseDevtools: (() => {
        const type = task.type;
        // Handle array of types
        if (Array.isArray(type)) {
          return type.some(t => ['ui', 'page', 'component', 'layout'].includes(t.toLowerCase()));
        }
        // Handle single type
        return ['ui', 'page', 'component', 'layout'].includes((type || '').toLowerCase());
      })(),
      raw: task
    });

    const createBuildTarget = (task, phaseMeta, indexInPhase, totalInPhase) => ({
      id: task.id,
      title: task.title || task.id,
      type: task.type || 'unspecified',
      status: task.status || 'pending',
      dependencies: normalizeArray(task.dependencies),
      acceptanceCriteria: normalizeArray(task.acceptanceCriteria),
      prdReference: normalizeArray(task.prdReference),
      uiDependencies: normalizeArray(task.uiDependencies),
      subtasks: normalizeArray(task.subtasks),
      executionPhase: phaseMeta ? {
        order: phaseMeta.order ?? null,
        name: phaseMeta.name || null,
        index: indexInPhase,
        total: totalInPhase
      } : null,
      manifestEntry: 'reference/frontend-task-list.json'
    });

    const createPhaseForTask = (task, phaseMeta, indexInPhase, totalInPhase) => {
      const buildUnit = createBuildUnitContext(task, phaseMeta, indexInPhase, totalInPhase);
      const buildTargets = [createBuildTarget(task, phaseMeta, indexInPhase, totalInPhase)];

      const phaseId = `${phaseDef.id}-${task.id}`;
      const promptFile = config.buildUnitTemplate?.promptFile || phaseDef.promptFile;

      const dynamicPhase = {
        id: phaseId,
        name: task.title || task.id,
        description: `Implement frontend task ${task.id} (${task.title || task.type || 'task'})`,
        promptFile,
        followUpPrompt: config.buildUnitTemplate?.followUpPrompt || null,
        sparcMode: phaseDef.sparcMode || 'architect',
        buildUnit,
        buildTargets,
        qualityGate: config.buildUnitTemplate?.qualityGate,
        contextPhaseId: ['phase-2'],  // Get BUILD-GUIDELINES from phase-2
        contextSections: ['read_first'],
        _dynamicPhase: true,
        _originalPhase: phaseDef.id
      };

      if (!dynamicPhase.promptFile) {
        dynamicPhase.task = `Implement frontend task ${task.id}: ${task.title || task.description || ''}`.trim();
      }

      dynamicPhases.push(dynamicPhase);
      console.log(`➕ Generated phase: ${phaseId} - ${dynamicPhase.name}`);
    };

    // Generate phases following execution plan order first
    for (const planPhase of planPhases) {
      const taskIds = normalizeArray(planPhase.taskIds).filter(Boolean);
      const totalInPhase = taskIds.length || 0;

      taskIds.forEach((taskId, index) => {
        const task = tasksById.get(taskId);
        if (!task) {
          console.warn(`⚠️  Task '${taskId}' referenced in executionPlan but not found in tasks array.`);
          return;
        }

        seenTaskIds.add(taskId);
        createPhaseForTask(task, planPhase, index + 1, totalInPhase);
      });
    }

    // Handle tasks not listed in execution plan (fallback order)
    const unplannedTasks = tasks.filter(task => task?.id && !seenTaskIds.has(task.id));
    if (unplannedTasks.length > 0) {
      console.log(`🔄 Adding ${unplannedTasks.length} unplanned tasks to dynamic phases (no executionPlan entry).`);
      unplannedTasks.forEach(task => createPhaseForTask(task, null, 1, 1));
    }

    // Add final phases (integration, etc.)
    for (const finalPhaseConfig of config.finalPhases || []) {
      const finalPhase = {
        id: `${phaseDef.id}-${finalPhaseConfig.id}`,
        name: finalPhaseConfig.name,
        description: finalPhaseConfig.description,
        promptFile: finalPhaseConfig.promptFile,
        outputContract: finalPhaseConfig.outputContract,
        qualityGate: finalPhaseConfig.qualityGate,
        sparcMode: phaseDef.sparcMode || 'architect',
        _dynamicPhase: true,
        _originalPhase: phaseDef.id,
        _finalPhase: true
      };

      dynamicPhases.push(finalPhase);
      console.log(`➕ Generated final phase: ${finalPhase.id} - ${finalPhase.name}`);
    }

    // Assign two-tier numbering: parent phase + sub-task position
    const totalSubTasks = dynamicPhases.length;
    dynamicPhases.forEach((phase, index) => {
      phase.parentPhaseNumber = phaseDef.parentPhaseNumber;
      phase.totalParentPhases = this.staticPhaseCount;
      phase.subTaskNumber = index + 1;
      phase.totalSubTasks = totalSubTasks;
      phase._originalPhaseName = phaseDef.name;  // Store parent name for display
    });
    
    // Insert the new phases into the workflow AFTER the current phase
    const insertionIndex = isRegeneration 
      ? this.phaseDefinitions.findIndex(p => p.id === phaseDef.id) + 1
      : this.currentPhaseIndex + 1;
    this.phaseDefinitions.splice(insertionIndex, 0, ...dynamicPhases);

    console.log(`✅ Generated ${dynamicPhases.length} frontend build phases`);
    console.log(`📊 Workflow expanded to ${this.phaseDefinitions.length} phases (${this.staticPhaseCount} base + ${totalSubTasks} sub-tasks)`);
    console.log(`📝 Backend handoff document ready at reference/backend-handoff.md`);
  }
  
  /**
   * Generate backend build phases from manifest
   */
  async generateBackendPhases(phaseDef, manifest, config, workingDirectory, isRegeneration = false) {
    console.log(`🔧 Generating backend build phases`);

    const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
    if (tasks.length === 0) {
      console.warn('⚠️  backend-task-list.json has no tasks; skipping dynamic phase generation.');
      return;
    }

    const tasksById = new Map();
    tasks.forEach(task => {
      if (task?.id) {
        tasksById.set(task.id, task);
      }
    });

    const totalBackendTasks = tasks.length;
    const completedBackendTasks = tasks.filter(task => (task.status || '').toLowerCase() === 'completed').length;

    let totalFrontendTasks = null;
    try {
      const frontendManifestPath = path.join(workingDirectory, 'reference', 'frontend-task-list.json');
      if (fs.existsSync(frontendManifestPath)) {
        const frontendManifest = JSON.parse(fs.readFileSync(frontendManifestPath, 'utf8'));
        if (Array.isArray(frontendManifest.tasks)) {
          totalFrontendTasks = frontendManifest.tasks.length;
        } else {
          totalFrontendTasks = 0;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Unable to read frontend-task-list.json for counts: ${error.message}`);
      totalFrontendTasks = null;
    }

    const planPhases = Array.isArray(manifest.executionPlan?.phases)
      ? manifest.executionPlan.phases
      : [];

    const seenTaskIds = new Set();
    const dynamicPhases = [];
    let sequenceCounter = 1;

    const normalizeArray = (value) => Array.isArray(value) ? value : [];

    const createBuildUnitContext = (task, phaseMeta, indexInPhase, totalInPhase) => ({
      id: task.id,
      title: task.title || task.name || task.id,
      type: task.type || 'unspecified',
      status: task.status || 'pending',
      description: task.description || '',
      dependencies: normalizeArray(task.dependencies),
      acceptanceCriteria: normalizeArray(task.acceptanceCriteria),
      prdReferences: normalizeArray(task.prdReference),
      // Backend-specific fields
      models: normalizeArray(task.models),
      actions: normalizeArray(task.actions),
      dataFetchers: normalizeArray(task.dataFetchers),
      backgroundJobs: normalizeArray(task.backgroundJobs),
      tracesTo: normalizeArray(task.tracesTo),
      lastUpdated: task.lastUpdated || null,
      phase: phaseMeta ? {
        order: phaseMeta.order ?? null,
        name: phaseMeta.name || null,
        rationale: phaseMeta.rationale || null,
        estimatedHours: phaseMeta.estimatedHours ?? null,
        indexInPhase,
        totalInPhase
      } : null,
      sequence: sequenceCounter++,
      backendTotal: totalBackendTasks,
      backendCompleted: completedBackendTasks,
      frontendTotal: totalFrontendTasks,
      raw: task
    });

    const createBuildTarget = (task, phaseMeta, indexInPhase, totalInPhase) => ({
      id: task.id,
      title: task.title || task.id,
      type: task.type || 'unspecified',
      status: task.status || 'pending',
      dependencies: normalizeArray(task.dependencies),
      acceptanceCriteria: normalizeArray(task.acceptanceCriteria),
      prdReference: normalizeArray(task.prdReference),
      models: normalizeArray(task.models),
      actions: normalizeArray(task.actions),
      dataFetchers: normalizeArray(task.dataFetchers),
      backgroundJobs: normalizeArray(task.backgroundJobs),
      executionPhase: phaseMeta ? {
        order: phaseMeta.order ?? null,
        name: phaseMeta.name || null,
        index: indexInPhase,
        total: totalInPhase
      } : null,
      manifestEntry: 'reference/backend-task-list.json'
    });

    const createPhaseForTask = (task, phaseMeta, indexInPhase, totalInPhase) => {
      const buildUnit = createBuildUnitContext(task, phaseMeta, indexInPhase, totalInPhase);
      const buildTargets = [createBuildTarget(task, phaseMeta, indexInPhase, totalInPhase)];

      const phaseId = `${phaseDef.id}-${task.id}`;
      const promptFile = config.buildUnitTemplate?.promptFile || phaseDef.promptFile;

      const dynamicPhase = {
        id: phaseId,
        name: task.title || task.id,
        description: `Implement backend task ${task.id} (${task.title || task.type || 'task'})`,
        promptFile,
        followUpPrompt: config.buildUnitTemplate?.followUpPrompt || null,
        sparcMode: phaseDef.sparcMode || 'architect',
        buildUnit,
        buildTargets,
        qualityGate: config.buildUnitTemplate?.qualityGate,
        contextPhaseId: ['phase-6', 'phase-1-2'],  // Get BUILD-GUIDELINES from phase-6, PRD context from phase-1-2
        contextSections: ['read_first'],
        _dynamicPhase: true,
        _originalPhase: phaseDef.id
      };

      if (!dynamicPhase.promptFile) {
        dynamicPhase.task = `Implement backend task ${task.id}: ${task.title || task.description || ''}`.trim();
      }

      dynamicPhases.push(dynamicPhase);
      console.log(`➕ Generated phase: ${phaseId} - ${dynamicPhase.name}`);
    };

    // Generate phases following execution plan order first
    for (const planPhase of planPhases) {
      const taskIds = normalizeArray(planPhase.taskIds).filter(Boolean);
      const totalInPhase = taskIds.length || 0;

      taskIds.forEach((taskId, index) => {
        const task = tasksById.get(taskId);
        if (!task) {
          console.warn(`⚠️  Task '${taskId}' referenced in executionPlan but not found in tasks array.`);
          return;
        }

        seenTaskIds.add(taskId);
        createPhaseForTask(task, planPhase, index + 1, totalInPhase);
      });
    }

    // Handle tasks not listed in execution plan (fallback order)
    const unplannedTasks = tasks.filter(task => task?.id && !seenTaskIds.has(task.id));
    if (unplannedTasks.length > 0) {
      console.log(`🔄 Adding ${unplannedTasks.length} unplanned tasks to dynamic phases (no executionPlan entry).`);
      unplannedTasks.forEach(task => createPhaseForTask(task, null, 1, 1));
    }

    // Add final phases (integration, etc.)
    for (const finalPhaseConfig of config.finalPhases || []) {
      const finalPhase = {
        id: `${phaseDef.id}-${finalPhaseConfig.id}`,
        name: finalPhaseConfig.name,
        description: finalPhaseConfig.description,
        promptFile: finalPhaseConfig.promptFile,
        outputContract: finalPhaseConfig.outputContract,
        qualityGate: finalPhaseConfig.qualityGate,
        sparcMode: phaseDef.sparcMode || 'architect',
        _dynamicPhase: true,
        _originalPhase: phaseDef.id,
        _finalPhase: true
      };

      dynamicPhases.push(finalPhase);
      console.log(`➕ Generated final phase: ${finalPhase.id} - ${finalPhase.name}`);
    }

    // Assign two-tier numbering: parent phase + sub-task position
    const totalSubTasks = dynamicPhases.length;
    dynamicPhases.forEach((phase, index) => {
      phase.parentPhaseNumber = phaseDef.parentPhaseNumber;
      phase.totalParentPhases = this.staticPhaseCount;
      phase.subTaskNumber = index + 1;
      phase.totalSubTasks = totalSubTasks;
      phase._originalPhaseName = phaseDef.name;  // Store parent name for display
    });
    
    // Insert the new phases into the workflow AFTER the current phase
    const insertionIndex = isRegeneration 
      ? this.phaseDefinitions.findIndex(p => p.id === phaseDef.id) + 1
      : this.currentPhaseIndex + 1;
    this.phaseDefinitions.splice(insertionIndex, 0, ...dynamicPhases);

    console.log(`✅ Generated ${dynamicPhases.length} backend build phases`);
    console.log(`📊 Workflow expanded to ${this.phaseDefinitions.length} phases (${this.staticPhaseCount} base + ${totalSubTasks} sub-tasks)`);
  }
  
  /**
   * Generate checklist remediation phases from findings manifest
   * Only creates phases for failed checklist items
   */
  async generateChecklistRemediationPhases(phaseDef, manifest, config, workingDirectory, isRegeneration = false) {
    console.log(`🔍 Generating checklist remediation phases`);
    
    // Filter to failed items only - findings.json now includes all item details
    const failedItems = (manifest.items || []).filter(item => item.status === 'fail');
    const dynamicPhases = [];
    
    if (failedItems.length === 0) {
      console.log(`✅ All checklist items passed - no remediation needed`);
    } else {
      console.log(`⚠️  Found ${failedItems.length} checklist items requiring remediation`);
      
      let sequenceCounter = 1;
      
      for (const finding of failedItems) {
        const phaseId = `${phaseDef.id}-${finding.id}`;
        
        // All details now come from findings.json (audit prompt includes them)
        const dynamicPhase = {
          id: phaseId,
          name: `Fix: ${finding.title || finding.id}`,
          description: finding.description || finding.details || `Fix checklist item: ${finding.id}`,
          promptFile: config.buildUnitTemplate?.promptFile,
          sparcMode: phaseDef.sparcMode || 'architect',
          buildUnit: {
            id: finding.id,
            title: finding.title || finding.id,
            description: finding.description || '',
            details: finding.details || '',
            category: finding.category || 'general',
            sequence: sequenceCounter++,
            totalItems: failedItems.length
          },
          qualityGate: config.buildUnitTemplate?.qualityGate,
          _dynamicPhase: true,
          _originalPhase: phaseDef.id
        };
        
        dynamicPhases.push(dynamicPhase);
        console.log(`➕ Generated remediation phase: ${phaseId} - ${dynamicPhase.name}`);
      }
    }
    
    // Add final phases (completion snapshot, etc.) - run even if no fixes needed
    for (const finalPhaseConfig of config.finalPhases || []) {
      const finalPhase = {
        id: `${phaseDef.id}-${finalPhaseConfig.id}`,
        name: finalPhaseConfig.name,
        description: finalPhaseConfig.description,
        promptFile: finalPhaseConfig.promptFile,
        outputContract: finalPhaseConfig.outputContract,
        qualityGate: finalPhaseConfig.qualityGate,
        gitSnapshot: finalPhaseConfig.gitSnapshot,
        snapshotName: finalPhaseConfig.snapshotName,
        sparcMode: phaseDef.sparcMode || 'architect',
        _dynamicPhase: true,
        _originalPhase: phaseDef.id,
        _finalPhase: true
      };
      dynamicPhases.push(finalPhase);
      console.log(`➕ Generated final phase: ${finalPhase.id} - ${finalPhase.name}`);
    }
    
    // If we have phases to add
    if (dynamicPhases.length > 0) {
      // Assign two-tier numbering: parent phase + sub-task position
      const totalSubTasks = dynamicPhases.length;
      dynamicPhases.forEach((phase, index) => {
        phase.parentPhaseNumber = phaseDef.parentPhaseNumber;
        phase.totalParentPhases = this.staticPhaseCount;
        phase.subTaskNumber = index + 1;
        phase.totalSubTasks = totalSubTasks;
        phase._originalPhaseName = phaseDef.name;  // Store parent name for display
      });
      
      // Mark last phase as final (if not already marked)
      if (!dynamicPhases[dynamicPhases.length - 1]._finalPhase) {
        dynamicPhases[dynamicPhases.length - 1]._finalPhase = true;
      }
      
      // Insert the new phases into the workflow AFTER the current phase
      const insertionIndex = isRegeneration 
        ? this.phaseDefinitions.findIndex(p => p.id === phaseDef.id) + 1
        : this.currentPhaseIndex + 1;
      this.phaseDefinitions.splice(insertionIndex, 0, ...dynamicPhases);
      
      console.log(`✅ Generated ${dynamicPhases.length} phases (${failedItems.length} remediation + ${(config.finalPhases || []).length} final)`);
      console.log(`📊 Workflow expanded to ${this.phaseDefinitions.length} phases (${this.staticPhaseCount} base + ${totalSubTasks} sub-tasks)`);
    }
  }
  
  /**
   * Group pages by similar routes for efficient building
   */
  groupPagesByRoute(pages) {
    const groups = [];
    const maxGroupSize = 5; // Build up to 5 pages in one phase
    
    // Sort pages by path to group similar routes together
    const sortedPages = [...pages].sort((a, b) => a.path.localeCompare(b.path));
    
    let currentGroup = [];
    for (const page of sortedPages) {
      currentGroup.push(page);
      
      if (currentGroup.length >= maxGroupSize) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  /**
   * Check if a phase ID represents the completion of dynamic phase generation
   */
  isDynamicPhaseGenerationComplete(phaseId) {
    const phase = this._findPhaseById(phaseId);
    return phase?._dynamicPhase && phase?._finalPhase;
  }
  
  /**
   * Find the original phase that generated the dynamic phases
   */
  findOriginalPhaseForDynamic(phaseId) {
    const dynamicPhase = this._findPhaseById(phaseId);
    if (!dynamicPhase?._originalPhase) return null;
    
    return this._findPhaseById(dynamicPhase._originalPhase);
  }
  
  /**
   * Internal helper: Find a phase by ID with various matching options
   * @private
   */
  _findPhaseById(phaseId, options = {}) {
    const { caseInsensitive = false, requireDynamicGeneration = false } = options;
    
    return this.phaseDefinitions.find(p => {
      const idMatch = caseInsensitive 
        ? (p.id || '').toLowerCase() === phaseId.toLowerCase()
        : p.id === phaseId;
      
      if (!idMatch) return false;
      
      if (requireDynamicGeneration) {
        return p.dynamicPhaseGeneration?.enabled;
      }
      
      return true;
    });
  }
  
  /**
   * Regenerate dynamic phases from manifest for restart
   * @private
   */
  _regenerateDynamicPhasesForRestart(parentPhase, workingDirectory, targetTaskId = null) {
    try {
      const config = parentPhase.dynamicPhaseGeneration;
      if (!config?.enabled) return false;
      
      // Load the manifest
      const manifestPath = path.join(workingDirectory, config.manifestPath);
      if (!fs.existsSync(manifestPath)) {
        console.log(`⚠️  Manifest not found at ${manifestPath}, cannot regenerate dynamic phases`);
        return false;
      }
      
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log(`📋 Loaded manifest for phase regeneration`);
      
      // Find the parent phase index
      const parentIdx = this.phaseDefinitions.findIndex(p => p.id === parentPhase.id);
      if (parentIdx < 0) return false;
      
      // Generate phases based on mode (numbering is handled by generate* functions)
      if (config.mode === 'frontend-build') {
        this.generateFrontendPhases(parentPhase, manifest, config, workingDirectory, true);
        console.log(`✅ Regenerated frontend dynamic phases for restart`);
        
        // Mark phases before targetTaskId as completed if targetTaskId is specified
        if (targetTaskId) {
          let foundTarget = false;
          for (const task of manifest.tasks || []) {
            if (task.id === targetTaskId) {
              foundTarget = true;
              break;
            }
            task.status = 'completed';
          }
          if (!foundTarget) {
            console.warn(`⚠️  Target task ${targetTaskId} not found in manifest`);
          }
        }
        
        return true;
      }
      
      if (config.mode === 'backend-build') {
        this.generateBackendPhases(parentPhase, manifest, config, workingDirectory, true);
        console.log(`✅ Regenerated backend dynamic phases for restart`);

        // Mark phases before targetTaskId as completed if targetTaskId is specified
        if (targetTaskId) {
          let foundTarget = false;
          for (const task of manifest.tasks || []) {
            if (task.id === targetTaskId) {
              foundTarget = true;
              break;
            }
            task.status = 'completed';
          }
          if (!foundTarget) {
            console.warn(`⚠️  Target task ${targetTaskId} not found in manifest`);
          }
        }

        return true;
      }
      
      if (config.mode === 'checklist-remediation') {
        this.generateChecklistRemediationPhases(parentPhase, manifest, config, workingDirectory, true);
        console.log(`✅ Regenerated checklist remediation phases for restart`);
        return true;
      }
      
      // Original user story generation logic (if needed)
      console.log(`⚠️  Regeneration for mode '${config.mode}' not implemented`);
      return false;
      
    } catch (error) {
      console.error(`❌ Failed to regenerate dynamic phases: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Internal helper: Get execution mode based on file extension
   * @private
   */
  _getExecutionModeByExtension(filepath) {
    if (!filepath) return null;
    
    const ext = path.extname(filepath);
    if (ext === '.js') return EXECUTION_MODES.JS_DEFAULT;
    if (ext === '.md') return EXECUTION_MODES.DEFAULT;
    
    return null;
  }
  
  /**
   * Determine execution mode for a phase based on file extension and configuration
   */
  determineExecutionMode(phaseDef) {
    // First check if phase has explicit executionMode specified
    if (phaseDef.executionMode) {
      return phaseDef.executionMode;
    }
    
    // Check for promptFile and determine mode based on file extension
    if (phaseDef.promptFile) {
      const mode = this._getExecutionModeByExtension(phaseDef.promptFile);
      if (mode) return mode;
    }
    
    // Check for qualityGate file extension for gate execution
    if (phaseDef.qualityGate && phaseDef.qualityGate.file) {
      const mode = this._getExecutionModeByExtension(phaseDef.qualityGate.file);
      if (mode) {
        // Use gate-specific mode for .md gates
        return mode === EXECUTION_MODES.DEFAULT ? EXECUTION_MODES.GATE_DEFAULT : mode;
      }
    }
    
    // Fall back to default mode
    return EXECUTION_MODES.DEFAULT;
  }
  
  /**
   * Get mode configuration from workflow or fallback
   */
  getModeConfiguration(modeName, visited = new Set()) {
    // Detect circular references
    if (visited.has(modeName)) {
      const chain = [...visited, modeName].join(' -> ');
      throw new Error(`Circular mode reference detected: ${chain}`);
    }
    visited.add(modeName);
    
    // Check workflow config first (workflow overrides fallback)
    if (this.workflowExecutionModes && this.workflowExecutionModes[modeName]) {
      const config = this.workflowExecutionModes[modeName];
      
      // If the config is a string, it's a reference to another mode - resolve it
      if (typeof config === 'string') {
        return this.getModeConfiguration(config, visited);
      }
      
      return config;
    }
    
    // Check fallback modes (clean names)
    if (this.fallbackModes[modeName]) {
      return this.fallbackModes[modeName];
    }
    
    throw new Error(`Execution mode '${modeName}' not found in workflow or fallback configurations`);
  }

  normalizeDirectAgentConfig(configBlock) {
    const defaultConfig = {
      provider: 'claude',
      providers: {
        claude: {
          phaseCommand: {
            command: 'claude',
            args: ['$(cat {tempPromptFile})'],
            flags: ['--print', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions', '--mcp-config', '.mcp.json']
          },
          gateCommand: {
            command: 'claude',
            args: ['$(cat {tempPromptFile})'],
            flags: ['--output-format', 'json', '--dangerously-skip-permissions', '--mcp-config', '.mcp.json']
          },
          sessionCommand: {
            command: 'claude',
            args: ['--print', '--output-format', 'json', '--dangerously-skip-permissions', '--mcp-config', '.mcp.json', '--session-id', '{{SESSION_ID}}']
          },
          resumeCommand: {
            command: 'claude',
            args: ['--print', '--output-format', 'json', '--dangerously-skip-permissions', '--mcp-config', '.mcp.json', '--resume', '{{SESSION_ID}}']
          }
        }
      }
    };

    if (!configBlock || typeof configBlock !== 'object') {
      return defaultConfig;
    }

    const merged = {
      provider: configBlock.provider || defaultConfig.provider,
      continuousTestingProvider: configBlock.continuousTestingProvider || configBlock.provider || defaultConfig.provider,
      providers: {
        ...defaultConfig.providers,
        ...(configBlock.providers || {})
      }
    };

    if (!merged.providers[merged.provider]) {
      merged.provider = defaultConfig.provider;
    }
    
    if (!merged.providers[merged.continuousTestingProvider]) {
      merged.continuousTestingProvider = merged.provider;
    }

    return merged;
  }

  applyDirectAgentOverrides() {
    const providerConfig = this.getDirectAgentProviderConfig();
    if (!providerConfig) {
      return;
    }

    const phaseMode = this.buildDirectAgentMode(providerConfig.phaseCommand);
    if (phaseMode) {
      this.fallbackModes['default'] = phaseMode;
    }

    const gateMode = this.buildDirectAgentMode(providerConfig.gateCommand);
    if (gateMode) {
      this.fallbackModes['gate-default'] = gateMode;
    }

    this.directAgentProviderName = this.directAgentConfig.provider;
    const testingProvider = this.directAgentConfig.continuousTestingProvider;
    if (testingProvider && testingProvider !== this.directAgentProviderName) {
      console.log(`🧠 Gate provider: '${this.directAgentProviderName}', Continuous testing: '${testingProvider}'`);
    } else {
      console.log(`🧠 Direct agent provider set to '${this.directAgentProviderName}'`);
    }
  }

  buildDirectAgentMode(commandConfig) {
    if (!commandConfig?.command) {
      return null;
    }

    return {
      command: commandConfig.command,
      args: [...(commandConfig.args || [])],
      flags: [...(commandConfig.flags || [])],
      promptFormat: commandConfig.promptSource === 'none' ? 'none' : 'tempfile',
      providerName: this.directAgentConfig.provider,
      promptSource: commandConfig.promptSource || 'tempfile',
      pipePrompt: Boolean(commandConfig.pipePrompt)
    };
  }

  getDirectAgentProvider() {
    return this.directAgentConfig?.provider || 'claude';
  }

  getDirectAgentProviderConfig() {
    const providerName = this.getDirectAgentProvider();
    return this.directAgentConfig?.providers?.[providerName] || null;
  }

  getDirectAgentRuntimeConfig() {
    // Use continuousTestingProvider for session-based testing (separate from gate provider)
    const providerName = this.directAgentConfig?.continuousTestingProvider || this.getDirectAgentProvider();
    const providerConfig = this.directAgentConfig?.providers?.[providerName] || null;
    if (!providerConfig) {
      return null;
    }
    return {
      provider: providerName,
      sessionCommand: this.buildRuntimeCommand(providerConfig.sessionCommand),
      resumeCommand: this.buildRuntimeCommand(providerConfig.resumeCommand)
    };
  }

  buildRuntimeCommand(commandConfig) {
    if (!commandConfig?.command) {
      return null;
    }
    return {
      command: commandConfig.command,
      argsTemplate: [...(commandConfig.args || [])]
    };
  }

  buildDirectAgentSessionArgs(isFirstMessage, sessionId) {
    const runtime = this.getDirectAgentRuntimeConfig();
    if (!runtime) return null;
    const template = isFirstMessage ? runtime.sessionCommand : runtime.resumeCommand;
    if (!template) return null;
    const args = template.argsTemplate.map(arg => arg.replace(/\{\{SESSION_ID\}\}/g, sessionId));
    return {
      provider: runtime.provider,
      command: template.command,
      args
    };
  }
}

module.exports = WorkflowManager;
