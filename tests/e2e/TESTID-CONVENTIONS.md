# Test ID Conventions

## Overview

This document defines the `data-testid` naming conventions for the FSHQ.gg Fantasy Sports Clubhouse platform. Consistent test IDs enable reliable E2E testing, automation, and maintainability across the codebase.

## General Principles

1. **Kebab-case**: All test IDs use lowercase with hyphens (e.g., `feed-moment-card`)
2. **Descriptive**: Names clearly describe the element's purpose
3. **Hierarchical**: Use prefixes to group related elements (e.g., `feed-`, `league-`, `onboarding-`)
4. **Unique**: Each test ID should be unique within its scope
5. **Stable**: Test IDs should not change based on dynamic content

## Common Patterns

### Lists and Collections

```tsx
// List container
data-testid="[entity]-list"
data-testid="feed-moment-list"
data-testid="team-list"
data-testid="transaction-list"

// List items
data-testid="[entity]-item"
data-testid="feed-moment-item"
data-testid="team-item"
data-testid="transaction-item"

// Empty states
data-testid="[entity]-empty-state"
data-testid="feed-empty-state"
data-testid="transactions-empty-state"

// Loading states
data-testid="[entity]-loading"
data-testid="feed-loading"
data-testid="rankings-loading"
```

### Cards

```tsx
// Card container
data-testid="[type]-card"
data-testid="feature-card"
data-testid="team-card"
data-testid="league-preview-card"

// Card sections
data-testid="[type]-card-header"
data-testid="[type]-card-body"
data-testid="[type]-card-footer"
data-testid="moment-card-header"
data-testid="moment-card-body"
data-testid="moment-card-footer"
```

### Forms and Inputs

```tsx
// Form container
data-testid="[form-name]-form"
data-testid="league-connection-form"
data-testid="profile-settings-form"

// Input fields (use name or purpose)
data-testid="[field-name]-input"
data-testid="sleeper-username-input"
data-testid="league-id-input"
data-testid="team-name-input"

// Labels
data-testid="[field-name]-label"
data-testid="username-label"

// Validation messages
data-testid="[field-name]-error"
data-testid="username-error"
data-testid="league-id-error"

// Submit buttons
data-testid="[form-name]-submit"
data-testid="league-connection-submit"
data-testid="profile-update-submit"
```

### Buttons

```tsx
// Primary actions
data-testid="[action]-button"
data-testid="connect-league-button"
data-testid="submit-pick-button"
data-testid="publish-post-button"

// Secondary actions
data-testid="[action]-secondary-button"
data-testid="cancel-button"
data-testid="back-button"

// Icon buttons
data-testid="[action]-icon-button"
data-testid="menu-icon-button"
data-testid="close-icon-button"
```

### Navigation

```tsx
// Main navigation
data-testid="main-nav"
data-testid="league-sidebar"
data-testid="mobile-menu"

// Nav links
data-testid="nav-[page]"
data-testid="nav-feed"
data-testid="nav-pickems"
data-testid="nav-rankings"
data-testid="nav-matchups"
data-testid="nav-leaderboard"

// Breadcrumbs
data-testid="breadcrumb"
data-testid="breadcrumb-item"
```

### Loading States

```tsx
// Skeletons
data-testid="[component]-skeleton"
data-testid="moment-card-skeleton"
data-testid="rankings-table-skeleton"

// Spinners
data-testid="[action]-spinner"
data-testid="sync-spinner"
data-testid="loading-spinner"

// Progress bars
data-testid="[process]-progress"
data-testid="sync-progress"
data-testid="upload-progress"
```

### Error States

```tsx
// Error messages
data-testid="[context]-error"
data-testid="api-error"
data-testid="sync-error"
data-testid="form-error"

// Retry buttons
data-testid="[context]-retry"
data-testid="api-retry"
data-testid="sync-retry"
```

### Modals and Dialogs

```tsx
// Dialog containers
data-testid="[name]-dialog"
data-testid="confirm-delete-dialog"
data-testid="team-claiming-dialog"

// Dialog parts
data-testid="[name]-dialog-title"
data-testid="[name]-dialog-description"
data-testid="[name]-dialog-close"

// Alert dialogs
data-testid="[name]-alert-dialog"
data-testid="remove-member-alert-dialog"
```

### Badges and Status Indicators

```tsx
// Status badges
data-testid="[type]-badge"
data-testid="role-badge"
data-testid="status-badge"
data-testid="moment-type-badge"

// Count badges
data-testid="[type]-count-badge"
data-testid="reaction-count-badge"
data-testid="comment-count-badge"
```

