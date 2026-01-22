# Phase 1-2: Frontend Task List Creation

Extract and organize frontend development tasks from the PRD source files into an actionable task list that, when fully executed, will result in a fully functional frontend application.

In our overall build process, we are 1) starting with a boilerplate template SaaS application, 2) building the entire frontend on top of that existing boilerplate app, 3) presenting it to the client to experience fully (with mock data where necessary), then 4) building the rest of the backend afterwards. Your job is to create the comprehensive task list to achieve #2 so that we can share a polished demo with the client, while understanding that the ultimate goal at the end of the overall workflow is to create a fully functional frontend+backend webapp that's properly linked together.

## Prerequisites
- Completed Phase 1-1 (PRD Context Mapping)  

{{PRD_CONTEXT}}

## Frontend-First Development Approach
Focus on application-specific features and components defined in the PRD. The task list should enable the frontend implementation to proceed independently.

**Foundation Already Established**: The platform starter provides Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, Prisma, Supabase Storage, and Auth.js - no setup tasks needed for these
- The platform already has Auth.js configured with credentials provider and test user (test@samus.ai / 12345). Frontend tasks must work with the EXISTING auth implementation, not attempt to integrate something else.
- Prisma is configured with PostgreSQL and basic User/Session models

**Data Layer Pattern**: Frontend tasks that fetch data MUST create the full import chain so that in the future, backend can replace implementations without rewiring. This ensures backend can replace mock implementations without changing routes or hooks:
1. Data layer file in `src/data/{domain}/get-{thing}.ts`
   - Export typed async function with mock implementation
   - Use `src/data/fixtures/` for mock data constants
   - Add `// MOCK: Backend will replace with Prisma query` comment
2. API route in `src/app/api/{domain}/route.ts` (if client-side fetch needed)
   - Import and call the data layer function
   - Do NOT inline mock data - always go through data layer
3. Hook fetches from real API route `/api/{domain}`
   - NEVER from `/api/fixtures/`
   - The fixtures folder is for data constants only, not API endpoints

### Frontend Implementation Constraints
**DO:**
- Reuse existing Auth.js setup - no custom auth integrations
- Create data layer files in `src/data/{domain}/` for all data fetching
- API routes import from data layer, hooks fetch from real API routes
- Prefer stable, in-place loading patterns (Suspense boundaries, skeleton states within layout)

**AVOID:**
- Early-return loading spinners that cause layout shift (e.g., `if (isLoading) return <Spinner />`)
- Complex mocking frameworks (MSW, mock-service-worker)
- Creating `/api/fixtures/` endpoints - use `src/data/fixtures/` for data constants only
- Having hooks fetch from `/api/fixtures/` routes

---

## 📁 File to Update

**You MUST update this file**: `reference/frontend-task-list.json`
**Location**: The file exists in the reference folder. Update it in place.
**CRITICAL**: The file path is `reference/frontend-task-list.json`, NOT at workspace root, NOT `prd/frontend-task-list.json`

---

## 🚨 WHAT TO DO

First verify the file exists:
```bash
ls -la reference/frontend-task-list.json
```

Then fill out ALL fields in this existing JSON file by analyzing the PRD files listed above and understand what already exists in the app at src/

---

## 🎯 Your Mission

Analyze the PRD files to extract all frontend development tasks. Each task should be:
- **Atomic**: Completable in 1-2 hours (one focused work session)
- **Testable**: Clear acceptance criteria from PRD specs
- **Independent**: Minimal dependencies on other tasks
- **Actionable**: Clear what needs to be built
- **Independent**: API-dependent tasks should be implementable with temporary mocks
- **Comprehensive**: Collectively, tasks must cover every major frontend workflow described in the PRD (public experience, authentication flows, global UX and accessibility concerns, etc)

**CRITICAL REQUIREMENT**: The `prdReference` field MUST only reference files from the "Implementation Context" section above. These are your authoritative source documents. Your task list content MUST faithfully represent the requirements, specifications, and user stories from these PRD files - do not invent or assume functionality not explicitly documented in the referenced PRD files.

