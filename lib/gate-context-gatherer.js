/**
 * Gate Context Gatherer Module
 * Gathers context information for gate-only phases
 */

const fs = require('fs');
const path = require('path');

// Constants for context gathering
const CONTEXT_PATTERNS = {
  COVERAGE_GATE: /coverage/,
  FILE_EXTENSIONS: {
    JSON: '.json',
    MARKDOWN: '.md'
  }
};

class GateContextGatherer {
  /**
   * Gather context for gate-only phases
   * Provides information about files created in previous phases
   */
  static async gatherContext(phaseDef, workingDirectory) {
    // For coverage validation gates, provide summary of what was created
    if (phaseDef.id && CONTEXT_PATTERNS.COVERAGE_GATE.test(phaseDef.id)) {
      return GateContextGatherer._gatherCoverageContext(workingDirectory);
    }
    
    // For other gate-only phases, provide a general summary
    return GateContextGatherer._gatherGeneralContext(workingDirectory);
  }

  /**
   * Gather context for coverage validation gates
   * @private
   */
  static _gatherCoverageContext(workingDirectory) {
    try {
      const context = [];
      
      // List user stories created
      const userStoriesDir = path.join(workingDirectory, 'prd', 'user-stories');
      if (fs.existsSync(userStoriesDir)) {
        context.push('=== User Stories Directory Structure ===');
        const listFiles = (dir, prefix = '') => {
          const items = fs.readdirSync(dir);
          items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              context.push(`${prefix}📁 ${item}/`);
              listFiles(fullPath, prefix + '  ');
            } else if (item.endsWith(CONTEXT_PATTERNS.FILE_EXTENSIONS.JSON) || 
                       item.endsWith(CONTEXT_PATTERNS.FILE_EXTENSIONS.MARKDOWN)) {
              const size = stat.size;
              context.push(`${prefix}📄 ${item} (${size} bytes)`);
            }
          });
        };
        listFiles(userStoriesDir);
      }
      
      // Check for manifest
      const manifestPath = path.join(userStoriesDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        context.push('\n=== Manifest Summary ===');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        context.push(`Total Components: ${manifest.components?.length || 0}`);
        context.push(`Story Files Listed: ${manifest.storyFiles?.length || 0}`);
      }
      
      // Check for gap analysis report
      const gapReportPath = path.join(userStoriesDir, 'gap-analysis-report.md');
      if (fs.existsSync(gapReportPath)) {
        context.push('\n=== Gap Analysis Report ===');
        context.push('✅ Gap analysis report exists');
      }
      
      // Provide summary of EARS inputs for comparison
      const earsDir = path.join(workingDirectory, 'ears-outputs');
      if (fs.existsSync(earsDir)) {
        context.push('\n=== Available Requirements ===');
        const earsFiles = fs.readdirSync(earsDir).filter(f => f.endsWith('.json'));
        earsFiles.forEach(file => {
          context.push(`📋 ${file}`);
        });
      }
      
      return context.join('\n');
    } catch (error) {
      console.log('⚠️ Could not gather full context:', error.message);
      return 'Context gathering failed - please check file system';
    }
  }

  /**
   * Gather general context for other gate-only phases
   * @private
   */
  static _gatherGeneralContext(workingDirectory) {
    try {
      const prdDir = path.join(workingDirectory, 'prd');
      if (fs.existsSync(prdDir)) {
        const context = [`=== PRD Directory Overview ===`];
        const dirs = fs.readdirSync(prdDir).filter(item => 
          fs.statSync(path.join(prdDir, item)).isDirectory()
        );
        dirs.forEach(dir => {
          const files = fs.readdirSync(path.join(prdDir, dir));
          context.push(`📁 ${dir}/ (${files.length} items)`);
        });
        return context.join('\n');
      }
    } catch (error) {
      console.log('⚠️ Could not gather context:', error.message);
    }
    
    return null; // No context for other phases
  }
}

module.exports = GateContextGatherer;
