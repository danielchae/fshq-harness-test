/**
 * Gate Parser Module
 * Handles parsing of gate JSON output in various formats
 */

class GateParser {
  /**
   * Parse gate JSON from various output formats
   * Handles: markdown code blocks, stream-json, plain JSON, Claude CLI wrapped responses
   */
  static parseGateJSON(output, depth = 0) {
    if (depth > 8) {
      console.error("❌ Gate parser exceeded maximum nesting depth");
      return null;
    }
    // Handle empty or very short responses
    if (!output || output.trim().length < 10) {
      console.error("❌ Gate returned empty or minimal response");
      console.error(
        "📌 This often happens when Claude doesn't format the response as JSON",
      );
      return null;
    }

    // Check if response is just the wrapper with no actual content
    // Remove the wrapper that gets added by our logging
    const cleanedOutput = output
      .replace(/=== LLM Gate Response ===\s*/g, "")
      .trim();
    if (!cleanedOutput || cleanedOutput.length < 10) {
      console.error("❌ Gate returned empty response (no JSON content)");
      console.error(
        "📌 Claude may have returned explanatory text instead of JSON",
      );
      return null;
    }

    // Check if response is plain text instead of JSON
    // Common patterns: "PASS", "FAIL", "The ... validation", etc.
    // Must have no JSON structure indicators
    const looksLikePlainText =
      !cleanedOutput.includes("{") &&
      !cleanedOutput.includes("```") &&
      (cleanedOutput.match(
        /\b(PASS|FAIL|pass|fail|validation|score|The|This)\b/i,
      ) ||
        cleanedOutput.length > 50);

    if (looksLikePlainText) {
      console.error(
        "❌ Gate returned plain text response instead of JSON format",
      );
      console.error(
        `   Response preview: "${cleanedOutput.substring(0, 100)}..."`,
      );
      console.error(
        "📌 The gate validator will retry with updated instructions",
      );
      return null;
    }

    // Use cleaned output for all parsing attempts
    const outputToParse = cleanedOutput;

    const directJson = GateParser.tryParseDirectJSON(outputToParse, depth);
    if (directJson) {
      return directJson;
    }

    // First check for markdown code blocks (most common with Claude responses)
    const codeBlockMatch = outputToParse.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = GateParser.tryParseDirectJSON(
          codeBlockMatch[1],
          depth + 1,
        );
        if (parsed) return parsed;
      } catch (e) {
        // Invalid JSON in code block, fall through to other methods
      }
    }

    // Handle stream-json format (can be array or multiple lines)
    try {
      const lines = outputToParse.trim().split("\n");
      let finalResult = null;

      // Look for the final result JSON object in stream-json
      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);

            // Handle case where entire stream-json output is an array on one line
            if (Array.isArray(parsed)) {
              // Find the last item with type 'result'
              for (let i = parsed.length - 1; i >= 0; i--) {
                if (parsed[i].type === "result") {
                  finalResult = parsed[i];
                  break;
                }
              }
            } else if (parsed.type === "result") {
              // Handle case where each JSON object is on its own line
              finalResult = parsed;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }

      if (finalResult && finalResult.result) {
        // Extract gate JSON from Claude's result field
        return GateParser.extractGateJSONFromResult(
          finalResult.result,
          depth + 1,
        );
      }
    } catch (e) {
      // Fall through to other parsing methods
    }

    // Try to extract JSON from mixed content (Claude sometimes adds text before/after)
    const jsonMatch = outputToParse.match(/\{[\s\S]*"passed"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = GateParser.tryParseDirectJSON(jsonMatch[0], depth + 1);
        if (parsed) return parsed;
      } catch (e) {
        // Fall through to other methods
      }
    }

    // Try direct JSON parse (for clean JSON output)
    const parsedDirect = GateParser.tryParseDirectJSON(
      outputToParse,
      depth + 1,
    );
    if (parsedDirect) {
      return parsedDirect;
    }

    const extracted = GateParser.extractJSONByBraceCounting(
      outputToParse,
      depth + 1,
    );
    if (extracted) {
      return extracted;
    }

    return null;
  }

  /**
   * Extract JSON by counting braces (handles nested objects)
   */
  static extractJSONByBraceCounting(text, depth = 0) {
    const startIndex = text.indexOf("{");
    if (startIndex === -1) return null;

    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") braceCount++;
        if (char === "}") braceCount--;
        if (braceCount === 0) {
          const chunk = text.substring(startIndex, i + 1);
          return GateParser.tryParseDirectJSON(chunk, depth + 1);
        }
      }
    }

    return null;
  }

  /**
   * Extract gate JSON from Claude's result text
   */
  static extractGateJSONFromResult(resultText, depth = 0) {
    // Check for markdown code block
    const codeBlock = resultText.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlock) {
      try {
        const parsed = GateParser.tryParseDirectJSON(codeBlock[1], depth + 1);
        if (parsed) return parsed;
      } catch (e) {
        // Invalid JSON in code block
      }
    }

    const direct = GateParser.tryParseDirectJSON(resultText, depth + 1);
    if (direct) return direct;

    const extracted = GateParser.extractJSONByBraceCounting(
      resultText,
      depth + 1,
    );
    if (extracted) {
      return extracted;
    }

    return null;
  }

  static tryParseDirectJSON(text, depth = 0) {
    if (typeof text !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      return GateParser.extractFromStructure(parsed, depth + 1);
    } catch (_) {
      return null;
    }
  }

  static extractFromStructure(value, depth = 0) {
    if (depth > 8 || value === null || value === undefined) {
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const candidate = GateParser.extractFromStructure(item, depth + 1);
        if (candidate) return candidate;
      }
      return null;
    }
    if (typeof value !== "object") {
      return null;
    }
    if (typeof value.passed === "boolean") {
      return value;
    }
    const nestedFields = [
      "response",
      "result",
      "data",
      "output",
      "body",
      "message",
      "content",
    ];
    for (const field of nestedFields) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        const nestedValue = value[field];
        if (typeof nestedValue === "string") {
          const parsed = GateParser.parseGateJSON(nestedValue, depth + 1);
          if (parsed) return parsed;
        } else if (nestedValue && typeof nestedValue === "object") {
          const parsed = GateParser.extractFromStructure(
            nestedValue,
            depth + 1,
          );
          if (parsed) return parsed;
        }
      }
    }
    return null;
  }
}

module.exports = GateParser;
