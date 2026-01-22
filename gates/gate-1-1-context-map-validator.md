## CRITICAL: OUTPUT FORMAT REQUIREMENTS

You MUST respond with ONLY valid JSON that matches this exact schema. Do not include any text before or after the JSON object.

### JSON Schema (REQUIRED)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "score", "reasons", "criteria_scores", "retryRecommended", "criticalFailures"],
  "properties": {
    "passed": { "type": "boolean" },
    "score": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasons": { "type": "array", "items": { "type": "string" } },
    "criteria_scores": { "type": "object", "additionalProperties": { "type": "number", "minimum": 0, "maximum": 1 } },
    "retryRecommended": { "type": "boolean" },
    "criticalFailures": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

### Example Valid Response:
```json
{
  "passed": true,
  "score": 0.97,
  "reasons": ["All glob patterns expanded to specific files", "Phases 1-2 and 1-3 have relevant PRD files mapped", "Categories properly populated for phase-1-2 and phase-1-3", "Phases 1-4, 1-5, 4-1, 4-2 have empty reference arrays", "Phases 2 and 5 exist with guideline flags"],
  "criteria_scores": {
    "no_glob_patterns": 1.0,
    "phase_mapping_quality": 0.94
  },
  "retryRecommended": false,
  "criticalFailures": []
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 1-1: PRD Context Map Validation

## 🎯 Purpose
Validate that glob patterns were expanded and phases have appropriate configurations (PRD files for phases 1-2 and 1-3; guideline flags for phases 2 and 5).

## 📋 Validation

**Use tools to check. You are running from the workspace directory.**

1. Read `reference/prd-context-map.json`
2. Check for glob patterns
3. Evaluate if mapped files are relevant for each phase

## 🔍 Validation Criteria

### 1. No Glob Patterns (50% weight)
**Critical structural check:**

Run this command:
```bash
cat reference/prd-context-map.json | jq '.. | strings' | grep -E '\*\*|\*'
```

- If returns ANYTHING → **CRITICAL FAILURE**
- If empty → PASS

**What to check:**
- [ ] NO `**/*.json` patterns in any `reference` or `categories` arrays
- [ ] NO `**/*.md` patterns anywhere
- [ ] NO `*` wildcards anywhere
- [ ] All paths are specific files
- [ ] Phase 1-2 and 1-3 use `categories` object with three sub-arrays

**If glob patterns found:** Score this criterion 0.0

### 2. Phase Mapping Quality (50% weight)
**Evaluate relevance of mapped files:**

For each phase, based on its description, check if appropriate files are mapped:

**Phase 1-2** (Frontend Plan):
- Should have `categories` object with three fields populated
- All glob patterns expanded to specific file paths
- phase_context and gate_context should not overlap

**Phase 1-3** (Backend Plan):
- Should have `categories` object with three fields populated
- All glob patterns expanded to specific file paths
- phase_context and gate_context should not overlap

**Phases with guideline flags (for dynamic inheritance):**

**Phase 2** (Frontend Implementation):
- No file mappings needed (dynamic phases handle PRD context)

**Phase 6** (Backend Implementation):
- No file mappings needed (dynamic phases handle PRD context)

**Phases with empty references:**

**Phase 1-4** (shadcn Components):
- Should have empty array `[]` in `reference` field

**Phase 1-5** (Frontend E2E Test Generation):
- Should have empty array `[]` in `reference` field

**Phase 3-1, 3-2, 3-3** (Frontend Polish):
- Should have empty array `[]` in `reference` field

**Phase 4** (Frontend Validation):
- Should have empty array `[]` in `reference` field

**Phase 5-1** (Backend Plan Revision):
- Should have empty array `[]` in `reference` field

**Phase 5-2** (Backend Test Generation):
- Should have empty array `[]` in `reference` field

**Phase 7-1, 7-2** (Backend Polish):
- Should have empty array `[]` in `reference` field

**Score:** 
- Full points if phases 1-2 and 1-3 have PRD files mapped
- Full points if phases 1-4, 1-5, 3-1/3-2/3-3, 4, 5-1, 5-2, 7-1/7-2 have empty reference arrays
- Deduct points for any deviation from expected structure

## 📊 Scoring

```
Total Score = (no_glob_patterns * 0.50) + (phase_mapping_quality * 0.50)
```

**Pass**: ≥0.95

## 🚨 Critical Failures

- Any glob patterns (`**` or `*`) found
- Phases 1-2 or 1-3 missing PRD file mappings
- Phase 1-2 or 1-3 missing `categories` object structure
- Empty categories in phase 1-2 or 1-3

## ✅ Pass Requirements

- Zero glob patterns
- Phases 1-2 and 1-3 have relevant PRD files mapped
- Phases 1-4, 1-5, 3, 4-1, and 4-2 have empty `reference` arrays
- Phase 1-2 and 1-3 have populated `categories` objects
- Score ≥0.95

## ❌ Fail Conditions

- Glob patterns present
- Wrong field names used
- Missing or empty categories for phases 1-2 and 1-3
- Phases 2 or 5 missing guideline flags
- Score <0.95
