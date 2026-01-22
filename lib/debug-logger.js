const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DebugLogger {
  constructor({ workingDirectory, workflowId }) {
    this.enabled = process.env.CFBUILD_DEBUG_LOGS !== 'false';
    this.workflowId = workflowId || 'unknown-workflow';
    this.workingDirectory = workingDirectory || process.cwd();
    this.baseDir = path.join(this.workingDirectory, 'log', 'debug');

    if (this.enabled) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (error) {
        console.warn(`⚠️  Unable to create debug log directory: ${error.message}`);
        this.enabled = false;
      }
    }
  }

  isEnabled() {
    return this.enabled;
  }

  log(scope, event, payload = {}) {
    if (!this.enabled) return;

    const entry = {
      ts: new Date().toISOString(),
      workflowId: this.workflowId,
      scope,
      event,
      ...payload
    };

    try {
      const logFile = path.join(this.baseDir, `${this.workflowId}.log`);
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
    } catch (error) {
      console.warn(`⚠️  Failed to write debug log entry: ${error.message}`);
    }
  }

  saveTextArtifact({
    scope = 'artifact',
    event = 'artifact-saved',
    phaseId = 'unknown-phase',
    attempt = 0,
    role = 'phase',
    kind = 'prompt',
    extension = 'txt',
    content = ''
  } = {}) {
    if (!this.enabled || typeof content !== 'string') return null;

    const timestamp = Date.now();
    const safePhase = (phaseId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRole = (role || 'phase').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeKind = (kind || 'prompt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const attemptSuffix = attempt ? `-attempt-${attempt}` : '';
    const safeExtension = (extension || 'txt').replace(/[^a-zA-Z0-9.]/g, '');
    const fileName = `${this.workflowId}-${timestamp}-${safePhase}-${safeRole}-${safeKind}${attemptSuffix}.${safeExtension || 'txt'}`;
    const filePath = path.join(this.baseDir, fileName);

    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      console.warn(`⚠️  Failed to write debug artifact (${fileName}): ${error.message}`);
      return null;
    }

    const size = Buffer.byteLength(content, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const relativePath = path.relative(this.workingDirectory, filePath);

    this.log(scope, event, {
      phaseId,
      attempt,
      role,
      kind,
      path: relativePath,
      size,
      sha256
    });

    return {
      filePath,
      relativePath,
      size,
      sha256
    };
  }

  createProcessLog({ phaseId, attempt, kind }) {
    if (!this.enabled) return null;

    const timestamp = Date.now();
    const safePhase = (phaseId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeKind = (kind || 'process').replace(/[^a-zA-Z0-9_-]/g, '_');
    const attemptSuffix = typeof attempt === 'number' ? `-attempt-${attempt}` : '';
    const baseName = `${timestamp}-${safePhase}-${safeKind}${attemptSuffix}`;
    const stdoutPath = path.join(this.baseDir, `${this.workflowId}-${baseName}.stdout.log`);
    const stderrPath = path.join(this.baseDir, `${this.workflowId}-${baseName}.stderr.log`);

    const append = (targetPath, chunk) => {
      try {
        const data = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        fs.appendFileSync(targetPath, data, 'utf8');
      } catch (error) {
        console.warn(`⚠️  Failed to write process log (${targetPath}): ${error.message}`);
      }
    };

    const close = () => {
      // No-op for appendFileSync, but kept for API symmetry
    };

    return {
      stdoutPath,
      stderrPath,
      writeStdout: (chunk) => append(stdoutPath, chunk),
      writeStderr: (chunk) => append(stderrPath, chunk),
      close
    };
  }
}

module.exports = DebugLogger;

