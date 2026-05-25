# Planboard — Design Specification

**Date:** 2026-05-26
**Status:** Approved
**Type:** Full-system design

---

## 1. Problem Statement

Developers using Claude Code and Codex generate plans and specs across many projects. These artifacts live scattered in `docs/` directories with no unified view, no cross-project visibility, and no way to interact with them (toggle tasks, edit, provide feedback) that flows back into active AI sessions.

## 2. Solution

Planboard is a local dashboard that:
- **Aggregates** all plans/specs from configured project directories
- **Renders** both structured HTML (interactive) and markdown (read-only) files
- **Enables interaction** — users toggle tasks, and changes write back to the source files
- **Bridges to AI sessions** — Claude/Codex sessions detect file changes and adapt in real-time

## 3. Architecture

### 3.1 Overview

Split Server architecture: Go backend + Preact frontend running as separate processes in development, unified in production.

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S MACHINE                        │
│                                                         │
│  ┌──────────────┐         ┌──────────────────────────┐ │
│  │  Dashboard    │  HTTP   │     Go Backend            │ │
│  │  (Preact)     │◄───────►│     :8080                 │ │
│  │  :5173 (dev)  │         │                           │ │
│  │               │   WS    │  ┌─────────────────────┐ │ │
│  │  - Plan view  │◄───────►│  │  Scanner Service     │ │ │
│  │  - Task toggle│         │  │  - Walks config roots│ │ │
│  │  - File tree  │         │  │  - Finds docs/ dirs  │ │ │
│  │  - MD render  │         │  │  - Indexes files     │ │ │
│  └──────────────┘         │  └─────────────────────┘ │ │
│                            │                           │ │
│                            │  ┌─────────────────────┐ │ │
│                            │  │  Watcher Service     │ │ │
│                            │  │  - fsnotify on dirs  │ │ │
│                            │  │  - Debounces events  │ │ │
│                            │  │  - Pushes via WS     │ │ │
│                            │  └─────────────────────┘ │ │
│                            │                           │ │
│                            │  ┌─────────────────────┐ │ │
│                            │  │  File I/O Service    │ │ │
│                            │  │  - Read HTML/MD      │ │ │
│                            │  │  - Write-back edits  │ │ │
│                            │  │  - MD → HTML convert │ │ │
│                            │  └─────────────────────┘ │ │
│                            └──────────────────────────┘ │
│                                        ▲                 │
│                                        │ read/write      │
│                                        ▼                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Project Directories (source of truth)     │ │
│  └────────────────────────────────────────────────────┘ │
│                                        ▲                 │
│                                        │ file changes    │
│                                        ▼                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Claude / Codex Sessions                   │ │
│  │  - CLAUDE.md references plan at session start       │ │
│  │  - Hook detects mid-session changes (mtime check)  │ │
│  │  - /sync command for manual refresh                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Go | Single binary, fast file I/O, native concurrency, fsnotify, low memory |
| Frontend | Preact + Vite | 3KB runtime, React-ecosystem compatibility, fast HMR |
| Markdown rendering | marked (client-side) | Lightweight, GFM support, syntax highlighting via highlight.js |
| Glob matching | github.com/bmatcuk/doublestar | `**` recursive glob (Go's filepath.Glob doesn't support `**`) |
| File watching | fsnotify | Mature Go library, cross-platform |
| WebSocket | github.com/coder/websocket | Real-time push to frontend (successor to nhooyr.io/websocket) |
| HTML parsing | golang.org/x/net/html | Standard library-adjacent, reliable for data-attribute manipulation |

### 3.3 Project Structure

