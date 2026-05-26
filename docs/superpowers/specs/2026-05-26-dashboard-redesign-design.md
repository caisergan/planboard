# Dashboard Redesign — Design Specification

**Date:** 2026-05-26
**Status:** Approved
**Type:** Frontend redesign

---

## 1. Problem

The current frontend is a flat sidebar + single-panel layout that feels like a file browser, not a dashboard. There's no overview, no stats, no visual hierarchy. Users land on an empty "select a file" page with no sense of what's across their projects.

## 2. Solution

Replace the current single-page layout with a 3-page navigation flow:

1. **Home Dashboard** — KPI summary cards + searchable project card grid
2. **Project Detail** — all plans/specs for a project as filterable cards
3. **Plan Viewer** — full HTML rendering of the plan file with interactive task toggles

Navigation is breadcrumb-based (Home > Project > Plan). No persistent sidebar. Each page is a full-page view.

## 3. Navigation Model

### 3.1 Routing

Client-side routing with three routes:

| Route | Page | Breadcrumb |
|-------|------|------------|
| `/` | Home Dashboard | Home |
| `/project/:name` | Project Detail | Home / :name |
| `/view?path=<abs_path>` | Plan Viewer | Home / :project / :title |

No external router library — use Preact state-based routing with `history.pushState` for clean URLs and browser back/forward support.

### 3.2 Breadcrumb

Always visible at the top of every page. Shows connection status (green/red dot) on the far right. Each breadcrumb segment is clickable to navigate back.

## 4. Page 1: Home Dashboard

### 4.1 KPI Summary Row

Four stat cards in a single row:

