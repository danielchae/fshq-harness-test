# Phase 5-2: Backend Test Generation

Generate Vitest unit/integration tests for every task in `reference/backend-task-list.json`. These tests validate backend logic by **directly calling Server Actions, Data Fetchers, and querying Models** - NOT through UI interactions.

## Prerequisites
- Completed Phase 5-1 (Backend Plan Revision)
- Frontend implementation complete (Phase 2-4)
- Backend handoff document at `reference/backend-handoff.md`

{{PRD_CONTEXT}}

{{WORKSPACE_STRUCTURE}}

---

## Critical: Test Backend Directly

Backend tests **DO NOT** use Playwright or browser automation. Instead:

| Component | How to Test |
|-----------|-------------|
| Server Actions | Import function, call with args, assert return value |
| Data Fetchers | Import function, call directly, assert data shape |
| Prisma Models | Test via CRUD operations through actions |
| Background Jobs | Test trigger function, mock job execution |

---

## Output Location

**Create test files in**: `tests/backend/`

**Naming**: `tests/backend/be-{task-id}.test.ts`

Example: Task `task-05` → `tests/backend/be-task-05.test.ts`

---

## Test File Structure

```typescript
// tests/backend/be-task-XX.test.ts
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';

// Import the actual functions being tested
import { createSomething, getSomething } from '@/actions/something';
import { fetchSomethingList } from '@/data/something';

describe('Backend: Task Title Here', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.modelName.deleteMany({ 
      where: { name: { startsWith: 'TEST_' } } 
    });
  });

  test('creates entity with required fields', async () => {
    const result = await createSomething({
      name: 'TEST_Entity',
      // ... other fields
    });
    
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('TEST_Entity');
  });

  test('validates required fields', async () => {
    const result = await createSomething({
      // missing required fields
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('fetcher returns correct data shape', async () => {
    // Create test data first
    await createSomething({ name: 'TEST_Fetch', /* ... */ });
    
    const data = await fetchSomethingList();
    
    expect(Array.isArray(data)).toBe(true);
    expect(data.some(item => item.name === 'TEST_Fetch')).toBe(true);
  });
});
```

---

## Test Patterns by Component Type

### 1. Server Actions (CRUD Operations)

Server Actions are async functions that mutate data. Test inputs, outputs, and side effects:

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createProject, updateProject, deleteProject } from '@/actions/projects';

describe('Backend: Project Actions', () => {
  beforeEach(async () => {
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
  });

  test('createProject creates with valid data', async () => {
    const result = await createProject({
      name: 'TEST_Project',
      description: 'Test description',
      userId: 'test-user-id'
    });
    
    expect(result.success).toBe(true);
    expect(result.data?.id).toBeDefined();
    expect(result.data?.name).toBe('TEST_Project');
    
    // Verify in database
    const inDb = await prisma.project.findUnique({ where: { id: result.data!.id } });
    expect(inDb).not.toBeNull();
  });

  test('createProject fails with duplicate name', async () => {
    await createProject({ name: 'TEST_Unique', description: '', userId: 'test-user-id' });
    
    const result = await createProject({ name: 'TEST_Unique', description: '', userId: 'test-user-id' });
    
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exists|unique|duplicate/i);
  });

  test('updateProject modifies existing record', async () => {
    const created = await createProject({ name: 'TEST_Update', description: 'old', userId: 'test-user-id' });
    
    const result = await updateProject(created.data!.id, { description: 'new' });
    
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('new');
  });

  test('deleteProject removes record', async () => {
    const created = await createProject({ name: 'TEST_Delete', description: '', userId: 'test-user-id' });
    
    const result = await deleteProject(created.data!.id);
    
    expect(result.success).toBe(true);
    
    const inDb = await prisma.project.findUnique({ where: { id: created.data!.id } });
    expect(inDb).toBeNull();
  });
});
```

### 2. Data Fetchers (Query Operations)

Data fetchers return data for Server Components. Test query results and data shape:

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { fetchProjectsByUser, fetchProjectById } from '@/data/projects';

describe('Backend: Project Fetchers', () => {
  let testProjectId: string;
  
  beforeEach(async () => {
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
    
    // Create test data
    const project = await prisma.project.create({
      data: { name: 'TEST_Fetcher', description: 'For testing', userId: 'test-user-id' }
    });
    testProjectId = project.id;
  });

  test('fetchProjectsByUser returns user projects', async () => {
    const projects = await fetchProjectsByUser('test-user-id');
    
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]).toHaveProperty('id');
    expect(projects[0]).toHaveProperty('name');
  });

  test('fetchProjectById returns correct project', async () => {
    const project = await fetchProjectById(testProjectId);
    
    expect(project).not.toBeNull();
    expect(project?.id).toBe(testProjectId);
    expect(project?.name).toBe('TEST_Fetcher');
  });

  test('fetchProjectById returns null for non-existent id', async () => {
    const project = await fetchProjectById('non-existent-id');
    
    expect(project).toBeNull();
  });
});
```