```
planboard/
├── cmd/
│   └── planboard/
│       └── main.go              # Entry point
├── internal/
│   ├── scanner/
│   │   └── scanner.go          # Directory walking, file discovery
│   ├── watcher/
│   │   └── watcher.go          # fsnotify wrapper, debouncing
│   ├── fileio/
│   │   ├── reader.go           # HTML/MD file reading + metadata extraction
│   │   └── writer.go           # HTML modification (task toggles)
│   ├── api/
│   │   ├── router.go           # HTTP route definitions
│   │   ├── handlers.go         # Request handlers
│   │   └── websocket.go        # WS connection management
│   └── config/
│       └── config.go           # Config loading/validation
├── frontend/
│   ├── src/
│   │   ├── main.tsx            # Preact entry
│   │   ├── App.tsx             # Root component
│   │   ├── components/
│   │   │   ├── Sidebar.tsx     # Project list + file tree
│   │   │   ├── PlanViewer.tsx  # Interactive HTML plan renderer
│   │   │   ├── MarkdownViewer.tsx  # MD file renderer
│   │   │   ├── TaskList.tsx    # Toggleable task checkboxes
│   │   │   └── StatusBadge.tsx # Plan/phase status indicators
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts # WS connection + reconnection
│   │   │   └── useFileIndex.ts # File list state management
│   │   └── lib/
│   │       ├── api.ts          # HTTP client for Go backend
│   │       └── parser.ts       # HTML data-attribute extraction
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── planboard.config.example.json # Example config (copied to ~/.config/planboard/ on first run)
├── Makefile                     # dev, build, run targets
└── go.mod
```

## 4. Structured HTML File Format

### 4.1 Design Principles

1. **Self-contained** — opens in any browser without planboard running, looks presentable
2. **Data attributes for machine parsing** — `data-*` attributes carry all structured state
3. **Semantic HTML** — headings, lists, sections map cleanly to plan structure
4. **Deterministic generation** — same input always produces identical output
5. **Safe modification** — Go can parse, change one `data-task-status`, and write back without corrupting other content

### 4.2 Metadata Convention

All machine-readable metadata lives in `<meta>` tags in the `<head>`:

```html
<meta name="planboard:type" content="plan">
<meta name="planboard:project" content="trade-station">
<meta name="planboard:created" content="2026-05-26">
<meta name="planboard:status" content="in-progress">
<meta name="planboard:total-tasks" content="12">
<meta name="planboard:completed-tasks" content="3">
```

The `<html>` element carries a version attribute for format evolution:

```html
<html lang="en" data-planboard-version="1">
```

Go extracts metadata by parsing only `<head>` — avoids full document parse for indexing.

**`planboard:status` computation:** Auto-recomputed on every write-back:
- `done` — all tasks have `data-task-status="done"`
- `in-progress` — at least one task is `done` or `active`
- `pending` — no tasks are `done` or `active`

### 4.3 Task Structure

```html
<ul data-task-list>
  <li data-task-id="1" data-task-status="done">
    Set up Go project structure
  </li>
  <li data-task-id="2" data-task-status="active">
    Implement directory scanner
  </li>
  <li data-task-id="3" data-task-status="pending">
    Build file watcher with fsnotify
  </li>
</ul>
```

**Task statuses:** `pending` | `active` | `done`

**Toggle semantics:** The dashboard checkbox maps to a binary action:
- Unchecked (pending or active) → click → `done`
- Checked (done) → click → `pending`

