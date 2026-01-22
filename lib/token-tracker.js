/**
 * Token Tracker Module
 * Parses Claude Code JSONL usage logs and Gemini JSON output,
 * sends aggregated token data to Inngest
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class TokenTracker {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.claudeDir = path.join(
      process.env.HOME || '/home/appuser',
      '.claude',
      'projects'
    );
    this.sentUuids = new Set();
    this.repositoryName = process.env.GITHUB_REPOSITORY || '';
    this.eventKey = process.env.INNGEST_EVENT_KEY || '';
    
    // Track Gemini tokens separately (keyed by hash to avoid duplicates)
    this.sentGeminiHashes = new Set();
    this.pendingGeminiTokens = {
      input: 0,
      output: 0,
      cached_content: 0,
      model: null
    };
  }

  /**
   * Find JSONL files for current workspace
   */
  findSessionFiles() {
    // Claude encodes paths: /workspace -> -workspace
    const encodedPath = this.workingDirectory.replace(/\//g, '-');
    const projectDir = path.join(this.claudeDir, encodedPath);
    
    if (!fs.existsSync(projectDir)) {
      // Try alternate path encoding
      const altPath = this.workingDirectory.replace(/^\//, '').replace(/\//g, '-');
      const altDir = path.join(this.claudeDir, `-${altPath}`);
      if (fs.existsSync(altDir)) {
        return fs.readdirSync(altDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => path.join(altDir, f));
      }
      return [];
    }
    
    return fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(projectDir, f));
  }

  /**
   * Send token event to Inngest with full token breakdown
   */
  sendToInngest(tokenData) {
    if (!this.eventKey) return;

    const payload = JSON.stringify({
      name: 'builder/output.ready',
      data: {
        repositoryName: this.repositoryName,
        model: tokenData.model,
        input_tokens: tokenData.input_tokens,
        output_tokens: tokenData.output_tokens,
        // Claude cache fields (only included if present)
        ...(tokenData.cache_creation_input_tokens !== undefined && {
          cache_creation_input_tokens: tokenData.cache_creation_input_tokens
        }),
        ...(tokenData.cache_read_input_tokens !== undefined && {
          cache_read_input_tokens: tokenData.cache_read_input_tokens
        }),
        // Gemini cache field (only included if present)
        ...(tokenData.cached_content_token_count !== undefined && {
          cached_content_token_count: tokenData.cached_content_token_count
        })
      }
    });

    const req = https.request(`https://inn.gs/e/${this.eventKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    });

    req.on('error', () => {}); // Silently ignore errors
    req.write(payload);
    req.end();
  }

  /**
   * Extract Gemini usage from JSON output string
   * Gemini CLI with --output-format json returns usageMetadata
   */
  extractGeminiTokens(jsonOutput) {
    if (!jsonOutput || typeof jsonOutput !== 'string') return null;
    
    try {
      // Try to find JSON with usageMetadata
      // Gemini output may have multiple JSON objects, find ones with usage
      const lines = jsonOutput.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          
          // Check for Gemini's usageMetadata format (camelCase)
          if (parsed.usageMetadata) {
            return {
              input: parsed.usageMetadata.promptTokenCount || 0,
              output: parsed.usageMetadata.candidatesTokenCount || 0,
              cached_content: parsed.usageMetadata.cachedContentTokenCount || 0,
              model: parsed.model || 'gemini-unknown'
            };
          }
          
          // Check for usage_metadata (snake_case variant)
          if (parsed.usage_metadata) {
            return {
              input: parsed.usage_metadata.prompt_token_count || 0,
              output: parsed.usage_metadata.candidates_token_count || 0,
              cached_content: parsed.usage_metadata.cached_content_token_count || 0,
              model: parsed.model || 'gemini-unknown'
            };
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    } catch (e) {
      // Parsing failed
    }
    
    return null;
  }

  /**
   * Add Gemini tokens from phase/gate/test output
   */
  addGeminiTokens(output) {
    const tokens = this.extractGeminiTokens(output);
    if (!tokens) return;
    
    // Create hash based on token values and model to avoid counting same response twice
    const hash = `${tokens.model}-${tokens.input}-${tokens.output}-${tokens.cached_content}`;
    if (this.sentGeminiHashes.has(hash)) return;
    
    this.pendingGeminiTokens.input += tokens.input;
    this.pendingGeminiTokens.output += tokens.output;
    this.pendingGeminiTokens.cached_content += tokens.cached_content;
    this.pendingGeminiTokens.model = tokens.model;
    this.sentGeminiHashes.add(hash);
  }

  /**
   * Process all JSONL files, aggregate unsent tokens, send events
   * Optionally pass output for Gemini token extraction
   */
  async processAndSend(output = null) {
    // Extract Gemini tokens from output if provided
    if (output) {
      this.addGeminiTokens(output);
    }
    
    const files = this.findSessionFiles();
    
    // Aggregate Claude totals by model (to separate opus vs sonnet, etc.)
    const claudeByModel = new Map();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            
            // Skip if already counted
            if (!entry.uuid || this.sentUuids.has(entry.uuid)) continue;
            
            // Extract usage data
            const usage = entry.message?.usage;
            const entryModel = entry.message?.model;
            
            if (usage && entryModel) {
              // Only count if we have any token data
              const hasTokens = usage.input_tokens || usage.output_tokens || 
                               usage.cache_creation_input_tokens || usage.cache_read_input_tokens;
              
              if (hasTokens) {
                // Get or create bucket for this model
                if (!claudeByModel.has(entryModel)) {
                  claudeByModel.set(entryModel, {
                    input: 0,
                    output: 0,
                    cacheCreation: 0,
                    cacheRead: 0,
                    entries: 0
                  });
                }
                const bucket = claudeByModel.get(entryModel);
                bucket.input += usage.input_tokens || 0;
                bucket.output += usage.output_tokens || 0;
                bucket.cacheCreation += usage.cache_creation_input_tokens || 0;
                bucket.cacheRead += usage.cache_read_input_tokens || 0;
                bucket.entries++;
                this.sentUuids.add(entry.uuid);
              }
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    }

    // Send separate event for each Claude model
    for (const [model, bucket] of claudeByModel) {
      this.sendToInngest({
        model: model,
        input_tokens: bucket.input,
        output_tokens: bucket.output,
        cache_creation_input_tokens: bucket.cacheCreation,
        cache_read_input_tokens: bucket.cacheRead
      });
      
      const cacheInfo = bucket.cacheCreation || bucket.cacheRead 
        ? ` (cache: +${bucket.cacheCreation} create, ${bucket.cacheRead} read)`
        : '';
      console.log(`📊 Sent ${model} tokens: ${bucket.input} in / ${bucket.output} out${cacheInfo} (${bucket.entries} calls)`);
    }

    // Send Gemini aggregated event if we have pending data
    if (this.pendingGeminiTokens.model && 
        (this.pendingGeminiTokens.input > 0 || this.pendingGeminiTokens.output > 0)) {
      this.sendToInngest({
        model: this.pendingGeminiTokens.model,
        input_tokens: this.pendingGeminiTokens.input,
        output_tokens: this.pendingGeminiTokens.output,
        cached_content_token_count: this.pendingGeminiTokens.cached_content
      });
      
      const cacheInfo = this.pendingGeminiTokens.cached_content 
        ? ` (cached: ${this.pendingGeminiTokens.cached_content})`
        : '';
      console.log(`📊 Sent Gemini tokens: ${this.pendingGeminiTokens.input} in / ${this.pendingGeminiTokens.output} out${cacheInfo}`);
      
      // Reset pending Gemini tokens
      this.pendingGeminiTokens = { input: 0, output: 0, cached_content: 0, model: null };
    }
  }

  /**
   * Track tokens from a single command output (for continuous testing)
   * Detects provider from output format and sends immediately
   */
  async trackFromOutput(output, providerHint = null) {
    if (!output) return;
    
    // Try Gemini extraction first if hint suggests it
    if (providerHint === 'gemini' || output.includes('usageMetadata') || output.includes('usage_metadata')) {
      const geminiTokens = this.extractGeminiTokens(output);
      if (geminiTokens) {
        this.sendToInngest({
          model: geminiTokens.model,
          input_tokens: geminiTokens.input,
          output_tokens: geminiTokens.output,
          cached_content_token_count: geminiTokens.cached_content
        });
        
        const cacheInfo = geminiTokens.cached_content 
          ? ` (cached: ${geminiTokens.cached_content})`
          : '';
        console.log(`📊 Sent Gemini tokens: ${geminiTokens.input} in / ${geminiTokens.output} out${cacheInfo}`);
        return;
      }
    }
    
    // For Claude, we rely on JSONL files which are written by the CLI
    // Call processAndSend to pick up any new entries
    await this.processAndSend();
  }
}

module.exports = TokenTracker;
