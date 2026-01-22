# Phase 2: Build {{BUILD_UNIT_NAME}}

There are {{BUILD_UNIT_FRONTEND_TOTAL}} frontend tasks and {{BUILD_UNIT_BACKEND_TOTAL}} backend tasks in this workflow. {{BUILD_UNIT_FRONTEND_COMPLETED}} frontend tasks have been completed so far; this is frontend task #{{BUILD_UNIT_SEQUENCE}}.

Your job is to implement frontend task `{{BUILD_UNIT_ID}}` based on PRD requirements. Use mock data as needed so backend developers can connect real data quickly during their phase.

## 🧾 Task Snapshot
- **Type**: {{BUILD_UNIT_TYPE}}
- **Execution Sequence**: {{BUILD_UNIT_SEQUENCE}}
- **Execution Phase**: {{BUILD_UNIT_PHASE_LABEL}}
- **Phase Position**: {{BUILD_UNIT_PHASE_POSITION}}
- **Dependencies**: {{BUILD_UNIT_DEPENDENCIES}}
- **Last Updated**: {{BUILD_UNIT_LAST_UPDATED}}

{{PRD_CONTEXT}}

{{WORKSPACE_STRUCTURE}}

## 📘 Rationale
{{BUILD_UNIT_PHASE_RATIONALE}}

## 📝 Description
{{BUILD_UNIT_DESCRIPTION}}

## ✅ Acceptance Criteria
{{BUILD_UNIT_ACCEPTANCE_CRITERIA}}

{{BUILD_UNIT_E2E_TEST_CONTRACT}}## 📚 PRD Sources
{{BUILD_UNIT_PRD_SOURCES}}

{{BUILD_UNIT_UI_DEPENDENCIES_SECTION}}{{BUILD_UNIT_SUBTASKS_SECTION}}

## 📁 File Locations
- **Components**: `src/components/{feature-name}/{ComponentName}.tsx`
- **Pages**: `src/app/{route-path}/page.tsx` (Next.js app router)
- **Hooks**: `src/hooks/use-{hook-name}.ts`
- **Data Layer**: `src/data/{domain}/get-{thing}.ts` (mock implementations for backend)
- **Mock Fixtures**: `src/data/fixtures/{domain}.ts` (data constants only)
- **API Routes**: `src/app/api/{domain}/route.ts` (imports from data layer)
- **Utils**: `src/lib/{utility-name}.ts`
- **Types**: `src/types/{type-name}.ts`

## 🚀 Development Server
- Server runs on **http://localhost:3000** (Next.js dev server with Turbopack)
- If server crashes, it should auto-recover; you can also run: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: 
> - Never run `pkill -f node` or similar broad process-killing commands. This will terminate the orchestrator and crash the entire workflow.
> - **Never run `npm run build` or `pnpm build`** - this crashes the orchestrator. The dev server with Turbopack handles hot reloading automatically.
> - To restart the dev server: `bash scripts/check-or-start-dev-server.sh`

## 📦 Data Layer Pattern

When building features that need data, create the full import chain so backend can replace implementations without rewiring:

### Step 1: Create data layer file
```typescript
// src/data/products/get-products.ts
import { mockProducts } from '@/data/fixtures/products';

export interface GetProductsInput {
  categoryId?: string;
  limit?: number;
}

// MOCK: Backend will replace with Prisma query
export async function getProducts(input: GetProductsInput) {
  const { categoryId, limit = 20 } = input;
  let results = mockProducts;
  if (categoryId) {
    results = results.filter(p => p.categoryId === categoryId);
  }
  return results.slice(0, limit);
}
```

### Step 2: Create API route (if hook needs to fetch)
```typescript
// src/app/api/products/route.ts
import { getProducts } from '@/data/products/get-products';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  
  const data = await getProducts({ categoryId });
  return NextResponse.json(data);
}
```

### Step 3: Hook fetches from real API route
```typescript
// src/hooks/use-products.ts
'use client';

export function useProducts(categoryId?: string) {
  // Fetch from REAL API route, not /api/fixtures/
  const url = categoryId ? `/api/products?categoryId=${categoryId}` : '/api/products';
  const response = await fetch(url);
  // ...
}
```

**DO:**
- Create data layer files in `src/data/{domain}/`
- API routes import from data layer, not fixtures directly
- Hooks fetch from real API routes `/api/{domain}`
- Add `// MOCK:` comment in data layer marking what backend replaces
- Use placeholder image services (e.g., `https://picsum.photos/400/300`) for mock visuals

**DON'T:**
- Create `/api/fixtures/` endpoints (use `src/data/fixtures/` for data constants only)
- Inline mock data in API routes or hooks
- Have hooks fetch from `/api/fixtures/` routes
- Use MSW (Mock Service Worker) - it causes bundling issues with Next.js App Router
- Import Node.js modules (`async_hooks`, `fs`, etc.) in client components

## 🛠 Implementation Workflow
1. Locate `{{BUILD_UNIT_ID}}` in `reference/frontend-task-list.json`
2. If dependencies (`{{BUILD_UNIT_DEPENDENCIES}}`) aren't completed, STOP and report blocker
3. **TDD Validation**: If an E2E test exists for this task (`tests/e2e/generated/{{BUILD_UNIT_ID}}.spec.ts`):
   - Read the test file to understand expected behavior
   - Run the test (`npx playwright test tests/e2e/generated/{{BUILD_UNIT_ID}}.spec.ts`) to see current state
   - If test has issues (wrong routes, invalid selectors), fix the test FIRST
4. Read PRD sources for frontend requirements; use mock data when backend is pending
5. Cross-check `reference/backend-task-list.json` for matching actions/fetchers
6. Use server components by default, add `'use client'` for event handlers and hooks
7. Use correct imports: `@/components/ui/`, `@/lib/` paths
8. If adding a new top-level route, update navigation components (`src/components/navigation/*`)
9. If component has callback props (onSubmit, onClick, onAddItem), ensure parent passes a real handler—never leave undefined

> Status is updated automatically. Do not update the `frontend-task-list.json` file yourself.

### If You Hit an Error
1. **Classify**: Is it build-time (TypeScript/linting) or runtime (browser console/network)?
2. **Capture evidence**: Note the file, line number, and full error message
3. **Fix imports/deps first**: Missing imports often cascade into other errors
4. **Apply minimal fix**: Don't refactor unrelated code; avoid `@ts-ignore`
5. **Verify**: Reload the page and confirm the error is gone + console/network are clean
