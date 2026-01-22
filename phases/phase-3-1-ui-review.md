# Phase 3-1: Frontend UI Review

## 🎯 Objective

This app was built on a generic SaaS boilerplate, so the design is kind of generic. Your mission: **deep dive on the frontend and make it elegant**. Tiny UI changes go a long way and are preferred. Focus on styling primarily.

**Do not stop until you have revamped this app into something that would make Jony Ive blush.**

## ⚠️ Critical: Be Thorough

Worst case scenario is some pages look great while others look awful or are missed entirely. Or desktop looks great but mobile is completely messed up.

You MUST:
- Review **every single page** in the app
- Test **both desktop AND mobile** breakpoints
- Ensure **consistent quality** across the entire frontend

## 🎨 What to Focus On

### Styling & Visual Polish
- Typography: font sizes, weights, line heights that feel intentional
- Colors: consistent palette, proper hover/active states
- Spacing: breathing room, alignment, visual rhythm
- Components: buttons, inputs, cards should look cohesive together
- Visual hierarchy: primary actions pop, secondary actions subdued

### Responsive Design
- Mobile (375px): navigation works, content stacks properly, no overflow
- Tablet (768px): layouts adapt gracefully
- Desktop (1280px+): proper use of space, nothing cramped or stretched

### Example Details That Matter
- Shadows and borders that add depth without being heavy
- Consistent border-radius across components
- Focus states that are visible but not ugly
- Smooth transitions on hover/interaction
- Icons that match the aesthetic
- Sheet/Dialog body content has proper padding (matching header/footer)
- Header and main content containers have matching horizontal alignment

## 🔍 UI Verification with Chrome DevTools

Use Chrome DevTools MCP to visually verify your work:

1. Navigate to app: `navigate_page({ type: "url", url: "http://localhost:3000", timeout: 30000 })`
2. If on sign-in page, authenticate via API:
   ```javascript
   evaluate_script({ function: `async () => {
     const csrf = await fetch('/api/auth/csrf').then(r => r.json());
     await fetch('/api/auth/callback/credentials', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: 'test@samus.ai', password: '12345', json: 'true' })
     });
     window.location.href = '/dashboard';
   }` })
   ```
3. For each page you review:
   - Navigate: `navigate_page({ type: "url", url: "http://localhost:3000/[route]", timeout: 30000 })`
   - Screenshot: `take_screenshot({ format: "jpeg", quality: 80 })`
      - **Do not use full-page screenshots**
      - Keep viewport-sized captures only (max height <= 800px)
      - If a page is long, scroll and take multiple viewport screenshots
   - Check mobile: `set_viewport({ width: 375, height: 812 })` then screenshot again
   - Reset viewport: `set_viewport({ width: 1280, height: 800 })`
4. Check for errors: `list_console_messages({ types: ["error"], pageSize: 10 })`

## 🚀 Development Server
- Server is active on **http://localhost:3000** with Turbopack fast refresh
- Changes reflect automatically
- If server needs restart: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: Never run `pkill -f node`, `npm run build`, or `pnpm build` - these crash the orchestrator.

## ✅ Success Criteria

- Every page looks intentionally designed, not boilerplate
- Desktop and mobile both look great
- Consistent visual language across the entire app
- UI feels premium and professional