The `active` status is set only by AI sessions (marking the task they're currently working on), never by the dashboard toggle. This avoids a confusing three-state checkbox UX.

When the dashboard toggles a task:
1. Go parses the HTML document
2. Finds the `<li>` with matching `data-task-id`
3. Updates `data-task-status`
4. Recomputes `planboard:completed-tasks` and `planboard:total-tasks` meta tags
5. Recomputes parent `data-phase-status` if all child tasks are done
6. Writes modified HTML to disk (atomic: write to temp file in same directory, then rename)

### 4.4 Section Structure

```html
<section data-section="overview">
  <h2>Overview</h2>
  <p>Description of the plan...</p>
</section>

<section data-section="phases">
  <h2>Phases</h2>
  <div data-phase="1" data-phase-status="in-progress">
    <h3>Phase 1: Core Infrastructure</h3>
    <ul data-task-list>...</ul>
  </div>
</section>
```

**Section types:** `header` | `overview` | `phases` | `notes` | `decisions` | `references`

**Phase statuses:** `pending` | `in-progress` | `done` (auto-computed from child tasks)

### 4.5 File Types

| Type | `planboard:type` | Purpose | Interactive elements |
|------|------------------|---------|---------------------|
| Plan | `plan` | Phased implementation with tasks | Task toggles, phase progress |
| Spec | `spec` | Design document with decisions | Approval sections (future) |

### 4.6 Embedded CSS

Each HTML file includes a minimal embedded `<style>` block so it renders presentably when opened directly in a browser. The CSS is intentionally compact (~30 lines) and uses CSS custom properties for easy theming:

```css
:root {
  --bg: #0f172a;
  --text: #e2e8f0;
  --accent: #818cf8;
  --success: #4ade80;
  --warning: #fbbf24;
  --muted: #64748b;
}
```

When rendered inside the planboard dashboard, the embedded styles are overridden by the dashboard's own styling (the file is parsed and rendered as components, not embedded as an iframe).

## 5. Data Flows

### 5.1 Initial Load

```
User runs `planboard` CLI
  → Go reads ~/.config/planboard/config.json (expands ~ to $HOME)
  → Scanner walks each configured root
  → For each first-level subdirectory under a root:
    → Derives project name from directory name (e.g., ~/projects/trade-station → "trade-station")
    → Checks for docs/ subdirectories
    → Scans matching patterns (docs/**/*.html, docs/**/*.md)
  → Extracts <head> metadata from HTML files (fast parse, <head> only)
  → Extracts YAML frontmatter from .md files (title, date, status if present)
  → Builds in-memory file index: project → [files with metadata]
  → Starts fsnotify watchers on all discovered docs/ directories
  → Serves REST API on configured port
  → Opens browser (or prints URL)
```

**Project name resolution order:**
1. `planboard:project` meta tag in HTML file (explicit override)
2. `.planboard` marker file's `project_name` field (if present)
3. First-level directory name under the configured root (default)

### 5.2 Viewing a Plan

```
User clicks file in sidebar
  → Preact sends GET /api/files?path=<abs_path>
  → Go reads file from disk (always fresh, never cached)
  → Returns { content: string, type: "html"|"md", metadata: {...} }
  → If HTML: Preact parses data-* attributes, renders interactive view
  → If MD: Preact renders via marked with syntax highlighting
```

### 5.3 Task Toggle (Bidirectional Write-back)

```
User clicks task checkbox in dashboard
  → Preact sends PATCH /api/files/tasks
    body: { path: "<abs_path>", taskId: "3", status: "done" }
  → Go parses HTML file
  → Finds <li data-task-id="3">
  → Updates data-task-status attribute
  → Recomputes meta counters and phase statuses
  → Writes modified HTML to disk (atomic: temp file + rename, same directory)
  → Adds path to self-write tracker (path + timestamp, expires after 500ms)
  → Returns updated metadata
  → fsnotify fires → watcher checks self-write tracker → skips (self-triggered)
  → Claude session hook detects change on next prompt
```

### 5.4 External File Change (Live Update)

```
Claude/Codex session writes or modifies a plan file
  → fsnotify detects change
  → Watcher debounces (100ms window)
  → Watcher checks self-write tracker (path + timestamp within 500ms → skip)
  → If NOT self-triggered:
    → Pushes event via WebSocket: { type: "file-changed", path: "...", project: "..." }
    → Preact receives WS message
    → If file is currently being viewed: re-fetches and re-renders
    → If file is in sidebar: updates metadata (task counts, status badge)
```

**Self-write suppression:** Go maintains a `sync.Map[string]time.Time` of recently-written paths. When fsnotify fires, the watcher checks if `time.Since(lastWrite) < 500ms` for that path. If yes, it's a self-triggered event and is ignored. Entries are garbage-collected every 5 seconds.

### 5.5 New File Detected

```
Claude session creates a new plan HTML file
  → fsnotify detects creation
  → Scanner re-indexes that project's docs/ directory
  → Pushes WS event: { type: "file-added", path: "...", metadata: {...} }
  → Preact adds file to sidebar file tree
```

## 6. API Endpoints

### 6.1 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all discovered projects with file counts |
| GET | `/api/projects/:name/files` | List files for a project with metadata |
| GET | `/api/files?path=<abs_path>` | Read file content + metadata |
| PATCH | `/api/files/tasks` | Toggle task status. Body: `{ path, taskId, status }` |
| POST | `/api/convert` | Convert .md file to planboard HTML format. Body: `{ path }` |
| GET | `/api/config` | Current configuration |
| PUT | `/api/config` | Update configuration (add/remove roots) |
| GET | `/api/health` | Server health check |

### 6.2 WebSocket Protocol

Connection: `ws://localhost:8080/ws`

Server → Client messages:

```json
{ "type": "file-changed", "path": "/abs/path/to/file.html", "project": "trade-station" }
{ "type": "file-added", "path": "/abs/path/to/new-file.html", "project": "planboard", "metadata": {...} }
{ "type": "file-deleted", "path": "/abs/path/to/removed.html", "project": "outfitter" }
{ "type": "scan-complete", "projects": 15, "files": 47 }
```

All events are pushed to all connected clients (single-user local tool, no need for per-project subscriptions in v1). The frontend filters client-side if needed.

## 7. Configuration

### 7.1 Config File Location

`~/.config/planboard/config.json`

The config loader expands `~` to `$HOME` at load time. All paths in the config can use `~` for portability.

### 7.2 Schema

```json
{
  "roots": [
    "~/Desktop/personal-projects",
    "~/work"
  ],
  "scan_patterns": [
    "docs/**/*.html",
    "docs/**/*.md"
  ],
  "exclude_patterns": [
    "node_modules",
    ".git",
    "vendor"
  ],
  "server": {
    "port": 8080,
    "frontend_port": 5173
  },
  "watch": {
    "debounce_ms": 100
  }
}
```

### 7.3 Future: `.planboard` Marker File

For optimization in large directory trees, projects can opt-in by placing a `.planboard` file in their root:

```json
{
  "docs_paths": ["docs/superpowers/specs", "docs/superpowers/plans"],
  "project_name": "trade-station"
}
```

When present, the scanner skips recursive walking and uses the explicit paths. This is an optimization for projects with deep directory trees — not required.

## 8. Claude/Codex Session Integration

### 8.1 CLAUDE.md Reference (Session Start)

Each project that uses planboard adds to its `CLAUDE.md`:

```markdown
# Planboard

Active plan: docs/superpowers/plans/2026-05-26-planboard.html
Read this file at session start to understand current progress and priorities.
When a task is completed, update its data-task-status to "done".
```

This gives Claude immediate context without any extra tooling.

### 8.2 Hook (Mid-Session Detection)

A Claude Code hook on `user-prompt-submit` that detects plan changes:

```bash
#!/bin/bash
# .claude/hooks/planboard-sync.sh
#
# Finds the active plan file by scanning for the most recent .html file
# in docs/superpowers/plans/ (or reads from .planboard-active if it exists).

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Determine active plan file
if [ -f "$PROJECT_DIR/.planboard-active" ]; then
  PLAN_FILE="$PROJECT_DIR/$(cat "$PROJECT_DIR/.planboard-active")"
else
  PLAN_FILE=$(find "$PROJECT_DIR/docs" -name "*.html" -path "*/plans/*" -newer "$PROJECT_DIR/.git/HEAD" 2>/dev/null | sort -r | head -1)
fi

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  exit 0
fi

# Stable state file keyed by project path hash (survives across invocations)
STATE_FILE="/tmp/planboard-mtime-$(echo "$PROJECT_DIR" | md5sum | cut -c1-8 2>/dev/null || md5 -q -s "$PROJECT_DIR")"

CURRENT_MTIME=$(stat -f %m "$PLAN_FILE" 2>/dev/null || stat -c %Y "$PLAN_FILE" 2>/dev/null)

if [ -f "$STATE_FILE" ]; then
  LAST_MTIME=$(cat "$STATE_FILE")
  if [ "$CURRENT_MTIME" != "$LAST_MTIME" ]; then
    echo "PLANBOARD: Plan file was modified externally."
    echo "  File: $PLAN_FILE"
    echo "  Re-read this file for updated task states."
  fi
fi

echo "$CURRENT_MTIME" > "$STATE_FILE"
```

The hook is lightweight — one `stat` call per prompt. Only outputs context when the file actually changed. State file is keyed by project directory hash so it persists across Claude Code invocations.

### 8.3 /sync Command (Manual)

A Claude Code skill or slash command that force-reads the current plan:

```
User types: /sync
→ Claude reads the plan file referenced in CLAUDE.md
→ Reports current state: "Plan has 12 tasks, 5 done, 2 active, 5 pending"
→ Asks if user wants to focus on a specific phase or task
```

### 8.4 Hook Installation

The hook is installed via `planboard init` in a project directory:

```bash
planboard init
# Creates:
#   .planboard-active → points to the current active plan file
#   .claude/settings.json → adds the hook to user-prompt-submit (or appends if exists)
```

Alternatively, users can manually add to their `.claude/settings.json`:

```json
{
  "hooks": {
    "user-prompt-submit": [
      { "command": "~/.config/planboard/hooks/planboard-sync.sh" }
    ]
  }
}
```

The global hook script lives at `~/.config/planboard/hooks/planboard-sync.sh` and is installed once via `planboard install-hook`.

## 9. HTML Generation Skill

A Claude Code skill that generates planboard-compatible HTML files deterministically.

### 9.1 Skill Trigger

The skill is invoked when:
- The `superpowers:writing-plans` skill completes (generates plan HTML)
- The `superpowers:brainstorming` spec is approved (generates spec HTML)
- User explicitly requests: `/planboard-generate`

### 9.2 Generation Rules

1. **Deterministic output** — given identical input (title, phases, tasks), always produces byte-for-byte identical HTML
2. **Sorted attributes** — data attributes appear in alphabetical order
3. **Consistent indentation** — 2 spaces, no tabs
4. **Normalized whitespace** — single newline between sections, no trailing whitespace
5. **UTC dates** — all dates in ISO 8601 format (YYYY-MM-DD)
6. **Sequential IDs** — task IDs are sequential integers starting at 1, per file
7. **Computed fields** — total-tasks, completed-tasks, phase-status are always recomputed on generation

### 9.3 Skill Inputs

The skill accepts structured data:

```
Title: "Feature X Implementation Plan"
Type: plan
Project: trade-station
Phases:
  - name: "Phase 1: Setup"
    tasks:
      - "Initialize project structure"
      - "Configure dependencies"
  - name: "Phase 2: Core"
    tasks:
      - "Implement main logic"
      - "Add error handling"
```

And produces a complete, valid planboard HTML file.

## 10. Markdown Support

### 10.1 Read-Only Rendering

Existing `.md` files in `docs/` directories are:
- Discovered by the scanner (same patterns as HTML)
- Rendered client-side via `marked` with GFM support
- Displayed with syntax highlighting (highlight.js)
- Shown in the same sidebar alongside HTML files
- Distinguished by a file-type badge in the UI

### 10.2 Recognized Frontmatter Keys (.md files)

When a `.md` file has YAML frontmatter, these keys are extracted for the sidebar index:

```yaml
---
title: "News Page Redesign"
date: 2026-03-20
status: in-progress    # pending | in-progress | done
type: plan             # plan | spec
project: trade-station # optional override
---
```

If no frontmatter exists, the file name is used as the title and no status is shown.

### 10.3 Limitations of MD Mode

- No task toggling (markdown checkboxes are not bidirectionally editable via the same mechanism)
- No structured metadata extraction (unless frontmatter is present)
- No live write-back to Claude sessions
- Read-only view in the dashboard

### 10.4 Conversion Tool

Users can convert `.md` files to planboard HTML via:
- Dashboard button: "Convert to interactive format"
- API: `POST /api/convert` with body `{ "path": "/abs/path/to/file.md" }`
- CLI: `planboard convert docs/superpowers/plans/old-plan.md`

The converter:
1. Parses markdown structure (headings, lists, checkboxes)
2. Maps to planboard HTML sections and tasks
3. Preserves all content
4. Writes `.html` file alongside the original `.md` (does not delete the original)
5. Requires user confirmation before writing

## 11. Dashboard Frontend

### 11.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  Planboard                          [Settings] [⟳]  │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Projects    │  Plan Viewer                         │
│  ──────────  │  ─────────────────────────────────   │
│  ▼ trade-    │  [Plan Title]         [Status Badge] │
│    station   │                                      │
│    ├ spec-1  │  Phase 1: Core        [████░░] 4/6   │
│    ├ plan-1  │  ☑ Task 1 - done                     │
│    └ plan-2  │  ☑ Task 2 - done                     │
│              │  ☐ Task 3 - active                   │
│  ▼ outfitter │  ☐ Task 4 - pending                  │
│    ├ spec-1  │                                      │
│    └ plan-1  │  Phase 2: Frontend    [░░░░░░] 0/4   │
│              │  ☐ Task 5 - pending                  │
│  ▼ planboard │  ☐ Task 6 - pending                  │
│    └ plan-1  │                                      │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│  12 projects | 47 files | Last scan: 2s ago         │
└─────────────────────────────────────────────────────┘
```

### 11.2 Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Project tree with expandable file lists, type badges, search |
| `PlanViewer` | Renders interactive HTML plans with task toggles |
| `MarkdownViewer` | Renders .md files with syntax highlighting |
| `TaskList` | Checkbox list with optimistic updates + write-back |
| `StatusBadge` | Colored status indicator (pending/in-progress/done) |
| `ProgressBar` | Phase completion visualization |
| `FileSearch` | Global search across all indexed files |

### 11.3 Interactions

- **Click task checkbox** → optimistic UI update → PATCH to backend → write-back to file
- **Click project in sidebar** → expand file list, show metadata summary
- **Click file** → load and render in main panel
- **Live updates** → WebSocket pushes cause re-render of affected components
- **Convert button** (on .md files) → triggers conversion, adds new HTML file to sidebar

## 12. Error Handling

| Scenario | Behavior |
|----------|----------|
| Config file missing | Create default config with empty roots, prompt user to configure |
| Root directory doesn't exist | Warn in UI, skip that root, continue scanning others |
| File read fails (permissions) | Show error badge on file in sidebar, log warning |
| Write-back fails | Revert optimistic UI update, show toast notification |
| WebSocket disconnects | Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s) |
| fsnotify watcher limit hit | Fall back to polling (5s interval) for overflow directories |
| Malformed HTML (no planboard attributes) | Render as raw HTML in iframe, no interactive features |
| Concurrent write conflict | Last-write-wins (file system semantics), notify via WS |

## 13. Future Roadmap

These are explicitly out of scope for v1 but noted for design consideration:

1. **Inline text editing** — click-to-edit on plan text, writes back to HTML
2. **Section comments** — add annotations/comments to any `data-section`, stored as `<!-- planboard:comment ... -->` in the HTML
3. **`.planboard` marker files** — per-project opt-in for faster scanning
4. **Multi-user** — shared dashboard for team plans (requires conflict resolution)
5. **Plan templates** — pre-built HTML templates for common plan types
6. **Diff view** — show what changed between versions of a plan (git-aware)
7. **Notifications** — desktop notifications when a plan is updated by an AI session
8. **Plan linking** — cross-references between plans/specs across projects

## 14. Security

- Server binds to `127.0.0.1` only (localhost). Not accessible from the network.
- No authentication (single-user local tool). If future multi-user is needed, add auth at that time.
- File paths in API requests are validated against configured roots — the server refuses to read/write files outside known project directories.
- Atomic writes prevent partial file corruption on unexpected termination.

## 15. CLI Commands

| Command | Description |
|---------|-------------|
| `planboard` | Start the dashboard server (reads config, scans, serves UI) |
| `planboard --init` | Create default config at `~/.config/planboard/config.json` |
| `planboard --config <path>` | Use a custom config file |
| `planboard init` | Initialize current project for planboard (creates `.planboard-active`, adds hook) |
| `planboard install-hook` | Install the global sync hook to `~/.config/planboard/hooks/` |
| `planboard convert <file.md>` | Convert a markdown file to planboard HTML format |
| `planboard scan` | Run a one-shot scan and print discovered projects/files (no server) |

## 16. Development Workflow

### 16.1 Development Mode

```bash
make dev
# Starts both:
#   - Go backend on :8080 (with hot-reload via air)
#   - Vite dev server on :5173 (with HMR)
# Frontend proxies /api/* and /ws to Go backend
```

### 16.2 Production Build

```bash
make build
# 1. Builds Preact frontend → frontend/dist/
# 2. Embeds dist/ into Go binary via embed.FS
# 3. Outputs single binary: ./bin/planboard
```

### 16.3 Running

```bash
# Development
make dev

# Production (single binary)
./bin/planboard

# With custom config
./bin/planboard --config ~/.config/planboard/config.json

# First run (creates default config)
./bin/planboard --init
```
