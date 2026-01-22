/**
 * Lightweight server health utilities for phases that modify code
 * 
 * NOTE: This module provides supplementary health checks. The primary server
 * health mechanism is now Claude Code hooks (.claude/hooks.json) which run
 * the check-or-start-dev-server.sh script after every file write. This gives
 * instant feedback to the agent when it breaks the build.
 * 
 * This module is still used for:
 * - Gate failure detection (checking if server crashed during phase)
 * - Pre-phase status logging
 * 
 * The background monitor-server.sh provides a third layer of protection,
 * checking every 3 minutes as a safety net.
 */
const { execSync } = require('child_process');

// Use PORT from environment (Railway sets this)
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function checkServerHealth() {
  try {
    const response = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -L --max-time 3 ${SERVER_URL} 2>/dev/null || echo "000"`,
      { encoding: 'utf8' }
    ).trim();
    
    return {
      healthy: ['200', '301', '302', '303', '307', '308'].includes(response),
      code: response
    };
  } catch (error) {
    return { healthy: false, code: '000' };
  }
}

function logServerStatus(phaseId) {
  const { healthy, code } = checkServerHealth();
  if (!healthy) {
    console.log(`⚠️  Server health check failed for ${phaseId} (code: ${code})`);
    console.log(`   Checking port ${PORT} - if server is down, monitor will auto-restart it within 3 minutes`);
  }
  return healthy;
}

module.exports = {
  checkServerHealth,
  logServerStatus
};