### 3. Prisma Models (Schema Validation)

Test model constraints and relationships through actions:

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Project Model Constraints', () => {
  beforeEach(async () => {
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
  });

  test('enforces required fields', async () => {
    await expect(
      prisma.project.create({ data: { name: 'TEST_NoUser' } as any })
    ).rejects.toThrow();
  });

  test('enforces unique constraints', async () => {
    await prisma.project.create({ 
      data: { name: 'TEST_UniqueConstraint', userId: 'test-user' } 
    });
    
    await expect(
      prisma.project.create({ 
        data: { name: 'TEST_UniqueConstraint', userId: 'test-user' } 
      })
    ).rejects.toThrow(/unique/i);
  });

  test('cascade deletes related records', async () => {
    const project = await prisma.project.create({
      data: { 
        name: 'TEST_Cascade', 
        userId: 'test-user',
        tasks: { create: [{ title: 'TEST_Task1' }] }
      }
    });
    
    await prisma.project.delete({ where: { id: project.id } });
    
    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    expect(tasks.length).toBe(0);
  });
});
```

### 4. Background Jobs (Inngest Functions)

Test job triggers without executing the full job:

```typescript
import { describe, test, expect, vi } from 'vitest';
import { inngest } from '@/lib/inngest';

// Mock the inngest client
vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: vi.fn()
  }
}));

describe('Backend: Notification Job', () => {
  test('triggers notification job on project creation', async () => {
    const { createProject } = await import('@/actions/projects');
    
    await createProject({ name: 'TEST_TriggerJob', description: '', userId: 'test-user' });
    
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'project/created',
        data: expect.objectContaining({ name: 'TEST_TriggerJob' })
      })
    );
  });
});
```

### 5. Workflow Invariant Tests (For Actions with expectedStateChanges)

If a task has `expectedStateChanges` in `backend-task-list.json`, generate tests that verify each state change actually occurs after the action succeeds. This catches "workflow wiring" bugs where actions return success but don't complete all downstream operations.

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

// Import the action being tested
import { createWorkspaceFromTemplateAction } from '@/actions/workspaces/create-from-template';

describe('Backend: Create Workspace from Template Workflow Invariants', () => {
  let createdWorkspaceId: string | null = null;

  afterEach(async () => {
    // Clean up test data
    if (createdWorkspaceId) {
      await prisma.channel.deleteMany({ where: { workspaceId: createdWorkspaceId } });
      await prisma.membership.deleteMany({ where: { workspaceId: createdWorkspaceId } });
      await prisma.workspace.delete({ where: { id: createdWorkspaceId } }).catch(() => {});
      createdWorkspaceId = null;
    }
  });

  // Test for expectedStateChange: "Default channels created from template"
  test('creates default channels after successful workspace creation', async () => {
    const result = await createWorkspaceFromTemplateAction({
      templateId: 'TEST_TEMPLATE_ID',
      name: 'TEST_Workspace'
    });
    
    expect(result.success).toBe(true);
    createdWorkspaceId = result.data?.workspace?.id || null;
    
    // Verify workflow invariant: Channels must exist
    const channels = await prisma.channel.findMany({ 
      where: { workspaceId: createdWorkspaceId! } 
    });
    expect(channels.length).toBeGreaterThan(0);
  });

  // Test for expectedStateChange: "Admin membership created for workspace creator"
  test('creates admin membership after successful workspace creation', async () => {
    const result = await createWorkspaceFromTemplateAction({
      templateId: 'TEST_TEMPLATE_ID',
      name: 'TEST_Workspace'
    });
    
    expect(result.success).toBe(true);
    createdWorkspaceId = result.data?.workspace?.id || null;
    
    // Verify workflow invariant: Admin membership must exist
    const memberships = await prisma.membership.findMany({ 
      where: { workspaceId: createdWorkspaceId! } 
    });
    expect(memberships.length).toBeGreaterThan(0);
    
    // Verify at least one admin exists
    const adminMembership = memberships.find(m => m.role === 'ADMIN');
    expect(adminMembership).toBeDefined();
  });
});
```

**When to generate workflow invariant tests:**
- Task has `expectedStateChanges` array in backend-task-list.json
- Task type is `action` and creates primary entities
- Task involves external system integration (OAuth providers, payment APIs, etc.)

