const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

if (!childProcess.spawn.__cfbuildHooked) {
  const workspaceRoot = process.env.CFBUILD_WORKSPACE_ROOT || process.cwd();
  const debugDir = path.join(workspaceRoot, 'log', 'debug', 'claude-flow');

  try {
    fs.mkdirSync(debugDir, { recursive: true });
  } catch (_) {
    // Swallow directory creation errors; logging is best-effort
  }

  const originalSpawn = childProcess.spawn;
  const originalSpawnSync = childProcess.spawnSync;

  const resolveUniqueId = () => {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  };

  const normaliseArgs = (args) => {
    if (Array.isArray(args)) {
      return args.slice();
    }
    return [];
  };

  const normaliseOptions = (options) => {
    if (options && typeof options === 'object') {
      return { ...options };
    }
    return {};
  };

  const getCommandBase = (command) => {
    if (typeof command !== 'string') return '';
    const trimmed = command.trim();
    if (!trimmed) return '';
    const firstToken = trimmed.split(/\s+/)[0];
    return path.basename(firstToken);
  };

  const shouldCapture = (command) => {
    const base = getCommandBase(command).toLowerCase();
    return base === 'claude' || base === 'claude.cmd';
  };

  const extractPrompt = (args, options, command) => {
    if (Array.isArray(args) && args.length > 0) {
      for (let idx = args.length - 1; idx >= 0; idx -= 1) {
        const value = args[idx];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
    }

    if (typeof command === 'string' && (options?.shell === true)) {
      return command;
    }

    return '';
  };

  const diffEnv = (env) => {
    if (!env || typeof env !== 'object') return undefined;
    const diff = {};
    for (const [key, value] of Object.entries(env)) {
      if (process.env[key] !== value) {
        diff[key] = value;
      }
    }
    return Object.keys(diff).length ? diff : undefined;
  };

  const captureSpawn = (command, args, options) => {
    if (!shouldCapture(command)) {
      return;
    }

    const uniqueId = resolveUniqueId();
    const promptContent = extractPrompt(args, options, command);
    const promptSize = Buffer.byteLength(promptContent || '', 'utf8');

    const promptFilePath = promptContent
      ? path.join(debugDir, `${uniqueId}-prompt.txt`)
      : null;

    try {
      if (promptFilePath) {
        fs.writeFileSync(promptFilePath, promptContent, 'utf8');
      }

      const metadata = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        ppid: process.ppid,
        command,
        args,
        options: {
          shell: Boolean(options?.shell),
          cwd: options?.cwd || null
        },
        envOverrides: diffEnv(options?.env),
        prompt: {
          size: promptSize,
          sha256: crypto.createHash('sha256').update(promptContent || '').digest('hex'),
          path: promptFilePath ? path.relative(workspaceRoot, promptFilePath) : null
        }
      };

      const metaPath = path.join(debugDir, `${uniqueId}.json`);
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
      // Do not disrupt execution if logging fails.
      // eslint-disable-next-line no-console
      console.warn(`⚠️  Claude Flow spawn logger failed: ${error.message}`);
    }
  };

  childProcess.spawn = function patchedSpawn(command, args, options) {
    const actualArgs = normaliseArgs(args);
    const actualOptions = Array.isArray(args) ? normaliseOptions(options) : normaliseOptions(args);

    try {
      captureSpawn(command, actualArgs, actualOptions);
    } catch (_) {
      // Ignore logging errors to avoid impacting spawn behaviour
    }

    return originalSpawn.apply(childProcess, arguments);
  };

  childProcess.spawnSync = function patchedSpawnSync(command, args, options) {
    const actualArgs = normaliseArgs(args);
    const actualOptions = Array.isArray(args) ? normaliseOptions(options) : normaliseOptions(args);

    try {
      captureSpawn(command, actualArgs, actualOptions);
    } catch (_) {
      // Ignore logging errors to avoid impacting spawn behaviour
    }

    return originalSpawnSync.apply(childProcess, arguments);
  };

  childProcess.spawn.__cfbuildHooked = true;
}