---

## 📝 Task Structure to Follow

Each task in the `tasks` array should have this structure:

```json
{
  "id": "task-01",
  "title": "Action-oriented title (e.g., Implement user registration form)",
  "description": "Clear description of what needs to be done, noting any existing workspace components/utilities/ui that can or should be reused (if applicable).",
  "status": "pending",
  "type": ["ui"],  // Array of categories: "ui", "system", "data"
  "lastUpdated": "ISO 8601 timestamp (e.g., 2024-10-29T12:00:00Z)",
  "dependencies": ["other-task-ids"],
  "acceptanceCriteria": [
    "Specific testable criterion from PRD",
    "Another criterion",
    "..."
  ],
  "prdReference": ["prd/file-path.md"],
  "route": "/path/to/page",  // Next.js route where this feature lives (use [param] for dynamic segments)
  "subtasks": [
    {
      "id": "parent-id.1",
      "title": "Specific subtask if needed",
      "description": "Details for complex tasks",
      "status": "pending"
    }
  ]
}
```

⚠️ **TASK ID FORMAT**: Task IDs MUST be exactly `task-01`, `task-02`, `task-03`, etc. using a **2-digit number with leading zero**. Do NOT use prefixes like `FE-`, `BE-`, `UI-`, or any other format. The regex pattern is: `^task-\d{2}$`
- CORRECT: `task-01`, `task-02`, `task-10`, `task-42`  
- WRONG: `FE-001`, `FE-01`, `task-1`, `frontend-01`, `UI-001`

⚠️ **ACCEPTANCE CRITERIA FORMAT**: Criteria MUST describe user behavior and system response, not element existence.

Banned patterns (gate will reject):
- Starting with "Shows", "Displays", "Has", "Contains" without behavioral follow-up
- Using "placeholder" for user-facing features

Required format: `When user [action], [system response]`

| Reject | Accept |
|--------|--------|
| "Shows file input" | "When user selects file, filename appears in preview" |
| "Has camera button" | "When user taps camera, browser requests permission" |
| "Displays filter panel" | "When no filter options exist, shows explanatory message" |