| Card | Value | Color |
|------|-------|-------|
| Projects | count of indexed projects | indigo (#818cf8) |
| Total Files | count of all indexed files | white (#e2e8f0) |
| Tasks Done | sum of completed_tasks across all HTML files | green (#4ade80) |
| In Progress | count of files with status "in-progress" | amber (#fbbf24) |

The backend already returns file metadata with `total_tasks` and `completed_tasks`. The frontend aggregates these from the file index.

### 4.2 Search Bar

Below the KPI row. Filters the project card grid by project name (client-side filtering). Styled as a subtle input with search icon.

### 4.3 Project Card Grid

3-column responsive grid of rich project cards. Each card shows:

- **Project name** (bold, top-left)
- **Completion percentage badge** (top-right, color-coded: green >75%, amber 25-75%, indigo <25%)
- **File counts** (e.g., "9 plans · 3 specs · 45 tasks")
- **Progress bar** (horizontal, color matches percentage badge)
- **Plan tags** — names of the most recent 2-3 plans, plus "+N" overflow count

Clicking a card navigates to the Project Detail page.

Responsive: 3 columns on wide screens, 2 on medium, 1 on narrow.

### 4.4 API Requirements

No new API endpoints needed. The existing `/api/projects` and `/api/projects/:name/files` provide all data. The frontend computes aggregates (total tasks, completion percentage) from the file metadata.

## 5. Page 2: Project Detail

### 5.1 Project Header

Shows project name, aggregated stats (plans, specs, tasks, completion percentage), and an overall progress bar.

### 5.2 Filter Tabs

Horizontal tab bar with filters:
- **All** (default) — shows everything
- **Plans** — only files with `type: "plan"`
- **Specs** — only files with `type: "spec"`
- **In Progress** — only files with `status: "in-progress"`
- **Done** — only files with `status: "done"`

Each tab shows a count. Client-side filtering from the already-fetched file list.

### 5.3 Plan/Spec Card Grid

2-column grid of file cards. Each card shows:

- **Type icon** — filled diamond (◆) for HTML, open diamond (◇) for markdown
- **File title**
- **Metadata line** — type · date · status (color-coded)
- **Progress bar** (for plans with tasks)
- **Task count** (e.g., "6/10 tasks done") or "design document" for specs

Clicking a card navigates to the Plan Viewer.

## 6. Page 3: Plan Viewer

### 6.1 HTML Rendering

The plan viewer's primary purpose is to render planboard HTML files faithfully. These files are self-contained HTML documents with their own `<style>` blocks, headers, navigation, sections, and content.

**Rendering approach:** Use a sandboxed `<iframe>` with `srcdoc` to render the full HTML document. This ensures:
- The file's own CSS applies without leaking into the dashboard
- The file's HTML structure (navbars, headers, sections) renders as intended
- No conflicts between the plan's styles and the dashboard's styles

### 6.2 Interactive Overlay

On top of the iframe rendering, the viewer extracts task data from the HTML using `data-task-*` attributes (same DOMParser approach as before) and renders an interactive overlay panel:

- **Task summary** — collapsible panel showing all phases and tasks with checkboxes
- **Toggle behavior** — clicking a checkbox calls the PATCH API, which updates the source file. The iframe reloads to reflect the change.

This separates concerns: the iframe shows the document faithfully, the overlay provides the interactive controls.

### 6.3 Markdown Files

Markdown files render the same as before — parsed with `marked` and displayed with syntax highlighting. No iframe needed since we control the rendering.

### 6.4 View Modes

Two view modes toggled by a button in the viewer header:

- **Document view** (default) — full HTML rendering in iframe
- **Tasks view** — shows only the extracted phases and tasks with toggles (the current PlanViewer behavior, useful for quick task management without scrolling the full document)

## 7. Component Architecture

### 7.1 New Components

| Component | Purpose |
|-----------|---------|
| `Router` | State-based routing, history.pushState, breadcrumb state |
| `Breadcrumb` | Navigation breadcrumb with connection status dot |
| `HomePage` | KPI cards + search + project grid |
| `KpiCards` | Four stat cards row |
| `ProjectCard` | Single project card in the grid |
| `ProjectSearch` | Search input for filtering projects |
| `ProjectDetailPage` | Project header + filter tabs + file card grid |
| `FilterTabs` | Horizontal filter tab bar |
| `FileCard` | Single plan/spec card in the project detail grid |
| `PlanViewerPage` | Breadcrumb + view mode toggle + iframe/task panel |

### 7.2 Modified Components

| Component | Change |
|-----------|--------|
| `App.tsx` | Replace current layout with Router |
| `PlanViewer` | Add iframe rendering + view mode toggle |
| `StatusBadge` | No changes needed |
| `ProgressBar` | No changes needed |
| `TaskList` | No changes needed |

### 7.3 Removed Components

| Component | Reason |
|-----------|--------|
| `Sidebar` | Replaced by breadcrumb navigation + card-based drilling |

## 8. Styling

All styling uses inline styles (current pattern) for simplicity. Dark theme consistent with existing design:

- Background: #0f172a (base), #1e293b (cards/surfaces)
- Borders: #334155
- Text: #f1f5f9 (primary), #cbd5e1 (secondary), #64748b (muted)
- Accent: #818cf8 (indigo), #4ade80 (green), #fbbf24 (amber)
- Card border-radius: 10px
- Grid gaps: 12px

## 9. Data Flow

### 9.1 Home Page Load

```
App mounts → useFileIndex fetches all projects + files
  → HomePage receives { projects, files }
  → KpiCards computes aggregates from files
  → ProjectCard grid renders from projects + files
```

### 9.2 Navigation

```
User clicks project card → Router pushes /project/:name
  → ProjectDetailPage renders with files[name]
  → User clicks file card → Router pushes /view?path=<path>
  → PlanViewerPage fetches file content, renders iframe + tasks
```

### 9.3 Task Toggle in Viewer

```
User clicks checkbox in tasks panel
  → PATCH /api/files/tasks
  → File updated on disk
  → Iframe reloads (srcdoc updated with fresh content)
  → Task panel re-renders with new state
```

### 9.4 WebSocket Updates

Same as before — file changes push WS events, `useFileIndex` reloads project data. If the user is viewing a file that changed, the viewer re-fetches and re-renders.