---

## Task-Specific Test IDs

### Landing Page (`/`)

```tsx
// Hero section
data-testid="landing-hero"
data-testid="landing-hero-headline"
data-testid="landing-hero-subheadline"
data-testid="landing-hero-cta"
data-testid="connect-league-button"

// Feature grid
data-testid="feature-grid"
data-testid="feature-card"
data-testid="feature-card-icon"
data-testid="feature-card-title"
data-testid="feature-card-description"

// Auth CTAs
data-testid="login-button"
data-testid="signup-button"
```

### League Clubhouse Layout (`/leagues/[slug]`)

```tsx
// Layout structure
data-testid="league-layout"
data-testid="league-sidebar"
data-testid="league-header"
data-testid="league-content"

// Sidebar navigation
data-testid="nav-feed"
data-testid="nav-pickems"
data-testid="nav-rankings"
data-testid="nav-matchups"
data-testid="nav-leaderboard"
data-testid="nav-transactions"
data-testid="nav-history"
data-testid="nav-commissioner-desk"
data-testid="nav-settings"

// Mobile navigation
data-testid="mobile-menu-button"
data-testid="mobile-nav-drawer"
data-testid="mobile-nav-close"

// Header elements
data-testid="league-branding"
data-testid="league-name"
data-testid="user-menu-trigger"
```

### League Connection Wizard (`/connect-league`)

```tsx
// Wizard container
data-testid="league-connection-wizard"
data-testid="step-indicator"
data-testid="step-indicator-item"

// Step 1: League ID input
data-testid="league-id-step"
data-testid="sleeper-username-input"
data-testid="league-id-input"
data-testid="username-error"
data-testid="lookup-submit"
data-testid="league-lookup-loading"
data-testid="league-list"
data-testid="league-list-item"
data-testid="league-list-empty"
data-testid="league-lookup-error"
data-testid="lookup-retry"

// Step 2: Confirmation
data-testid="confirmation-step"
data-testid="league-preview-card"
data-testid="league-name-preview"
data-testid="league-team-count-badge"
data-testid="league-season-badge"
data-testid="confirm-league-button"
data-testid="back-to-lookup-button"
data-testid="existing-league-alert"

// Step 3: Sync progress
data-testid="sync-step"
data-testid="sync-progress"
data-testid="sync-progress-bar"
data-testid="sync-status-message"
data-testid="sync-complete"
data-testid="sync-success-message"
data-testid="sync-error-message"
data-testid="sync-warning-message"
data-testid="goto-league-button"
data-testid="retry-sync-button"
```

### Onboarding (`/leagues/[slug]/onboarding`)

```tsx
// Role selection
data-testid="onboarding-page"
data-testid="role-selection"
data-testid="manager-role-card"
data-testid="fan-role-card"
data-testid="role-card-title"
data-testid="role-card-description"
data-testid="continue-button"

// Team claiming (managers only)
data-testid="team-claiming-interface"
data-testid="team-grid"
data-testid="team-card"
data-testid="team-card-logo"
data-testid="team-card-name"
data-testid="team-sleeper-username"
data-testid="team-claimed-badge"
data-testid="team-unclaimed-badge"
data-testid="claim-team-button"
data-testid="claim-validation-error"

// Team support (fans only)
data-testid="team-support-selection"
data-testid="support-team-radio"
```

### Newsfeed (`/leagues/[slug]`)

```tsx
// Feed container
data-testid="newsfeed"
data-testid="feed-moment-list"
data-testid="feed-loading"
data-testid="feed-empty-state"
data-testid="feed-error"
data-testid="feed-retry"

// Filters and sorting
data-testid="feed-filters"
data-testid="sort-toggle"
data-testid="sort-recent"
data-testid="sort-chronological"
data-testid="moment-type-filter"
data-testid="filter-all"
data-testid="filter-trade"
data-testid="filter-ranking"
data-testid="filter-post"
data-testid="filter-transaction"

// Moment cards
data-testid="feed-moment-card"
data-testid="moment-card-header"
data-testid="moment-card-body"
data-testid="moment-card-footer"
data-testid="moment-type-badge"
data-testid="moment-author-avatar"
data-testid="moment-author-name"
data-testid="moment-timestamp"
data-testid="moment-content"
data-testid="moment-reactions"
data-testid="moment-comments-count"

// Moment actions
data-testid="reaction-button"
data-testid="comment-button"
data-testid="share-button"
data-testid="moment-menu"
data-testid="edit-moment"
data-testid="delete-moment"
data-testid="report-moment"

// Post creation
data-testid="create-post-textarea"
data-testid="post-publish-button"
data-testid="post-cancel-button"
data-testid="post-character-count"

// Reactions
data-testid="reaction-count"
data-testid="reaction-type-[type]"
data-testid="add-reaction-popover"
```