Empty state requirement: Tasks with type "data" MUST include criteria for BOTH scenarios:
- "When [entity] not found, shows [error message]" (e.g., company doesn't exist)
- "When [entity] exists but collection empty, shows [empty state]" (e.g., company has no employees)

⚠️ **TASK CATEGORIES**: Tasks should be categorized using one or more of these types:
- **`ui`**: Components, pages, layouts, visual elements, and user interfaces (triggers browser validation in Phase 2)
- **`system`**: State management, routing, authentication, and core application logic
- **`data`**: API integration, data fetching, transformations, and backend communication

Examples:
- A registration form would be `["ui", "system"]` (UI component + authentication logic)
- A data visualization dashboard would be `["ui", "data"]` (UI component + data processing)
- A data listing page with fixtures would be `["ui", "data"]` (UI + JSON fixture data)
- A pure utility function would be `["system"]` (application logic only)

⚠️ **TASK DESCRIPTIONS**: Each task description should clearly call out the scoped frontend work and, when applicable, reference existing workspace components, hooks, utilities, or UI primitives that should be reused instead of reimplementing them.

The `executionPlan.phases` array should group tasks logically:

```json
{
  "order": 1,
  "name": "Foundation",
  "taskIds": ["task-01", "task-02"],
  "rationale": "Why these tasks go first"
}
```

---

## 📋 Task Extraction Process

### STEP 0: Audit Boilerplate Structure
Before extracting PRD tasks, identify existing boilerplate pages that need attention:
- **`/dashboard`**: The boilerplate includes a placeholder dashboard at `src/app/(app)/dashboard/page.tsx` with `[Placeholder]` content. Determine based on PRD:
  - Should this be replaced with the app's main authenticated landing page?
  - Should users be redirected elsewhere after login (e.g., to a specific feature page)?
  - **If keeping this page**: Create a task with full acceptance criteria specifying what the page should display, what actions it should offer, and how interactive elements should behave at mobile breakpoints.
  - **If redirecting away**: Create a task to update the post-login redirect and remove/repurpose this page.
- **Post-login redirect**: The default redirect after sign-in is `/dashboard` (configured in `src/components/auth/sign-in-form.tsx`). If the PRD defines a different authenticated home experience, create a task to update this redirect path.

### STEP 1: Analyze PRD for Frontend Work
Read through the PRD files above and identify:
- **UI Components**: Forms, buttons, navigation, displays
- **Pages/Routes**: Complete page implementations
- **User Interactions**: Click handlers, form submissions, modals
- **State Management**: Data that needs to be managed client-side
- **Visual Features**: Styling, animations, responsive design
- **Integrations**: API calls, real-time updates, file uploads
- **API Dependencies**: Which features need temporary mocks during frontend-first development
- **Navigation Surfaces**: Where each new top-level view must appear (sidebar, mobile nav sheet, command palette, marketing navbar)
- **Workflow & State Behaviors**: State-machine steps, edge cases, error handling, session management, offline/retry flows, analytics hooks, and performance optimizations called out in the PRD

**Note**: Skip tasks for standard production features (responsive breakpoints, basic accessibility, form validation, etc.) unless PRD specifies unique requirements. These are already handled by the platform starter's Tailwind and shadcn/ui setup.

### STEP 2: Create Atomic Tasks
Break down features into tasks that are:
- **PRD-Specific**: Focus on application features from PRD
- **Focused**: One clear deliverable
- **Sized Right**: 1-2 hours of work
- **Complete**: Includes all aspects (UI, logic, styling)
- **Testable**: Can verify it works per PRD specs
- **Traceable**: Reference the specific PRD documents (user stories, state machines, edge-case specs, performance research) that describe the requirement

**Examples of good task granularity:**
- "Create user registration form component" (if PRD specifies custom registration)
- "Implement product card display component" (for PRD-specific product displays)
- "Add shopping cart state management" (if PRD includes e-commerce)
- "Build checkout page with payment form" (for PRD-specific checkout flow)
- "Implement search bar with autocomplete" (if PRD specifies search functionality)

### STEP 3: Identify Dependencies
For each task, determine:
- What other tasks must complete first?
- What shared components are needed?
- What data/API endpoints are required?

### STEP 4: Create Execution Plan
Group tasks into logical phases. For example:
- **Phase 1**: Core Features (main functionality with mocks where needed)
- **Phase 2**: Enhanced Features (additional value)
- **Phase 3**: Polish & Integration (optimizations)

### STEP 5: Update Metadata
Calculate and fill in:
- `generated_at`: Current ISO 8601 timestamp
- `overview`: Brief description of the frontend scope from PRD
- `metadata.totalTasks`: Count of all tasks
- `metadata.estimatedHours`: Sum of all task estimates (1-2 hours each)
- `metadata.prdCoverage`: List the PRD files that were covered

---

## 🎯 Example Task

Good task example from a typical e-commerce PRD:

```json
{
  "id": "task-03",
  "title": "Implement product listing grid component",
  "description": "Create responsive grid layout for displaying product cards with filtering per UX specs. Use existing Card component from src/components/ui.",
  "status": "pending",
  "type": ["ui", "data"],
  "lastUpdated": "2024-10-29T14:30:00Z",
  "dependencies": ["task-02"],
  "acceptanceCriteria": [
    "When user views product listing on desktop, grid renders 3 columns; on tablet 2 columns; on mobile 1 column",
    "When user scrolls toward bottom of grid, next batch of products loads without full page reload",
    "When products are loading, skeleton cards appear in grid positions until data arrives",
    "When user selects a category filter, grid updates to display only matching products",
    "When no products exist or match current filters, empty state displays with Browse All CTA that clears filters when clicked"
  ],
  "prdReference": ["prd/specs/07-ux-specifications.json", "prd/user-stories/02-product-browsing.md"],
  "route": "/products",
  "subtasks": [
    {
      "id": "task-03.1",
      "title": "Build responsive grid with lazy loading",
      "description": "Implement grid that renders 3/2/1 columns at desktop/tablet/mobile with intersection observer for infinite scroll.",
      "status": "pending"
    },
    {
      "id": "task-03.2",
      "title": "Add filter sidebar with category selection",
      "description": "Create filter UI with category checkboxes; wire change handlers to update grid; include loading and empty states.",
      "status": "pending"
    }
  ]
}
```

---

## ✅ Quality Requirements

Your updated `frontend-task-list.json` MUST have:
- [ ] Valid JSON syntax
- [ ] `generated_at` with current ISO timestamp
- [ ] Meaningful `overview` describing frontend scope
- [ ] Task count between 10 and 50 (inclusive)
- [ ] Each task with all required fields
- [ ] Task IDs MUST follow exact format: `task-01`, `task-02`, etc. (2-digit with leading zero, NO prefixes like FE- or UI-)
- [ ] All tasks set to `status: "pending"`
- [ ] Valid `type` values as an array of one or more: "ui", "system", "data"
- [ ] Each task with type including "ui" has a `route` field
- [ ] At least 3 acceptance criteria per task
- [ ] Proper dependency mapping
- [ ] Logical execution plan with 3-4 phases
- [ ] Updated metadata with accurate counts
- [ ] PRD references only to files from Implementation Context
- [ ] Tasks that introduce major routes also include explicit navigation updates (sidebar, mobile nav, command menu, marketing navbar)
- [ ] Tasks collectively covering all major PRD-defined workflow and state-machine behaviors (public experience, auth/session handling, global UX/accessibility)

---

## 🚫 Common Pitfalls to Avoid

**AVOID:**
- Tasks that are too large (> 4 hours)
- Vague task descriptions
- Missing acceptance criteria
- Circular dependencies
- Tasks without prdReference from "Implementation Context"
- Inventing features not explicitly in PRD documents
- Missing coverage for any major PRD-defined workflow, state-machine behavior, or error/edge-case scenario
- API-dependent tasks without mock data approach
- Invalid JSON syntax
- Empty or minimal task lists
- Tasks for standard production features (responsive design, basic validation, etc.) unless PRD-specific

**DO:**
- Keep tasks focused and atomic
- Include clear acceptance criteria
- Map all dependencies explicitly
- Reference ONLY PRD files from "Implementation Context" section
- Extract requirements EXACTLY as specified in PRD (no embellishment)
- Include lastUpdated timestamp for all tasks
- Think about testability
- Ensure comprehensive coverage of PRD requirements

---

## 🔍 FINAL VERIFICATION

After updating the file, verify it's valid:
```bash
# Check file exists and is valid JSON
cat reference/frontend-task-list.json | jq . > /dev/null && echo "✅ Valid JSON"

# Check task count
cat reference/frontend-task-list.json | jq '.tasks | length'

# Check all tasks have required fields
cat reference/frontend-task-list.json | jq '.tasks[] | select(.id == null or .title == null or .acceptanceCriteria == null or .prdReference == null)' | jq -s 'if length > 0 then "❌ Some tasks missing required fields" else "✅ All tasks have required fields" end'

# Verify generated_at is set
cat reference/frontend-task-list.json | jq '.generated_at' | grep -q "^\"20" && echo "✅ Timestamp set" || echo "❌ Missing timestamp"
```

**Note**: API-dependent features use temporary mocks until backend is ready

**Phase PASSES when:**
- File is updated with valid JSON
- Task count between 10 and 50
- All required fields populated
- Execution plan defined
- Metadata updated
- PRD traceability complete

**Phase FAILS if:**
- Invalid JSON syntax
- Fewer than 10 tasks or more than 50 tasks
- Missing required fields
- No execution plan
- Metadata not updated
- Tasks without PRD references