**Test structure:**
1. Call the action with valid test input
2. Assert `result.success === true`
3. For EACH item in `expectedStateChanges`, query the database to verify the state change occurred
4. Clean up test data in `afterEach`

### 6. Type Contract Shape Tests (For Fetchers)

If a task has a `typeContract` field, generate a test that validates the return structure matches the expected type:

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getRoleOptions } from '@/data/onboarding/get-onboarding-teams';

describe('Backend: Role Options Type Contract', () => {
  test('getRoleOptions returns data matching RoleOption type', async () => {
    const options = await getRoleOptions();
    
    expect(Array.isArray(options)).toBe(true);
    
    // Validate each item has required properties from RoleOption type
    for (const option of options) {
      expect(option).toHaveProperty('role');      // NOT 'id'
      expect(option).toHaveProperty('title');
      expect(option).toHaveProperty('description');
      expect(option).toHaveProperty('icon');
      expect(option).toHaveProperty('features');
      expect(Array.isArray(option.features)).toBe(true);
    }
  });
});
```

**When to generate shape tests:**
- Task has `typeContract` field with a non-null value
- Task type is `fetcher`
- Fetcher returns complex objects (not primitives)

### 7. JSONB Roundtrip Tests (For Actions with Content Fields)

For actions that create records with JSONB/JSON fields (like `contentData`, `metadata`, `settings`), generate create-then-read tests to verify persistence:

```typescript
import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createPostAction } from '@/actions/posts/create-post';
import { getMomentsByFeed } from '@/data/moments/get-moments';

describe('Backend: Post Content Roundtrip', () => {
  let createdPostId: string | null = null;

  afterEach(async () => {
    if (createdPostId) {
      await prisma.moment.delete({ where: { id: createdPostId } }).catch(() => {});
      createdPostId = null;
    }
  });

  test('created post contentData persists and is readable', async () => {
    const result = await createPostAction({
      content: 'TEST_Post content',
      feedId: 'test-feed-id',
      authorName: 'TEST_Author'
    });
    
    expect(result.success).toBe(true);
    createdPostId = result.data?.id || null;
    
    // Read back and verify JSONB field was persisted
    const moments = await getMomentsByFeed('test-feed-id');
    const createdMoment = moments.find(m => m.id === createdPostId);
    
    expect(createdMoment).toBeDefined();
    expect(createdMoment?.contentData).toBeDefined();
    expect(createdMoment?.contentData?.authorName).toBe('TEST_Author');
  });
});
```

**When to generate roundtrip tests:**
- Action creates records with JSONB/JSON fields
- Frontend reads these fields for rendering (e.g., `contentData.authorName`)
- Task acceptance criteria mention "persist" or "store" content

---

## Handling Server Actions with Next.js Context

Some Server Actions use Next.js functions like `cookies()`, `headers()`, or `redirect()`. These don't work in Vitest's Node.js environment. Handle them by:

### Option 1: Mock Next.js Functions

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before importing actions
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: 'mock-session-token' })),
    set: vi.fn(),
    delete: vi.fn()
  })),
  headers: vi.fn(() => new Map())
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn()
}));

import { createProject } from '@/actions/projects';

describe('Backend: Project Actions', () => {
  test('creates project', async () => {
    const result = await createProject({ name: 'TEST_Project' });
    expect(result.success).toBe(true);
  });
});
```

### Option 2: Test Pure Business Logic Separately (Last Resort)

If Options 1 and 3 don't work and actions mix auth checks with business logic, extract testable functions as a last resort:

```typescript
// In your action file:
export async function createProjectLogic(data: ProjectInput, userId: string) {
  // Pure business logic - testable without Next.js context
  return prisma.project.create({ data: { ...data, userId } });
}

export async function createProject(data: ProjectInput) {
  const session = await getSession(); // Uses cookies()
  return createProjectLogic(data, session.userId);
}

// In tests - test the pure logic:
import { createProjectLogic } from '@/actions/projects';

test('creates project with valid data', async () => {
  const result = await createProjectLogic({ name: 'TEST_Pure' }, 'test-user-id');
  expect(result.name).toBe('TEST_Pure');
});
```

### Option 3: Test via Prisma Directly

For model tasks, test constraints directly without going through actions:

```typescript
import { prisma } from '@/lib/db';

test('project requires userId', async () => {
  await expect(
    prisma.project.create({ data: { name: 'TEST_NoUser' } as any })
  ).rejects.toThrow();
});
```

---

## Process

### STEP 1 — Analyze Backend Tasks