### Moment Detail (`/leagues/[slug]/moment/[momentId]`)

```tsx
// Detail page
data-testid="moment-detail-page"
data-testid="moment-detail-card"
data-testid="moment-content-full"

// Comments section
data-testid="comments-section"
data-testid="comment-list"
data-testid="comment-item"
data-testid="comment-author-avatar"
data-testid="comment-author-name"
data-testid="comment-content"
data-testid="comment-timestamp"

// Comment form
data-testid="comment-form"
data-testid="comment-textarea"
data-testid="comment-submit"
data-testid="comment-cancel"

// Comment actions
data-testid="comment-menu"
data-testid="edit-comment"
data-testid="delete-comment"
data-testid="report-comment"
```

### Moderation (`/leagues/[slug]/moderation`)

```tsx
// Moderation dashboard
data-testid="moderation-page"
data-testid="reported-content-list"
data-testid="reported-item-card"

// Report details
data-testid="report-reason"
data-testid="report-timestamp"
data-testid="report-reporter"

// Moderation actions
data-testid="approve-button"
data-testid="remove-button"
data-testid="warn-user-button"
data-testid="ban-user-button"
data-testid="moderation-action-dialog"
data-testid="moderation-reason-select"
```

### Commissioner Desk (`/leagues/[slug]/desk`)

```tsx
// Desk navigation
data-testid="commissioner-desk"
data-testid="desk-tabs"
data-testid="desk-tab-overview"
data-testid="desk-tab-content"
data-testid="desk-tab-automation"

// Content review
data-testid="content-review-list"
data-testid="pending-content-card"
data-testid="approve-content"
data-testid="reject-content"
data-testid="edit-content"

// Automated posts
data-testid="automated-posts"
data-testid="post-template-card"
data-testid="toggle-automation"
data-testid="edit-template"
data-testid="template-preview"

// Publish interface
data-testid="publish-dialog"
data-testid="publish-textarea"
data-testid="publish-as-select"
data-testid="publish-button"
data-testid="schedule-button"

// Notifications
data-testid="notification-settings"
data-testid="notification-toggle"
data-testid="notification-type-[type]"
```

### Rankings (`/leagues/[slug]/rankings`)

```tsx
// Rankings page
data-testid="rankings-page"
data-testid="rankings-table"
data-testid="rankings-loading"
data-testid="rankings-error"

// Table structure
data-testid="rankings-header"
data-testid="rankings-body"
data-testid="ranking-row"
data-testid="rank-position"
data-testid="team-avatar"
data-testid="team-name"
data-testid="team-record"
data-testid="points-for"
data-testid="points-against"

// Filters
data-testid="week-select"
data-testid="season-select"
data-testid="view-toggle"

// Visualizations
data-testid="power-rankings-chart"
data-testid="chart-legend"
data-testid="chart-tooltip"
```

### Matchups (`/leagues/[slug]/matchups`)

```tsx
// Matchups page
data-testid="matchups-page"
data-testid="matchups-container"
data-testid="matchups-loading"

// Matchup cards
data-testid="matchup-card"
data-testid="matchup-team-home"
data-testid="matchup-team-away"
data-testid="matchup-score-home"
data-testid="matchup-score-away"
data-testid="matchup-status-badge"

// Week navigation
data-testid="week-selector"
data-testid="previous-week"
data-testid="next-week"
data-testid="current-week"

// Matchup details
data-testid="matchup-roster"
data-testid="player-item"
data-testid="player-name"
data-testid="player-position"
data-testid="player-points"
```

### Brackets (`/leagues/[slug]/brackets`)

```tsx
// Brackets page
data-testid="brackets-page"
data-testid="bracket-container"
data-testid="bracket-loading"

// Bracket structure
data-testid="bracket-round"
data-testid="bracket-matchup"
data-testid="bracket-seed"
data-testid="bracket-team-name"
data-testid="bracket-score"
data-testid="bracket-winner-indicator"

// Controls
data-testid="bracket-type-select"
data-testid="bracket-view-tabs"
data-testid="bracket-zoom-controls"
```

### Pick'ems (`/leagues/[slug]/pickems`)

