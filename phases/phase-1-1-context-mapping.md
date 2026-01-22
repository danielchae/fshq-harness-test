# Phase 1-1: PRD Context Mapping

Analyze the PRD folder and map relevant files to each phase using the three-category system.

---

## 📁 File to Update

**You MUST update this file**: `reference/prd-context-map.json`
**Location**: The file exists in the reference folder. Update it in place.
**CRITICAL**: The file path is `reference/prd-context-map.json`, NOT at workspace root

---

## 🚨 WHAT TO DO

First verify the file exists:
```bash
ls -la reference/prd-context-map.json
```

Then fill out ALL fields in this existing JSON file:

1. **`generated_at`** - Set to current ISO timestamp
2. **Phase file mappings** - Replace ALL glob patterns (`**/*.json`, `**/*.md`) with actual file paths
   - Expand ALL globs in `categories` arrays for phase-1-2 and phase-1-3
   - Keep `reference` as empty arrays ([]) for phase-1-4, phase-1-5, phase-3-1, phase-3-2, phase-3-3, phase-4, phase-5-1, phase-5-2, phase-7-1, phase-7-2, phase-7-3
   - Phases 2 and 6 need context flags but no file mappings

**Important**: Keep any specific non-glob file paths that already exist in the template - these are intentional forward references to files that will be created in later phases.

---

## How to Map Files to Phases

### Phase 1-2: Frontend Manifest  
- **Description**: "Create frontend manifest"
- **Your task**: Map files to three categories:

#### Categories to fill:

**read_first** - Foundation files for understanding the product:
- Look for: prd summary/overview file (often in user-stories folder)
- Look for: UX specifications file (usually in specs folder) 
- Look for: component analysis or architecture file
- Look for: application states or state management specs

**phase_context** - Files needed during frontend planning:
- Look for: All user story files
- Look for: API specifications (data-in-transit)
- Look for: State machine files for workflows

**gate_context** - Files for validating frontend work:
- Look for: Requirements traceability matrix
- Look for: Coverage reports or summaries
- Look for: Reconciliation/gap analysis reports
- Look for: Edge case handling specifications
- Look for: Component manifests or lists

Note: Categories are mutually exclusive - files can only live in one of the categories and not multiple.

### Phase 1-3: Backend Manifest
- **Description**: "Create backend manifest"  
- **Your task**: Map files to three categories:

#### Categories to fill:

**read_first** - Foundation files (may overlap with phase-1-2):
- Look for: prd summary/overview file (often in user-stories folder)
- Look for: Data schema specifications
- Look for: Business functions/rules specifications

**phase_context** - Files needed during backend planning:
- Look for: Data schema specifications
- Look for: API endpoint specifications
- Look for: Business functions specifications
- Look for: Workflow functions specifications and research
- Look for: Integration specifications
- Look for: Database/data layer user stories

**gate_context** - Files for validating backend work:
- Look for: Data relationship diagrams
- Look for: Workflow diagrams
- Look for: Business logic validation specs
- Look for: Integration test specifications
- Look for: Database schema validation files

Note: Categories are mutually exclusive - files can only live in one of the categories and not multiple.

### Phase 1-4: shadcn Components
- **Description**: "Map shadcn/ui usage per frontend task"
- **Your task**: Keep `reference` as empty array ([])

### Phase 1-5: Frontend E2E Test Generation
- **Description**: "Generate Playwright E2E tests from frontend task acceptance criteria"
- **Your task**: Keep `reference` as empty array ([])

### Phase 2: Frontend Implementation  
- **Description**: "Build frontend components and pages"
- **Your task**: Keep phase entry with guideline flags but no file mappings

### Phase 3-1, 3-2, 3-3: Frontend Polish
- **Description**: "UI review and polish"
- **Your task**: Keep `reference` as empty array ([])

### Phase 4: Frontend Validation
- **Description**: "Test and validate frontend implementation"
- **Your task**: Keep `reference` as empty array ([])

### Phase 5-1: Backend Plan Revision
- **Description**: "Update backend tasks based on frontend implementation"
- **Your task**: Keep `reference` as empty array ([])

### Phase 5-2: Backend Test Generation
- **Description**: "Generate Playwright API tests from backend task acceptance criteria"
- **Your task**: Keep `reference` as empty array ([])

### Phase 6: Backend Implementation
- **Description**: "Build backend components"
- **Your task**: Keep phase entry with guideline flags but no file mappings

### Phase 7-1, 7-2: Backend Polish
- **Description**: "Backend audit and polish"
- **Your task**: Keep `reference` as empty array ([])

---

## 📝 Category Guidelines

### Principles for categorization:

1. **read_first**: High-level context files that provide product understanding
   - Product summaries, overviews, vision documents
   - Core architectural documents
   - Main specification files (UX, data, business)

2. **phase_context**: Implementation-focused files
   - User stories relevant to that phase
   - Technical specifications
   - API contracts
   - State machines and workflows
   - Implementation guides

3. **gate_context**: Validation and verification files  
   - Traceability matrices
   - Coverage reports
   - Gap analyses
   - Test specifications
   - Validation checklists
   - NO overlap with phase_context files

**Important**: Within each phase, do not repeat files. (It's OK for phase-1-2 and phase-1-3 to share files between them.)

---

## ✅ Success Criteria

**Verification commands to run before completing phase:**
```bash
# File exists at correct location
ls -la reference/prd-context-map.json

# Valid JSON structure
cat reference/prd-context-map.json | jq .

# No glob patterns remain
cat reference/prd-context-map.json | jq '.. | strings' | grep -E '\*\*|\*' || echo "✅ No globs found"

# Categories are populated for phase-1-2 and phase-1-3
cat reference/prd-context-map.json | jq '.phases["phase-1-2"].categories | keys'
cat reference/prd-context-map.json | jq '.phases["phase-1-3"].categories | keys'

# No duplicates across read_first/phase_context/gate_context within each phase
cat reference/prd-context-map.json | jq '.phases["phase-1-2"].categories | [.read_first, .phase_context, .gate_context] | flatten | group_by(.) | map(select(length > 1)) | if length == 0 then "✅ No duplicates in phase-1-2" else "❌ Duplicates found: \(.)" end'
cat reference/prd-context-map.json | jq '.phases["phase-1-3"].categories | [.read_first, .phase_context, .gate_context] | flatten | group_by(.) | map(select(length > 1)) | if length == 0 then "✅ No duplicates in phase-1-3" else "❌ Duplicates found: \(.)" end'
```

**Phase PASSES when:**
- File exists at `reference/prd-context-map.json`
- `generated_at` has ISO timestamp
- NO glob patterns (`**` or `*`) anywhere
- Each phase has specific file paths
- phase-1-2 and phase-1-3 have all three categories populated
- phase-1-4, phase-1-5, phase-3-1, phase-3-2, phase-3-3, phase-4, phase-5-1, phase-5-2, phase-7-1, phase-7-2, and phase-7-3 have empty reference arrays
- phase-2 and phase-6 exist with guideline flags

**Phase FAILS if:**
- File not updated in reference folder
- Glob patterns remain unexpanded
- Categories are empty or missing
