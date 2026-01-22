# Phase 7-1: Backend Integration Fix

## 🎯 Objective
Bring the backend into an integrated, non-mocked state so the backend integration gate passes.

This is a **surgical remediation phase**. Fix only what is required for backend integration consistency. Do not refactor unrelated code.

---

## 🔍 Integration Issues to Fix

### 1) Remove remaining `// MOCK:` comments in data layer

**Detect:**
```bash
grep -r "// MOCK:" src/data/ --include="*.ts" -l
```

**Fix each file:**
- Replace mock implementation with real Prisma query
- Keep function signature identical (API routes depend on it)
- Remove fixture imports once replaced
- Remove the `// MOCK:` comment after implementing

---

### 2) Fix TODO stubs returning fake success

**Detect:**
```bash
grep -rn "TODO\|FIXME" src/data/ src/actions/ src/app/api/ --include="*.ts" | grep -i "will be\|would\|should\|later\|placeholder\|stub"
```

**For each stub found:**
- If a Server Action exists for this functionality → **wire the stub to call the action**
- If no action exists → implement the real database operation
- **CRITICAL**: Never return `{ success: true }` without actually performing the operation

**Common stub patterns to catch:**
- `// TODO: actual database operations will be handled by task-X`
- `// TODO: In production, this would...`
- `return { success: true }` with no `prisma.` calls in the function

---

### 3) Wire userId through ALL API routes

**Detect data functions requiring userId:**
```bash
grep -rn "userId" src/data/ --include="*.ts" | grep -E "(function|async|=>)" | head -20
```

**For each data function with `userId` in its signature:**

1. Find API routes that call it:
   ```bash
   grep -rn "functionName" src/app/api/ --include="*.ts"
   ```

2. Verify the route extracts userId from session:
   ```typescript
   const session = await auth();
   const userId = session?.user?.id;
   if (!userId) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

3. Verify userId is PASSED to the function call:
   ```typescript
   // WRONG: claimTeam(slug, teamId)
   // RIGHT: claimTeam(slug, teamId, userId)
   ```

---

### 4) Verify "triggers" actually invoke code

**Detect tasks with "triggers" in AC:**
```bash
grep -rn "triggers\|Triggers" reference/backend-task-list.json
```

**For each "triggers X" acceptance criterion:**

1. Find the implementation file
2. Verify the target function is actually **called**, not just referenced:
   ```typescript
   // WRONG: Generating ID is not triggering
   const syncJobId = generateSyncJobId();
   return { success: true, syncStatus: 'pending' };
   
   // RIGHT: Actually invoke the sync function
   await syncLeagueData(leagueId);
   return { success: true, syncStatus: 'completed' };
   ```

3. If sync jobs exist as cron-only, **add callable exports**:
   ```typescript
   // Export for on-demand invocation
   export async function syncMatchups(leagueId: string) { ... }
   
   // Cron handler wraps the callable
   export async function cronSyncMatchups() {
     const leagues = await getActiveLeagues();
     for (const league of leagues) {
       await syncMatchups(league.id);
     }
   }
   ```

---

### 5) Ensure fetchers return DISTINCT error shapes

**Detect fetchers that could have "not found" vs "empty" scenarios:**
```bash
grep -rn "isEmpty\|notFound\|not found" src/data/ --include="*.ts"
```

**Required pattern - these must be distinguishable:**
```typescript
// Entity not found (parent doesn't exist)
if (!league) {
  return { notFound: true, error: 'League not found' };
}

// Entity exists but collection is empty
const teams = await prisma.team.findMany({ where: { leagueId } });
if (teams.length === 0) {
  return { data: [], isEmpty: true };
}

// Success with data
return { data: teams };
```

**WRONG - conflating error and empty:**
```typescript
// This makes frontend unable to distinguish the scenarios
if (!league || teams.length === 0) {
  return { isEmpty: true };  // WRONG - same response for different situations
}
```

---

### 6) Verify expectedStateChanges are fulfilled

**For tasks with expectedStateChanges:**
```bash
jq '.tasks[] | select(.expectedStateChanges != null) | {id, expectedStateChanges}' reference/backend-task-list.json
```

**For each action returning `success: true`, verify:**
- All items in `expectedStateChanges` actually exist in database
- Generating an ID is NOT the same as creating the record
- If "sync job triggered" is expected, the sync function must be CALLED, not just ID generated

---

### 7) Ensure backend task list referenced modules exist

The integration gate checks that completed/in-progress tasks have their referenced modules:
- `actions[].path`
- `actions[].schemaPath`
- `dataFetchers[].path`
- `backgroundJobs[].path`

**If a referenced module path is missing:**
- Create the missing file with minimal implementation, OR
- If manifest path is wrong, fix the manifest to match actual file location

---

### 8) Prisma schema validation
```bash
npx prisma validate
```

Only run `npx prisma generate` or `npx prisma db push` if you changed the schema.

---

## 🚦 Quick Verification Commands

Run these to check your progress:

```bash
# Check for remaining mocks
grep -r "// MOCK:" src/data/ --include="*.ts" | wc -l

# Check for TODO stubs with success returns
grep -rn "TODO\|FIXME" src/data/ src/actions/ src/app/api/ --include="*.ts" | wc -l

# Check for functions with userId that might need wiring
grep -rn "userId.*:" src/data/ --include="*.ts" | grep "function\|async" | wc -l

# Validate Prisma schema
npx prisma validate
```

---

## 🚀 Guardrails
- Keep changes minimal; avoid new abstractions
- Prefer deleting mock/fixture code over adding new scaffolding
- Do not change unrelated UX/UI
- Do not edit task statuses in `reference/backend-task-list.json`