```tsx
// Pick'ems page
data-testid="pickems-page"
data-testid="pickems-grid"
data-testid="pickems-loading"

// Pick card
data-testid="pick-card"
data-testid="pick-game-info"
data-testid="pick-team-option-home"
data-testid="pick-team-option-away"
data-testid="pick-selected-indicator"
data-testid="pick-locked-badge"

// Submission
data-testid="submit-picks-button"
data-testid="picks-submitted-confirmation"

// My picks view
data-testid="my-picks-list"
data-testid="pick-result-correct"
data-testid="pick-result-incorrect"
data-testid="pick-result-pending"

// Standings
data-testid="pickems-standings"
data-testid="pickems-leaderboard"
data-testid="pickems-rank"
data-testid="pickems-record"
```

### Leaderboard (`/leagues/[slug]/leaderboard`)

```tsx
// Leaderboard page
data-testid="leaderboard-page"
data-testid="leaderboard-table"
data-testid="leaderboard-loading"

// Table rows
data-testid="leaderboard-row"
data-testid="leaderboard-rank"
data-testid="leaderboard-avatar"
data-testid="leaderboard-username"
data-testid="leaderboard-score"
data-testid="leaderboard-badge"

// Filters
data-testid="timeframe-toggle"
data-testid="category-select"

// User stats
data-testid="user-stats-card"
data-testid="stat-label"
data-testid="stat-value"
```

### Transactions (`/leagues/[slug]/transactions`)

```tsx
// Transactions page
data-testid="transactions-page"
data-testid="transactions-list"
data-testid="transactions-loading"
data-testid="transactions-empty"

// Transaction card
data-testid="transaction-card"
data-testid="transaction-type-badge"
data-testid="transaction-timestamp"
data-testid="transaction-teams"
data-testid="transaction-players"

// Filters
data-testid="transaction-type-filter"
data-testid="transaction-week-select"
data-testid="transaction-search"
data-testid="clear-filters-button"
```

### League History (`/leagues/[slug]/history`)

```tsx
// History page
data-testid="history-page"
data-testid="season-history-table"
data-testid="history-loading"

// Season rows
data-testid="history-season-row"
data-testid="season-year"
data-testid="champion-avatar"
data-testid="champion-name"
data-testid="runner-up-name"
data-testid="view-season-details"

// Season details
data-testid="season-details-modal"
data-testid="season-final-standings"
data-testid="season-stats"
```

### League Settings (`/leagues/[slug]/settings`)

```tsx
// Settings page
data-testid="settings-page"
data-testid="settings-form"

// Setting sections
data-testid="general-settings"
data-testid="notification-settings"
data-testid="privacy-settings"
data-testid="danger-zone"

// Settings controls
data-testid="league-name-input"
data-testid="league-description-textarea"
data-testid="setting-switch"
data-testid="setting-label"
data-testid="save-settings-button"

// Danger actions
data-testid="leave-league-button"
data-testid="delete-league-button"
data-testid="confirm-danger-action-dialog"
```

### Members Management (`/leagues/[slug]/members`)

```tsx
// Members page
data-testid="members-page"
data-testid="members-list"
data-testid="members-loading"

// Member card
data-testid="member-card"
data-testid="member-avatar"
data-testid="member-name"
data-testid="member-role-badge"
data-testid="member-team-name"

// Member actions
data-testid="member-menu"
data-testid="change-role-button"
data-testid="remove-member-button"
data-testid="role-select"
data-testid="confirm-remove-dialog"
```

### Profile (`/profile`)

```tsx
// Profile page
data-testid="profile-page"
data-testid="profile-form"

// Profile fields
data-testid="profile-avatar"
data-testid="upload-avatar-button"
data-testid="display-name-input"
data-testid="bio-textarea"
data-testid="email-input"
data-testid="username-input"

// Preferences
data-testid="notification-preferences"
data-testid="email-notifications-switch"
data-testid="push-notifications-switch"

// Actions
data-testid="save-profile-button"
data-testid="cancel-profile-button"
```

### User Menu / Header

```tsx
// User menu
data-testid="user-menu-trigger"
data-testid="user-menu-dropdown"
data-testid="user-avatar"
data-testid="user-menu-profile"
data-testid="user-menu-settings"
data-testid="user-menu-logout"

// Mobile menu
data-testid="mobile-menu-button"
data-testid="mobile-menu-sheet"
data-testid="mobile-menu-close"
```

### Toasts and Notifications

```tsx
// Toast notifications
data-testid="toast-notification"
data-testid="toast-success"
data-testid="toast-error"
data-testid="toast-warning"
data-testid="toast-info"
data-testid="toast-close"

// In-app notifications
data-testid="notifications-dropdown"
data-testid="notification-item"
data-testid="notification-unread-badge"
data-testid="mark-all-read-button"
```

