# Phase 1-4: shadcn Components

Analyze `reference/frontend-task-list.json`, identify the shadcn/ui building blocks each task needs, install those components, and update the task list so that frontend development context is improved and centralized in that file.

## Prerequisites
- Completed Phase 1-1 (PRD Context Mapping)
- Completed Phase 1-2 (Frontend Task List)
- Completed Phase 1-3 (Backend Task List)

{{PRD_CONTEXT}}

{{WORKSPACE_STRUCTURE}}

---

## 📁 File to Update

**You MUST update this file**: `reference/frontend-task-list.json`
- Update the existing file in place.
- Preserve all previously required fields and JSON validity.

---

## 🧾 Task-Level UI Dependencies

Every task in the list must expose a new `uiDependencies` array (use `[]` when nothing applies). When the task will use shadcn components, append objects shaped in this format:

```json
{
  "component": "component-slug",                      // kebab-case, matches shadcn CLI slug
  "docsUrl": "https://ui.shadcn.com/docs/components/component-slug",
  "targetPath": "@/components/ui/component-slug",    // use @/ alias for installed components
  "reason": "Optional short phrase describing the UI purpose"
}
```

Guidance:
- Keep entries only when the shadcn component adds value; it is fine to leave `uiDependencies` empty when the task does not need shadcn.
- Multiple shadcn components per task are okay when necessary; add one object per component.
- If needed, use the optional `reason` field to clarify how the component supports the task.

---

## 🔄 Process

### STEP 1 — Snapshot Current Tasks
- Confirm the task list is populated:
  ```bash
  jq '.tasks | length' reference/frontend-task-list.json
  ```
- Check for tasks missing `uiDependencies` and initialize them to `[]` before proceeding (e.g., list offenders with `jq -r '.tasks[] | select(has("uiDependencies") | not) | .id' reference/frontend-task-list.json`).
- Export tasks that are likely to need UI work so you can iterate one by one:
  ```bash
  jq -r '.tasks[] | select(.type | if type == "array" then any(. == "ui") else (. == "component" or . == "page" or . == "layout") end) | "\(.id) :: \(.title)"' reference/frontend-task-list.json > /tmp/frontend-ui-tasks.txt
  ```

### STEP 2 — Research Per Task
For each task listed in `/tmp/frontend-ui-tasks.txt`:
1. Read the task (and its PRD references) with `jq` to understand the UX requirement.
2. Use Context7 MCP tools to pull authoritative docs:
   ```bash
   context7 libs resolve shadcn/ui
   context7 docs shadcn/ui components/<component-slug>
   ```
3. Cross-check <https://ui.shadcn.com/docs/directory> to confirm availability and variations.
4. Decide whether a shadcn component helps. Capture the component slug, docs URL, and planned target path; add a brief `reason` only when context will help implementers. If shadcn is unnecessary, leave the task's `uiDependencies` array empty.

### STEP 3 — Update `reference/frontend-task-list.json`
- For each reviewed task, ensure `uiDependencies` is present (use an empty array when no shadcn component is applicable).
- Append one entry per shadcn component you selected using the minimal schema above.
- Keep `status`, `acceptanceCriteria`, and other existing fields untouched except for updating `lastUpdated` with the current ISO timestamp for tasks you modify.
- For installed components, set `targetPath` to the import path you would use in code (for example `@/components/ui/badge`).
- Validate the file:
  ```bash
  jq '.' reference/frontend-task-list.json > /dev/null
  ```

### STEP 4 — Verify or Install Selected Components

#### 4.1 - Detect UI Component Structure
- First, determine where shadcn components live in this workspace:
  ```bash
  # Check for UI components directory
  if [ -d "src/components/ui" ]; then
    echo "UI components at src/components/ui"
    COMPONENT_DIR="src/components/ui"
  else
    echo "No existing UI structure found - will be created by shadcn init"
    COMPONENT_DIR="src/components/ui"
  fi
  ```

#### 4.2 - Check for Pre-existing Components
- List already installed components:
  ```bash
  ls -1 $COMPONENT_DIR/*.tsx 2>/dev/null | xargs -I {} basename {} .tsx | sort > /tmp/existing-components.txt
  ```
- Compare with needed components:
  ```bash
  jq -r '.tasks[].uiDependencies[]?.component' reference/frontend-task-list.json | sort -u > /tmp/needed-components.txt
  comm -13 /tmp/existing-components.txt /tmp/needed-components.txt > /tmp/to-install.txt
  ```

#### 4.3 - Install Missing Components (if any)
- Only if components are missing and dependencies are healthy:
  ```bash
  # Pre-flight check
  pnpm install --dry-run > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "WARNING: Dependency issues detected. Fix before installing components."
    pnpm install 2>&1 | head -20
  else
    # Install missing components
    while read component; do
      npx shadcn@latest add "$component" --yes --overwrite
    done < /tmp/to-install.txt
  fi
  ```

#### 4.4 - Update Task List Paths
- Update `targetPath` for all components (existing or newly installed):
  ```bash
  # Update paths to use @/components/ui pattern
  jq '.tasks |= map(
    if .uiDependencies then
      .uiDependencies |= map(
        if .component and (.targetPath == "" or .targetPath == null) then
          .targetPath = "@/components/ui/" + .component
        else . end
      )
    else . end
  )' reference/frontend-task-list.json > /tmp/updated-tasks.json
  mv /tmp/updated-tasks.json reference/frontend-task-list.json
  ```

### STEP 5 — Verify
- For every component you installed, confirm the file exists:
  ```bash
  while read -r path; do
    [ -z "$path" ] || test -f "$path" || echo "MISSING $path"
  done < <(jq -r '.tasks[].uiDependencies[]?.targetPath // empty' reference/frontend-task-list.json | sed 's|@/|src/|')
  ```
- Run a lightweight confidence check (prefer `pnpm lint`; if unavailable, `pnpm tsc --noEmit`):
  ```bash
  pnpm lint
  ```

### STEP 6 — Final Review
- Re-read the updated tasks to confirm each shadcn component includes its docs URL and the correct `targetPath` (or an empty string when planned).
- Ensure every task has a `uiDependencies` array (empty arrays are acceptable) and that installed components reference the expected import path.
- Run a final JSON validation and pretty-print for sanity:
  ```bash
  jq '.' reference/frontend-task-list.json | head
  ```

---

## ✅ Success Criteria
- [ ] `reference/frontend-task-list.json` remains valid JSON with all original fields intact.
- [ ] Every UI-focused task has `uiDependencies` defined; each entry includes `component`, `docsUrl`, and the appropriate `targetPath` (or empty string when planned).
- [ ] Installed shadcn component files exist at the recorded `targetPath` locations.
- [ ] At least one project-level verification command (lint, typecheck, or targeted test) ran successfully after installations.

## 🚫 Failure Conditions
- ⛔ Missing or invalid `uiDependencies` data structures on updated tasks.
- ⛔ Docs URLs that are not sourced from the official shadcn directory.
- ⛔ Installed component referenced but file not present.
- ⛔ Invalid JSON or accidental removal of prior task metadata.

Deliver a cleanly annotated frontend task list with ready-to-use shadcn/ui components so Phase 2 can focus entirely on feature implementation.
