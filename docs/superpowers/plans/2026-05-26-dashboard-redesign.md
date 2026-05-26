# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat sidebar layout with a 3-page dashboard: Home (KPI cards + project grid), Project Detail (file cards + filters), Plan Viewer (iframe HTML rendering + task overlay).

**Architecture:** Client-side routing via state + pushState. No new backend endpoints. All existing components reusable, Sidebar removed.

**Tech Stack:** Preact, existing API client, inline styles

---

## Phase 1: Router & Layout Foundation

### Task 1: Router and Breadcrumb

**Files:**
- Create: `frontend/src/components/Router.tsx`
- Create: `frontend/src/components/Breadcrumb.tsx`
- Modify: `frontend/src/App.tsx`

### Task 2: KPI Cards

**Files:**
- Create: `frontend/src/components/KpiCards.tsx`

### Task 3: Project Card + Search

**Files:**
- Create: `frontend/src/components/ProjectCard.tsx`
- Create: `frontend/src/components/ProjectSearch.tsx`

### Task 4: Home Page

**Files:**
- Create: `frontend/src/components/HomePage.tsx`

## Phase 2: Project Detail

### Task 5: Filter Tabs

**Files:**
- Create: `frontend/src/components/FilterTabs.tsx`

### Task 6: File Card

**Files:**
- Create: `frontend/src/components/FileCard.tsx`

### Task 7: Project Detail Page

**Files:**
- Create: `frontend/src/components/ProjectDetailPage.tsx`

## Phase 3: Plan Viewer Overhaul

### Task 8: Plan Viewer with iframe + Task Overlay

**Files:**
- Rewrite: `frontend/src/components/PlanViewer.tsx`
- Create: `frontend/src/components/PlanViewerPage.tsx`

### Task 9: Wire Everything in App.tsx

**Files:**
- Rewrite: `frontend/src/App.tsx`

### Task 10: Cleanup and Verify

**Files:**
- Delete: `frontend/src/components/Sidebar.tsx`
- Verify: TypeScript compiles, production build succeeds