---

## Dynamic Test IDs

For dynamic content (lists, grids), append an index or unique identifier:

```tsx
// Good: Include item index
data-testid="feed-moment-card-0"
data-testid="feed-moment-card-1"

// Better: Include unique ID when available
data-testid="feed-moment-card-abc123"
data-testid="team-card-sf-49ers"

// Implementation examples
{moments.map((moment, index) => (
  <MomentCard
    key={moment.id}
    data-testid={`feed-moment-card-${index}`}
    // or
    data-testid={`feed-moment-card-${moment.id}`}
  />
))}
```

## Component Library Integration

When using shadcn/ui components, add `data-testid` to the root element:

```tsx
// Button
<Button data-testid="submit-button">Submit</Button>

// Card
<Card data-testid="team-card">
  <CardHeader data-testid="team-card-header">
    <CardTitle data-testid="team-card-title">Team Name</CardTitle>
  </CardHeader>
</Card>

// Input
<Input
  data-testid="username-input"
  aria-label="Username"
/>

// Select
<Select data-testid="week-select">
  <SelectTrigger data-testid="week-select-trigger" />
  <SelectContent data-testid="week-select-content">
    <SelectItem value="1" data-testid="week-select-item-1">Week 1</SelectItem>
  </SelectContent>
</Select>
```

## Testing Best Practices

1. **Prefer Test IDs over CSS selectors**: Test IDs are more stable than class names
2. **Use semantic HTML**: Combine with ARIA labels for accessibility
3. **Keep IDs stable**: Don't change test IDs unless component purpose changes
4. **Document exceptions**: If deviating from conventions, document why
5. **Use TypeScript helpers**: Create type-safe test ID generators

```typescript
// Example: Type-safe test ID generator
type TestIdPrefix = 'feed' | 'team' | 'league' | 'profile';
type TestIdSuffix = 'card' | 'button' | 'input' | 'list';

const createTestId = (prefix: TestIdPrefix, suffix: TestIdSuffix, id?: string) => {
  return id ? `${prefix}-${suffix}-${id}` : `${prefix}-${suffix}`;
};

// Usage
createTestId('feed', 'card', 'abc123'); // "feed-card-abc123"
```

## Automated Testing Integration

### Playwright Example

```typescript
import { test, expect } from '@playwright/test';

test('user can connect a league', async ({ page }) => {
  await page.goto('/connect-league');

  // Step 1: Enter username
  await page.getByTestId('sleeper-username-input').fill('testuser');
  await page.getByTestId('lookup-submit').click();

  // Wait for loading
  await expect(page.getByTestId('league-lookup-loading')).toBeVisible();
  await expect(page.getByTestId('league-lookup-loading')).toBeHidden();

  // Step 2: Select league
  await page.getByTestId('league-list-item').first().click();
  await page.getByTestId('confirm-league-button').click();

  // Step 3: Wait for sync
  await expect(page.getByTestId('sync-progress-bar')).toBeVisible();
  await expect(page.getByTestId('sync-success-message')).toBeVisible();

  // Navigate to league
  await page.getByTestId('goto-league-button').click();
  await expect(page.getByTestId('newsfeed')).toBeVisible();
});
```

### Cypress Example

```typescript
describe('Newsfeed', () => {
  beforeEach(() => {
    cy.visit('/leagues/test-league');
  });

  it('displays moments in chronological order', () => {
    cy.getByTestId('feed-moment-list').should('be.visible');
    cy.getByTestId('feed-moment-card').should('have.length.at.least', 1);
  });

  it('allows filtering by moment type', () => {
    cy.getByTestId('moment-type-filter').click();
    cy.getByTestId('filter-trade').click();
    cy.getByTestId('feed-moment-card').each(($card) => {
      cy.wrap($card).find('[data-testid="moment-type-badge"]').should('contain', 'Trade');
    });
  });

  it('allows creating a new post', () => {
    cy.getByTestId('create-post-textarea').type('Test post content');
    cy.getByTestId('post-publish-button').click();
    cy.getByTestId('toast-success').should('be.visible');
  });
});
```

---

## Changelog

- **2026-01-18**: Initial version based on frontend task list analysis
- **Future**: Update as new features are added or conventions evolve

## Contributing

When adding new features:
1. Follow existing naming conventions
2. Update this document with new test IDs
3. Add examples for complex patterns
4. Run E2E tests to verify test IDs work as expected