```bash
# Count total backend tasks
jq '.tasks | length' reference/backend-task-list.json

# List tasks with types
jq -r '.tasks[] | "\(.id): \(.type) - \(.title)"' reference/backend-task-list.json
```

### STEP 2 — Read Backend Handoff

```bash
# Get frontend developer notes about expected behavior
cat reference/backend-handoff.md
```

### STEP 3 — Generate Test Files

For each task in `backend-task-list.json`:

1. Create `tests/backend/be-{task-id}.test.ts`
2. Import `{ describe, test, expect, beforeEach } from 'vitest'`
3. Import `{ prisma } from '@/lib/db'`
4. Import the actual actions/fetchers to be tested
5. Write tests that call functions directly and assert results

### STEP 4 — Verify Test Files

```bash
# Check all test files exist
for id in $(jq -r '.tasks[].id' reference/backend-task-list.json); do
  if [ ! -f "tests/backend/be-${id}.test.ts" ]; then
    echo "MISSING: be-${id}.test.ts"
  fi
done

# Verify imports are correct
for f in tests/backend/be-*.test.ts; do
  grep -q "from 'vitest'" "$f" || echo "Missing vitest import: $f"
  grep -q "@/lib/db\|@/actions\|@/data" "$f" || echo "Missing backend imports: $f"
done
```

---

## Test Data Strategy

### Use TEST_ Prefix

Always prefix test data with `TEST_` for easy cleanup:

```typescript
beforeEach(async () => {
  await prisma.project.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
});

test('creates project', async () => {
  const result = await createProject({ name: 'TEST_MyProject', /* ... */ });
});
```

### Use Real Database

Tests run against the development database. This ensures:
- Real Prisma behavior
- Actual constraint enforcement
- Relationship testing

### Unique Identifiers

For uniqueness tests, use timestamps:

```typescript
const uniqueName = `TEST_Unique_${Date.now()}`;
```

---

## What NOT To Do

**DO NOT:**
- Use Playwright or browser automation
- Navigate to pages or click UI elements
- Import from `@playwright/test`
- Assume UI exists for backend tasks
- Test frontend behavior
- Write mock-only tests that just validate mocks return hardcoded values
  - BAD: `const mockAction = vi.fn(() => ({ source: 'database' })); expect(mockAction().source).toBe('database');`
  - GOOD: Import real functions from `@/actions/` and call them against real database

**DO:**
- Import functions directly
- Call Server Actions with arguments
- Assert return values and database state
- Use Vitest for testing

---

## Success Criteria

- [ ] One `be-{task-id}.test.ts` file per task in `backend-task-list.json`
- [ ] Each file imports from `vitest`, not `@playwright/test`
- [ ] Each file imports actual backend functions to test (`@/actions`, `@/data`, and/or `@/lib/db`)
- [ ] Each file has at least one `test()` block
- [ ] Tests call functions directly, not through UI
- [ ] Test data uses `TEST_` prefix for cleanup
- [ ] Each task test file includes at least one happy-path test and one invalid-input/permission case when applicable
- [ ] Tasks with `typeContract` have shape tests validating required properties
- [ ] Actions creating JSONB fields have roundtrip tests verifying persistence

---

## Failure Conditions

- Missing test files for any backend task
- Tests import Playwright (wrong approach)
- Tests navigate to pages or click elements
- No tests in a test file
- Invalid TypeScript syntax
- Tests don't import any backend functions

---

## Final Verification

```bash
# Count test files
total=$(jq '.tasks | length' reference/backend-task-list.json)
found=$(ls tests/backend/be-*.test.ts 2>/dev/null | wc -l)
echo "Backend test files: $found / $total"

# Verify vitest imports (NOT playwright)
for f in tests/backend/be-*.test.ts; do
  if grep -q "@playwright/test" "$f"; then
    echo "❌ Wrong import (Playwright): $f"
  elif grep -q "from 'vitest'" "$f"; then
    echo "✅ Correct import (Vitest): $f"
  else
    echo "⚠️ Missing vitest import: $f"
  fi
done

echo "Backend test generation complete"
```

---

## Reference

- **Backend task list**: `reference/backend-task-list.json`
- **Backend handoff**: `reference/backend-handoff.md`
- **Vitest config**: `vitest.config.ts`
- **Test directory**: `tests/backend/`

---

**Phase PASSES when:**
- Test file exists for each backend task
- Each file imports from vitest
- Each file tests actual backend functions
- Valid TypeScript syntax

**Phase FAILS if:**
- Missing test files
- Tests use Playwright (wrong approach)
- Empty test files
- Invalid TypeScript syntax

