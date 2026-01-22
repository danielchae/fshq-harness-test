const fs = require('fs');
const path = require('path');

const FRONTEND_MANIFEST_PATH = path.join('reference', 'frontend-task-list.json');

function resolveManifestPath(workspaceRoot) {
  return path.join(workspaceRoot, FRONTEND_MANIFEST_PATH);
}

function readManifest(manifestPath) {
  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`⚠️  Failed to read frontend task manifest: ${error.message}`);
    return null;
  }
}

function writeManifest(manifestPath, manifest) {
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    console.warn(`⚠️  Failed to write frontend task manifest: ${error.message}`);
    return false;
  }
}

function setFrontendTaskStatus(workspaceRoot, taskId, status) {
  if (!taskId || !status) return false;

  const allowedStatuses = new Set(['pending', 'in_progress', 'completed']);
  if (!allowedStatuses.has(status)) {
    console.warn(`⚠️  Invalid task status '${status}' for ${taskId}. Skipping update.`);
    return false;
  }

  const manifestPath = resolveManifestPath(workspaceRoot);
  const manifest = readManifest(manifestPath);
  if (!manifest || !Array.isArray(manifest.tasks)) {
    console.warn('⚠️  Frontend manifest missing or malformed. Cannot update task status.');
    return false;
  }

  const task = manifest.tasks.find((t) => t?.id === taskId);
  if (!task) {
    console.warn(`⚠️  Task '${taskId}' not found in frontend manifest.`);
    return false;
  }

  if (task.status === status) {
    return true;
  }

  task.status = status;
  task.lastUpdated = new Date().toISOString();

  return writeManifest(manifestPath, manifest);
}

module.exports = {
  setFrontendTaskStatus
};

