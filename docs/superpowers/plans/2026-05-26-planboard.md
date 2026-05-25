# Planboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local dashboard that aggregates plans/specs from Claude/Codex sessions across projects, with bidirectional task toggling via structured HTML files.

**Architecture:** Go backend (scanner, watcher, file I/O, REST API, WebSocket) + Preact frontend (Vite dev server, sidebar, plan viewer, live updates). Split server in dev, embedded single binary in prod.

**Tech Stack:** Go 1.22+, Preact 10, Vite 5, fsnotify, github.com/coder/websocket, github.com/bmatcuk/doublestar, golang.org/x/net/html, marked, highlight.js

---

## File Structure

```
planboard/
├── cmd/planboard/main.go
├── internal/
│   ├── config/
│   │   ├── config.go
│   │   └── config_test.go
│   ├── scanner/
│   │   ├── scanner.go
│   │   ├── scanner_test.go
│   │   ├── metadata.go
│   │   └── metadata_test.go
│   ├── fileio/
│   │   ├── reader.go
│   │   ├── reader_test.go
│   │   ├── writer.go
│   │   ├── writer_test.go
│   │   ├── converter.go
│   │   └── converter_test.go
│   ├── watcher/
│   │   ├── watcher.go
│   │   └── watcher_test.go
│   └── api/
│       ├── router.go
│       ├── handlers.go
│       ├── handlers_test.go
│       ├── websocket.go
│       └── websocket_test.go
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PlanViewer.tsx
│   │   │   ├── MarkdownViewer.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── FileSearch.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useFileIndex.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       └── types.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── testdata/
│   ├── sample-plan.html
│   ├── sample-spec.html
│   └── sample-plan.md
├── hooks/planboard-sync.sh
├── planboard.config.example.json
├── Makefile
├── go.mod
└── go.sum
```

---

## Task 1: Project Initialization

**Files:**
- Create: `go.mod`
- Create: `cmd/planboard/main.go`
- Create: `Makefile`
- Create: `planboard.config.example.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Go module**

Run: `go mod init github.com/caisergan/planboard`

- [ ] **Step 2: Create main.go stub**

```go
// cmd/planboard/main.go
package main

import (
	"fmt"
	"os"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	fmt.Println("planboard v0.1.0")
	return nil
}
```

- [ ] **Step 3: Create example config**

```json
// planboard.config.example.json
{
  "roots": [
    "~/Desktop/personal-projects"
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

- [ ] **Step 4: Create Makefile**

```makefile
# Makefile
.PHONY: dev build run test clean

dev:
	@echo "Starting backend..."
	@air &
	@echo "Starting frontend..."
	@cd frontend && npm run dev

build:
	@cd frontend && npm run build
	@go build -o bin/planboard ./cmd/planboard

run:
	@go run ./cmd/planboard

test:
	@go test ./... -v

clean:
	@rm -rf bin/ frontend/dist/
```

- [ ] **Step 5: Create .gitignore**

```
bin/
frontend/dist/
frontend/node_modules/
.superpowers/
tmp/
```

- [ ] **Step 6: Verify build compiles**

Run: `go build ./cmd/planboard`
Expected: No errors, binary produced

- [ ] **Step 7: Commit**

```bash
git add go.mod cmd/ Makefile planboard.config.example.json .gitignore
git commit -m "feat: initialize planboard project structure"
```

---

## Task 2: Config Module

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/config/config_test.go`

- [ ] **Step 1: Write failing test for config loading**

```go
// internal/config/config_test.go
package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	content := []byte(`{
		"roots": ["~/projects", "/absolute/path"],
		"scan_patterns": ["docs/**/*.html", "docs/**/*.md"],
		"exclude_patterns": ["node_modules", ".git"],
		"server": {"port": 8080, "frontend_port": 5173},
		"watch": {"debounce_ms": 100}
	}`)
	os.WriteFile(cfgPath, content, 0644)

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want 8080", cfg.Server.Port)
	}
	if len(cfg.Roots) != 2 {
		t.Errorf("len(Roots) = %d, want 2", len(cfg.Roots))
	}
}

func TestExpandTilde(t *testing.T) {
	home, _ := os.UserHomeDir()
	result := expandTilde("~/projects")
	expected := filepath.Join(home, "projects")
	if result != expected {
		t.Errorf("expandTilde(~/projects) = %q, want %q", result, expected)
	}
}

func TestLoadConfig_ExpandsRoots(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	content := []byte(`{
		"roots": ["~/projects"],
		"scan_patterns": ["docs/**/*.html"],
		"exclude_patterns": [],
		"server": {"port": 8080, "frontend_port": 5173},
		"watch": {"debounce_ms": 100}
	}`)
	os.WriteFile(cfgPath, content, 0644)

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, "projects")
	if cfg.Roots[0] != expected {
		t.Errorf("Roots[0] = %q, want %q", cfg.Roots[0], expected)
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := Default()
	if cfg.Server.Port != 8080 {
		t.Errorf("Default().Server.Port = %d, want 8080", cfg.Server.Port)
	}
	if cfg.Watch.DebounceMs != 100 {
		t.Errorf("Default().Watch.DebounceMs = %d, want 100", cfg.Watch.DebounceMs)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/config/ -v`
Expected: FAIL — package doesn't exist yet

- [ ] **Step 3: Implement config module**

```go
// internal/config/config.go
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Roots           []string      `json:"roots"`
	ScanPatterns    []string      `json:"scan_patterns"`
	ExcludePatterns []string      `json:"exclude_patterns"`
	Server          ServerConfig  `json:"server"`
	Watch           WatchConfig   `json:"watch"`
}

type ServerConfig struct {
	Port         int `json:"port"`
	FrontendPort int `json:"frontend_port"`
}

type WatchConfig struct {
	DebounceMs int `json:"debounce_ms"`
}

func Default() *Config {
	return &Config{
		Roots:           []string{},
		ScanPatterns:    []string{"docs/**/*.html", "docs/**/*.md"},
		ExcludePatterns: []string{"node_modules", ".git", "vendor"},
		Server:          ServerConfig{Port: 8080, FrontendPort: 5173},
		Watch:           WatchConfig{DebounceMs: 100},
	}
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	for i, root := range cfg.Roots {
		cfg.Roots[i] = expandTilde(root)
	}

	return &cfg, nil
}

func (c *Config) Save(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

func ConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "planboard", "config.json")
}

func expandTilde(path string) string {
	if !strings.HasPrefix(path, "~") {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	return filepath.Join(home, path[2:])
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/config/ -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/config/
git commit -m "feat: add config loading with tilde expansion"
```

---

## Task 3: Test Data Fixtures

**Files:**
- Create: `testdata/sample-plan.html`
- Create: `testdata/sample-spec.html`
- Create: `testdata/sample-plan.md`

- [ ] **Step 1: Create sample plan HTML**

```html
<!DOCTYPE html>
<html lang="en" data-planboard-version="1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Plan</title>
  <meta name="planboard:type" content="plan">
  <meta name="planboard:project" content="test-project">
  <meta name="planboard:created" content="2026-05-20">
  <meta name="planboard:status" content="in-progress">
  <meta name="planboard:total-tasks" content="4">
  <meta name="planboard:completed-tasks" content="2">
  <style>
    :root { --bg: #0f172a; --text: #e2e8f0; --accent: #818cf8; --success: #4ade80; --warning: #fbbf24; --muted: #64748b; }
    body { font-family: system-ui; background: var(--bg); color: var(--text); max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: var(--accent); }
    [data-task-status="done"] { text-decoration: line-through; color: var(--muted); }
    [data-task-status="active"] { color: var(--warning); }
  </style>
</head>
<body>
  <header data-section="header">
    <h1>Sample Plan</h1>
    <p class="meta">Project: test-project | Created: 2026-05-20 | Status: in-progress</p>
  </header>
  <section data-section="overview">
    <h2>Overview</h2>
    <p>A sample plan for testing purposes.</p>
  </section>
  <section data-section="phases">
    <h2>Phases</h2>
    <div data-phase="1" data-phase-status="in-progress">
      <h3>Phase 1: Setup</h3>
      <ul data-task-list>
        <li data-task-id="1" data-task-status="done">Initialize project</li>
        <li data-task-id="2" data-task-status="done">Add dependencies</li>
        <li data-task-id="3" data-task-status="active">Write tests</li>
        <li data-task-id="4" data-task-status="pending">Implement feature</li>
      </ul>
    </div>
  </section>
  <section data-section="notes">
    <h2>Notes</h2>
    <ul>
      <li>This is a test fixture</li>
    </ul>
  </section>
</body>
</html>
```

- [ ] **Step 2: Create sample spec HTML**

```html
<!DOCTYPE html>
<html lang="en" data-planboard-version="1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Spec</title>
  <meta name="planboard:type" content="spec">
  <meta name="planboard:project" content="test-project">
  <meta name="planboard:created" content="2026-05-18">
  <meta name="planboard:status" content="done">
  <meta name="planboard:total-tasks" content="0">
  <meta name="planboard:completed-tasks" content="0">
  <style>
    :root { --bg: #0f172a; --text: #e2e8f0; --accent: #818cf8; }
    body { font-family: system-ui; background: var(--bg); color: var(--text); max-width: 800px; margin: 0 auto; padding: 2rem; }
  </style>
</head>
<body>
  <header data-section="header">
    <h1>Sample Spec</h1>
    <p class="meta">Project: test-project | Created: 2026-05-18 | Status: done</p>
  </header>
  <section data-section="overview">
    <h2>Overview</h2>
    <p>A design spec for testing.</p>
  </section>
  <section data-section="decisions">
    <h2>Decisions</h2>
    <p>We decided to use Go.</p>
  </section>
</body>
</html>
```

- [ ] **Step 3: Create sample markdown plan**

```markdown
---
title: Legacy Plan
date: 2026-05-15
status: in-progress
type: plan
project: test-project
---

# Legacy Plan

## Overview

This is a markdown plan that predates planboard.

## Tasks

- [x] Set up repo
- [x] Write initial code
- [ ] Add tests
- [ ] Deploy
```

- [ ] **Step 4: Commit**

```bash
git add testdata/
git commit -m "feat: add test data fixtures for HTML and MD plans"
```

---

## Task 4: HTML Metadata Extraction

**Files:**
- Create: `internal/scanner/metadata.go`
- Create: `internal/scanner/metadata_test.go`

- [ ] **Step 1: Write failing test for HTML metadata extraction**

```go
// internal/scanner/metadata_test.go
package scanner

import (
	"path/filepath"
	"runtime"
	"testing"
)

func testdataPath(name string) string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "..", "testdata", name)
}

func TestExtractHTMLMetadata(t *testing.T) {
	meta, err := ExtractHTMLMetadata(testdataPath("sample-plan.html"))
	if err != nil {
		t.Fatalf("ExtractHTMLMetadata() error: %v", err)
	}

	if meta.Type != "plan" {
		t.Errorf("Type = %q, want %q", meta.Type, "plan")
	}
	if meta.Project != "test-project" {
		t.Errorf("Project = %q, want %q", meta.Project, "test-project")
	}
	if meta.Created != "2026-05-20" {
		t.Errorf("Created = %q, want %q", meta.Created, "2026-05-20")
	}
	if meta.Status != "in-progress" {
		t.Errorf("Status = %q, want %q", meta.Status, "in-progress")
	}
	if meta.TotalTasks != 4 {
		t.Errorf("TotalTasks = %d, want 4", meta.TotalTasks)
	}
	if meta.CompletedTasks != 2 {
		t.Errorf("CompletedTasks = %d, want 2", meta.CompletedTasks)
	}
	if meta.Version != 1 {
		t.Errorf("Version = %d, want 1", meta.Version)
	}
	if meta.Title != "Sample Plan" {
		t.Errorf("Title = %q, want %q", meta.Title, "Sample Plan")
	}
}

func TestExtractMDMetadata(t *testing.T) {
	meta, err := ExtractMDMetadata(testdataPath("sample-plan.md"))
	if err != nil {
		t.Fatalf("ExtractMDMetadata() error: %v", err)
	}

	if meta.Title != "Legacy Plan" {
		t.Errorf("Title = %q, want %q", meta.Title, "Legacy Plan")
	}
	if meta.Type != "plan" {
		t.Errorf("Type = %q, want %q", meta.Type, "plan")
	}
	if meta.Project != "test-project" {
		t.Errorf("Project = %q, want %q", meta.Project, "test-project")
	}
	if meta.Status != "in-progress" {
		t.Errorf("Status = %q, want %q", meta.Status, "in-progress")
	}
}

func TestExtractMDMetadata_NoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "no-frontmatter.md")
	os.WriteFile(path, []byte("# Just a Title\n\nSome content."), 0644)

	meta, err := ExtractMDMetadata(path)
	if err != nil {
		t.Fatalf("ExtractMDMetadata() error: %v", err)
	}

	if meta.Title != "no-frontmatter" {
		t.Errorf("Title = %q, want %q", meta.Title, "no-frontmatter")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/scanner/ -v`
Expected: FAIL — package doesn't exist

- [ ] **Step 3: Implement metadata extraction**

```go
// internal/scanner/metadata.go
package scanner

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

type FileMetadata struct {
	Title          string `json:"title"`
	Type           string `json:"type"`
	Project        string `json:"project"`
	Created        string `json:"created"`
	Status         string `json:"status"`
	TotalTasks     int    `json:"total_tasks"`
	CompletedTasks int    `json:"completed_tasks"`
	Version        int    `json:"version"`
	Path           string `json:"path"`
	Format         string `json:"format"`
}

func ExtractHTMLMetadata(path string) (*FileMetadata, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	meta := &FileMetadata{
		Path:   path,
		Format: "html",
	}

	tokenizer := html.NewTokenizer(f)
	inHead := false

	for {
		tt := tokenizer.Next()
		switch tt {
		case html.ErrorToken:
			return meta, nil
		case html.StartTagToken, html.SelfClosingTagToken:
			tn, hasAttr := tokenizer.TagName()
			tagName := string(tn)

			if tagName == "head" {
				inHead = true
				continue
			}
			if tagName == "html" && hasAttr {
				for {
					key, val, more := tokenizer.TagAttr()
					if string(key) == "data-planboard-version" {
						meta.Version, _ = strconv.Atoi(string(val))
					}
					if !more {
						break
					}
				}
				continue
			}
			if tagName == "title" && inHead {
				tokenizer.Next()
				meta.Title = strings.TrimSpace(tokenizer.Token().Data)
				continue
			}
			if tagName == "meta" && inHead && hasAttr {
				var name, content string
				for {
					key, val, more := tokenizer.TagAttr()
					switch string(key) {
					case "name":
						name = string(val)
					case "content":
						content = string(val)
					}
					if !more {
						break
					}
				}
				if strings.HasPrefix(name, "planboard:") {
					field := strings.TrimPrefix(name, "planboard:")
					switch field {
					case "type":
						meta.Type = content
					case "project":
						meta.Project = content
					case "created":
						meta.Created = content
					case "status":
						meta.Status = content
					case "total-tasks":
						meta.TotalTasks, _ = strconv.Atoi(content)
					case "completed-tasks":
						meta.CompletedTasks, _ = strconv.Atoi(content)
					}
				}
				continue
			}
		case html.EndTagToken:
			tn, _ := tokenizer.TagName()
			if string(tn) == "head" {
				return meta, nil
			}
		}
	}
}

func ExtractMDMetadata(path string) (*FileMetadata, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	meta := &FileMetadata{
		Path:   path,
		Format: "md",
		Title:  strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
	}

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return meta, nil
	}

	if strings.TrimSpace(scanner.Text()) != "---" {
		return meta, nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "---" {
			break
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch key {
		case "title":
			meta.Title = val
		case "type":
			meta.Type = val
		case "project":
			meta.Project = val
		case "status":
			meta.Status = val
		case "date":
			meta.Created = val
		}
	}

	return meta, nil
}
```

- [ ] **Step 4: Add missing import and run tests**

Run: `go get golang.org/x/net/html && go test ./internal/scanner/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/scanner/ go.sum
git commit -m "feat: add HTML and markdown metadata extraction"
```

---

## Task 5: Directory Scanner

**Files:**
- Create: `internal/scanner/scanner.go`
- Create: `internal/scanner/scanner_test.go`

- [ ] **Step 1: Write failing test for directory scanning**

```go
// internal/scanner/scanner_test.go
package scanner

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanRoots(t *testing.T) {
	root := t.TempDir()

	// Create project structure: root/project-a/docs/superpowers/plans/plan.html
	planDir := filepath.Join(root, "project-a", "docs", "superpowers", "plans")
	os.MkdirAll(planDir, 0755)

	planContent, _ := os.ReadFile(testdataPath("sample-plan.html"))
	os.WriteFile(filepath.Join(planDir, "2026-05-20-setup.html"), planContent, 0644)

	// Create MD file: root/project-a/docs/superpowers/specs/spec.md
	specDir := filepath.Join(root, "project-a", "docs", "superpowers", "specs")
	os.MkdirAll(specDir, 0755)

	mdContent, _ := os.ReadFile(testdataPath("sample-plan.md"))
	os.WriteFile(filepath.Join(specDir, "design.md"), mdContent, 0644)

	// Create excluded dir: root/project-a/node_modules/docs/plan.html
	excludedDir := filepath.Join(root, "project-a", "node_modules", "docs")
	os.MkdirAll(excludedDir, 0755)
	os.WriteFile(filepath.Join(excludedDir, "plan.html"), planContent, 0644)

	s := New([]string{root}, []string{"docs/**/*.html", "docs/**/*.md"}, []string{"node_modules", ".git"})
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	files, ok := index["project-a"]
	if !ok {
		t.Fatalf("project 'project-a' not found in index")
	}

	if len(files) != 2 {
		t.Errorf("len(files) = %d, want 2 (got: %v)", len(files), files)
	}
}

func TestScanRoots_MultipleProjects(t *testing.T) {
	root := t.TempDir()

	for _, proj := range []string{"alpha", "beta"} {
		dir := filepath.Join(root, proj, "docs")
		os.MkdirAll(dir, 0755)
		os.WriteFile(filepath.Join(dir, "plan.html"), []byte(`<!DOCTYPE html>
<html lang="en" data-planboard-version="1">
<head><title>Plan</title><meta name="planboard:type" content="plan"></head>
<body></body></html>`), 0644)
	}

	s := New([]string{root}, []string{"docs/**/*.html"}, []string{})
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if len(index) != 2 {
		t.Errorf("len(index) = %d, want 2", len(index))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/scanner/ -v -run TestScan`
Expected: FAIL — `New` and `Scan` not defined

- [ ] **Step 3: Implement scanner**

```go
// internal/scanner/scanner.go
package scanner

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

type Scanner struct {
	roots           []string
	scanPatterns    []string
	excludePatterns []string
}

type ProjectIndex map[string][]*FileMetadata

func New(roots, scanPatterns, excludePatterns []string) *Scanner {
	return &Scanner{
		roots:           roots,
		scanPatterns:    scanPatterns,
		excludePatterns: excludePatterns,
	}
}

func (s *Scanner) Scan() (ProjectIndex, error) {
	index := make(ProjectIndex)

	for _, root := range s.roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			projectName := entry.Name()
			projectPath := filepath.Join(root, projectName)
			files, err := s.scanProject(projectPath)
			if err != nil {
				continue
			}

			if len(files) > 0 {
				index[projectName] = files
			}
		}
	}

	return index, nil
}

func (s *Scanner) scanProject(projectPath string) ([]*FileMetadata, error) {
	var files []*FileMetadata

	for _, pattern := range s.scanPatterns {
		fullPattern := filepath.Join(projectPath, pattern)
		matches, err := doublestar.FilepathGlob(fullPattern)
		if err != nil {
			continue
		}

		for _, match := range matches {
			if s.isExcluded(match) {
				continue
			}

			var meta *FileMetadata
			var err error

			switch filepath.Ext(match) {
			case ".html":
				meta, err = ExtractHTMLMetadata(match)
			case ".md":
				meta, err = ExtractMDMetadata(match)
			default:
				continue
			}

			if err != nil {
				continue
			}

			meta.Path = match
			files = append(files, meta)
		}
	}

	return files, nil
}

func (s *Scanner) isExcluded(path string) bool {
	for _, pattern := range s.excludePatterns {
		if strings.Contains(path, string(filepath.Separator)+pattern+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

func (s *Scanner) WatchDirs() ([]string, error) {
	var dirs []string
	seen := make(map[string]bool)

	for _, root := range s.roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			projectPath := filepath.Join(root, entry.Name())
			filepath.WalkDir(projectPath, func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return nil
				}
				if !d.IsDir() {
					return nil
				}
				if s.isExcluded(path) {
					return filepath.SkipDir
				}
				if filepath.Base(path) == "docs" || strings.Contains(path, "docs"+string(filepath.Separator)) {
					if !seen[path] {
						dirs = append(dirs, path)
						seen[path] = true
					}
				}
				return nil
			})
		}
	}

	return dirs, nil
}
```

- [ ] **Step 4: Get dependency and run tests**

Run: `go get github.com/bmatcuk/doublestar/v4 && go test ./internal/scanner/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/scanner/ go.mod go.sum
git commit -m "feat: add directory scanner with glob matching and exclusions"
```

---

## Task 6: File I/O Reader

**Files:**
- Create: `internal/fileio/reader.go`
- Create: `internal/fileio/reader_test.go`

- [ ] **Step 1: Write failing test**

```go
// internal/fileio/reader_test.go
package fileio

import (
	"path/filepath"
	"runtime"
	"testing"
)

func testdataPath(name string) string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "..", "testdata", name)
}

func TestReadFile_HTML(t *testing.T) {
	result, err := ReadFile(testdataPath("sample-plan.html"))
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}

	if result.Format != "html" {
		t.Errorf("Format = %q, want %q", result.Format, "html")
	}
	if result.Metadata.TotalTasks != 4 {
		t.Errorf("TotalTasks = %d, want 4", result.Metadata.TotalTasks)
	}
	if len(result.Content) == 0 {
		t.Error("Content is empty")
	}
}

func TestReadFile_MD(t *testing.T) {
	result, err := ReadFile(testdataPath("sample-plan.md"))
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}

	if result.Format != "md" {
		t.Errorf("Format = %q, want %q", result.Format, "md")
	}
	if result.Metadata.Title != "Legacy Plan" {
		t.Errorf("Title = %q, want %q", result.Metadata.Title, "Legacy Plan")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/fileio/ -v`
Expected: FAIL — package doesn't exist

- [ ] **Step 3: Implement reader**

```go
// internal/fileio/reader.go
package fileio

import (
	"os"
	"path/filepath"

	"github.com/caisergan/planboard/internal/scanner"
)

type FileResult struct {
	Content  string                `json:"content"`
	Format   string                `json:"format"`
	Metadata *scanner.FileMetadata `json:"metadata"`
}

func ReadFile(path string) (*FileResult, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	ext := filepath.Ext(path)
	format := "html"
	if ext == ".md" {
		format = "md"
	}

	var meta *scanner.FileMetadata
	switch format {
	case "html":
		meta, err = scanner.ExtractHTMLMetadata(path)
	case "md":
		meta, err = scanner.ExtractMDMetadata(path)
	}
	if err != nil {
		return nil, err
	}

	return &FileResult{
		Content:  string(content),
		Format:   format,
		Metadata: meta,
	}, nil
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./internal/fileio/ -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/fileio/
git commit -m "feat: add file reader for HTML and markdown"
```

---

## Task 7: File I/O Writer (Task Toggle)

**Files:**
- Create: `internal/fileio/writer.go`
- Create: `internal/fileio/writer_test.go`

- [ ] **Step 1: Write failing test for task toggle**

```go
// internal/fileio/writer_test.go
package fileio

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/caisergan/planboard/internal/scanner"
)

func TestToggleTask(t *testing.T) {
	dir := t.TempDir()
	src := testdataPath("sample-plan.html")
	dst := filepath.Join(dir, "plan.html")

	content, _ := os.ReadFile(src)
	os.WriteFile(dst, content, 0644)

	err := ToggleTask(dst, "3", "done")
	if err != nil {
		t.Fatalf("ToggleTask() error: %v", err)
	}

	updated, _ := os.ReadFile(dst)
	if !strings.Contains(string(updated), `data-task-id="3" data-task-status="done"`) {
		t.Error("task 3 not updated to done")
	}

	meta, _ := scanner.ExtractHTMLMetadata(dst)
	if meta.CompletedTasks != 3 {
		t.Errorf("CompletedTasks = %d, want 3", meta.CompletedTasks)
	}
}

func TestToggleTask_DoneToPending(t *testing.T) {
	dir := t.TempDir()
	src := testdataPath("sample-plan.html")
	dst := filepath.Join(dir, "plan.html")

	content, _ := os.ReadFile(src)
	os.WriteFile(dst, content, 0644)

	err := ToggleTask(dst, "1", "pending")
	if err != nil {
		t.Fatalf("ToggleTask() error: %v", err)
	}

	updated, _ := os.ReadFile(dst)
	if !strings.Contains(string(updated), `data-task-id="1" data-task-status="pending"`) {
		t.Error("task 1 not updated to pending")
	}

	meta, _ := scanner.ExtractHTMLMetadata(dst)
	if meta.CompletedTasks != 1 {
		t.Errorf("CompletedTasks = %d, want 1", meta.CompletedTasks)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/fileio/ -v -run TestToggle`
Expected: FAIL — `ToggleTask` not defined

- [ ] **Step 3: Implement writer with atomic write**

```go
// internal/fileio/writer.go
package fileio

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	selfWrites   sync.Map
	taskLineRe   = regexp.MustCompile(`(<li\s+data-task-id="(\d+)"\s+data-task-status=")([^"]+)(")`)
	metaCountRe  = regexp.MustCompile(`(<meta\s+name="planboard:(completed-tasks|total-tasks)"\s+content=")(\d+)(")`)
	phaseStatusRe = regexp.MustCompile(`(<div\s+data-phase="\d+"\s+data-phase-status=")([^"]+)(")`)
)

func ToggleTask(path, taskID, newStatus string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	html := string(content)

	targetPattern := fmt.Sprintf(`data-task-id="%s" data-task-status="`, taskID)
	if !strings.Contains(html, targetPattern) {
		return fmt.Errorf("task %s not found in %s", taskID, path)
	}

	html = taskLineRe.ReplaceAllStringFunc(html, func(match string) string {
		groups := taskLineRe.FindStringSubmatch(match)
		if groups[2] == taskID {
			return groups[1] + newStatus + groups[4]
		}
		return match
	})

	html = recomputeMetaCounts(html)
	html = recomputePhaseStatuses(html)

	return atomicWrite(path, []byte(html))
}

func recomputeMetaCounts(html string) string {
	total := strings.Count(html, "data-task-id=")
	completed := strings.Count(html, `data-task-status="done"`)
	active := strings.Count(html, `data-task-status="active"`)

	html = metaCountRe.ReplaceAllStringFunc(html, func(match string) string {
		groups := metaCountRe.FindStringSubmatch(match)
		switch groups[2] {
		case "total-tasks":
			return groups[1] + strconv.Itoa(total) + groups[4]
		case "completed-tasks":
			return groups[1] + strconv.Itoa(completed) + groups[4]
		}
		return match
	})

	// Recompute planboard:status
	var newStatus string
	switch {
	case total > 0 && completed == total:
		newStatus = "done"
	case completed > 0 || active > 0:
		newStatus = "in-progress"
	default:
		newStatus = "pending"
	}

	statusRe := regexp.MustCompile(`(<meta\s+name="planboard:status"\s+content=")([^"]+)(")`)
	html = statusRe.ReplaceAllString(html, "${1}"+newStatus+"${3}")

	return html
}

func recomputePhaseStatuses(html string) string {
	phaseBlockRe := regexp.MustCompile(`(?s)(<div\s+data-phase="\d+"\s+data-phase-status=")([^"]+)(".*?</div>)`)

	html = phaseBlockRe.ReplaceAllStringFunc(html, func(match string) string {
		taskCount := strings.Count(match, "data-task-id=")
		doneCount := strings.Count(match, `data-task-status="done"`)
		activeCount := strings.Count(match, `data-task-status="active"`)

		var status string
		switch {
		case taskCount == 0:
			status = "pending"
		case doneCount == taskCount:
			status = "done"
		case doneCount > 0 || activeCount > 0:
			status = "in-progress"
		default:
			status = "pending"
		}

		groups := phaseBlockRe.FindStringSubmatch(match)
		return groups[1] + status + groups[3]
	})

	return html
}

func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".planboard-tmp-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	selfWrites.Store(path, time.Now())
	return nil
}

func IsSelfWrite(path string) bool {
	val, ok := selfWrites.Load(path)
	if !ok {
		return false
	}
	writeTime := val.(time.Time)
	if time.Since(writeTime) < 500*time.Millisecond {
		return true
	}
	selfWrites.Delete(path)
	return false
}

func CleanSelfWrites() {
	selfWrites.Range(func(key, val any) bool {
		writeTime := val.(time.Time)
		if time.Since(writeTime) > 5*time.Second {
			selfWrites.Delete(key)
		}
		return true
	})
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./internal/fileio/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/fileio/
git commit -m "feat: add task toggle writer with atomic writes and self-write tracking"
```

---

## Task 8: File Watcher

**Files:**
- Create: `internal/watcher/watcher.go`
- Create: `internal/watcher/watcher_test.go`

- [ ] **Step 1: Write failing test**

```go
// internal/watcher/watcher_test.go
package watcher

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWatcher_DetectsFileChange(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "plan.html")
	os.WriteFile(path, []byte("initial"), 0644)

	events := make(chan Event, 10)
	w, err := New([]string{dir}, 50*time.Millisecond, events)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Close()

	go w.Start()
	time.Sleep(100 * time.Millisecond)

	os.WriteFile(path, []byte("modified"), 0644)

	select {
	case ev := <-events:
		if ev.Type != FileChanged {
			t.Errorf("Type = %v, want FileChanged", ev.Type)
		}
		if ev.Path != path {
			t.Errorf("Path = %q, want %q", ev.Path, path)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for event")
	}
}

func TestWatcher_DetectsNewFile(t *testing.T) {
	dir := t.TempDir()

	events := make(chan Event, 10)
	w, err := New([]string{dir}, 50*time.Millisecond, events)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Close()

	go w.Start()
	time.Sleep(100 * time.Millisecond)

	newFile := filepath.Join(dir, "new-plan.html")
	os.WriteFile(newFile, []byte("new content"), 0644)

	select {
	case ev := <-events:
		if ev.Type != FileAdded {
			t.Errorf("Type = %v, want FileAdded", ev.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for event")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/watcher/ -v`
Expected: FAIL — package doesn't exist

- [ ] **Step 3: Implement watcher**

```go
// internal/watcher/watcher.go
package watcher

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/caisergan/planboard/internal/fileio"
	"github.com/fsnotify/fsnotify"
)

type EventType int

const (
	FileChanged EventType = iota
	FileAdded
	FileDeleted
)

type Event struct {
	Type    EventType `json:"type"`
	Path    string    `json:"path"`
	Project string    `json:"project"`
}

type Watcher struct {
	fsw      *fsnotify.Watcher
	debounce time.Duration
	events   chan<- Event
	pending  map[string]*time.Timer
	mu       sync.Mutex
	done     chan struct{}
}

func New(dirs []string, debounce time.Duration, events chan<- Event) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	for _, dir := range dirs {
		if err := fsw.Add(dir); err != nil {
			fsw.Close()
			return nil, err
		}
	}

	return &Watcher{
		fsw:      fsw,
		debounce: debounce,
		events:   events,
		pending:  make(map[string]*time.Timer),
		done:     make(chan struct{}),
	}, nil
}

func (w *Watcher) Start() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case <-ticker.C:
			fileio.CleanSelfWrites()
		case <-w.done:
			return
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	ext := filepath.Ext(event.Name)
	if ext != ".html" && ext != ".md" {
		return
	}

	if fileio.IsSelfWrite(event.Name) {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if timer, exists := w.pending[event.Name]; exists {
		timer.Stop()
	}

	w.pending[event.Name] = time.AfterFunc(w.debounce, func() {
		w.mu.Lock()
		delete(w.pending, event.Name)
		w.mu.Unlock()

		var evType EventType
		switch {
		case event.Op&fsnotify.Create != 0:
			evType = FileAdded
		case event.Op&fsnotify.Remove != 0:
			evType = FileDeleted
		default:
			evType = FileChanged
		}

		w.events <- Event{
			Type: evType,
			Path: event.Name,
		}
	})
}

func (w *Watcher) AddDir(dir string) error {
	return w.fsw.Add(dir)
}

func (w *Watcher) Close() {
	close(w.done)
	w.fsw.Close()
}
```

- [ ] **Step 4: Get dependency and run tests**

Run: `go get github.com/fsnotify/fsnotify && go test ./internal/watcher/ -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/watcher/ go.mod go.sum
git commit -m "feat: add file watcher with debouncing and self-write suppression"
```

---

## Task 9: REST API

**Files:**
- Create: `internal/api/router.go`
- Create: `internal/api/handlers.go`
- Create: `internal/api/handlers_test.go`

- [ ] **Step 1: Write failing test for API handlers**

```go
// internal/api/handlers_test.go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/caisergan/planboard/internal/scanner"
)

func testdataPath(name string) string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "..", "testdata", name)
}

func TestHealthHandler(t *testing.T) {
	srv := NewServer(nil, nil)
	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestProjectsHandler(t *testing.T) {
	index := scanner.ProjectIndex{
		"project-a": []*scanner.FileMetadata{
			{Title: "Plan A", Type: "plan", Format: "html"},
		},
		"project-b": []*scanner.FileMetadata{
			{Title: "Spec B", Type: "spec", Format: "html"},
			{Title: "Plan B", Type: "plan", Format: "md"},
		},
	}

	srv := NewServer(index, nil)
	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var result []ProjectSummary
	json.NewDecoder(w.Body).Decode(&result)

	if len(result) != 2 {
		t.Errorf("len(projects) = %d, want 2", len(result))
	}
}

func TestFilesHandler(t *testing.T) {
	path := testdataPath("sample-plan.html")
	srv := NewServer(nil, nil)

	req := httptest.NewRequest("GET", "/api/files?path="+path, nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)

	if result["format"] != "html" {
		t.Errorf("format = %v, want html", result["format"])
	}
}

func TestTaskToggleHandler(t *testing.T) {
	dir := t.TempDir()
	src := testdataPath("sample-plan.html")
	dst := filepath.Join(dir, "plan.html")
	content, _ := os.ReadFile(src)
	os.WriteFile(dst, content, 0644)

	srv := NewServer(nil, nil)
	body := `{"path":"` + dst + `","taskId":"3","status":"done"}`
	req := httptest.NewRequest("PATCH", "/api/files/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	updated, _ := os.ReadFile(dst)
	if !strings.Contains(string(updated), `data-task-id="3" data-task-status="done"`) {
		t.Error("task 3 was not toggled")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/api/ -v`
Expected: FAIL

- [ ] **Step 3: Implement router and handlers**

```go
// internal/api/router.go
package api

import (
	"net/http"
	"sync"

	"github.com/caisergan/planboard/internal/config"
	"github.com/caisergan/planboard/internal/scanner"
)

type Server struct {
	index scanner.ProjectIndex
	cfg   *config.Config
	mu    sync.RWMutex
}

type ProjectSummary struct {
	Name      string `json:"name"`
	FileCount int    `json:"file_count"`
}

func NewServer(index scanner.ProjectIndex, cfg *config.Config) *Server {
	return &Server{
		index: index,
		cfg:   cfg,
	}
}

func (s *Server) UpdateIndex(index scanner.ProjectIndex) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.index = index
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/projects", s.handleProjects)
	mux.HandleFunc("GET /api/projects/{name}/files", s.handleProjectFiles)
	mux.HandleFunc("GET /api/files", s.handleReadFile)
	mux.HandleFunc("PATCH /api/files/tasks", s.handleToggleTask)
	mux.HandleFunc("POST /api/convert", s.handleConvert)
	mux.HandleFunc("GET /api/config", s.handleGetConfig)
	mux.HandleFunc("PUT /api/config", s.handleUpdateConfig)

	return corsMiddleware(mux)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

```go
// internal/api/handlers.go
package api

import (
	"encoding/json"
	"net/http"
	"sort"

	"github.com/caisergan/planboard/internal/fileio"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var projects []ProjectSummary
	for name, files := range s.index {
		projects = append(projects, ProjectSummary{
			Name:      name,
			FileCount: len(files),
		})
	}

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Name < projects[j].Name
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (s *Server) handleProjectFiles(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	s.mu.RLock()
	files, ok := s.index[name]
	s.mu.RUnlock()

	if !ok {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (s *Server) handleReadFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path parameter required", http.StatusBadRequest)
		return
	}

	if !s.isPathAllowed(path) {
		http.Error(w, "path outside configured roots", http.StatusForbidden)
		return
	}

	result, err := fileio.ReadFile(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) isPathAllowed(path string) bool {
	if s.cfg == nil {
		return true
	}
	for _, root := range s.cfg.Roots {
		if strings.HasPrefix(path, root) {
			return true
		}
	}
	return false
}

type ToggleRequest struct {
	Path   string `json:"path"`
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}

func (s *Server) handleToggleTask(w http.ResponseWriter, r *http.Request) {
	var req ToggleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := fileio.ToggleTask(req.Path, req.TaskID, req.Status); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := fileio.ReadFile(req.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result.Metadata)
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.cfg)
}

func (s *Server) handleConvert(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if !s.isPathAllowed(req.Path) {
		http.Error(w, "path outside configured roots", http.StatusForbidden)
		return
	}

	htmlPath := strings.TrimSuffix(req.Path, filepath.Ext(req.Path)) + ".html"
	if err := fileio.ConvertMDToHTML(req.Path, htmlPath); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, _ := fileio.ReadFile(htmlPath)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./internal/api/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/api/
git commit -m "feat: add REST API with project listing, file reading, and task toggle"
```

---

## Task 10: WebSocket Server

**Files:**
- Create: `internal/api/websocket.go`
- Create: `internal/api/websocket_test.go`

- [ ] **Step 1: Write failing test**

```go
// internal/api/websocket_test.go
package api

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestWebSocket_ReceivesBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	srv := NewServer(nil, nil)
	srv.hub = hub

	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	wsURL := "ws" + ts.URL[4:] + "/ws"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() error: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	time.Sleep(100 * time.Millisecond)

	hub.Broadcast(WSEvent{Type: "file-changed", Path: "/test/file.html", Project: "test"})

	_, msg, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Read() error: %v", err)
	}

	var event WSEvent
	json.Unmarshal(msg, &event)

	if event.Type != "file-changed" {
		t.Errorf("Type = %q, want %q", event.Type, "file-changed")
	}
	if event.Path != "/test/file.html" {
		t.Errorf("Path = %q, want %q", event.Path, "/test/file.html")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/api/ -v -run TestWebSocket`
Expected: FAIL — `Hub`, `WSEvent` not defined

- [ ] **Step 3: Implement WebSocket hub**

```go
// internal/api/websocket.go
package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
)

type WSEvent struct {
	Type    string      `json:"type"`
	Path    string      `json:"path,omitempty"`
	Project string      `json:"project,omitempty"`
	Meta    interface{} `json:"metadata,omitempty"`
}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*client]bool
	broadcast  chan []byte
	register   chan *client
	unregister chan *client
	mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *client),
		unregister: make(chan *client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()
		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			h.mu.Unlock()
		case msg := <-h.broadcast:
			h.mu.Lock()
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					delete(h.clients, c)
					close(c.send)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) Broadcast(event WSEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.broadcast <- data
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		log.Printf("websocket accept error: %v", err)
		return
	}

	c := &client{
		conn: conn,
		send: make(chan []byte, 256),
	}

	s.hub.register <- c

	go s.wsWriter(c)
	s.wsReader(c)
}

func (s *Server) wsWriter(c *client) {
	defer c.conn.Close(websocket.StatusNormalClosure, "")

	for msg := range c.send {
		ctx := context.Background()
		if err := c.conn.Write(ctx, websocket.MessageText, msg); err != nil {
			return
		}
	}
}

func (s *Server) wsReader(c *client) {
	defer func() {
		s.hub.unregister <- c
	}()

	for {
		_, _, err := c.conn.Read(context.Background())
		if err != nil {
			return
		}
	}
}
```

- [ ] **Step 4: Add WS route to Handler() and hub field to Server**

Update `router.go` — add `hub *Hub` field to `Server` struct and register the `/ws` route:

```go
// Add to Server struct:
// hub *Hub

// Add to Handler() function before return:
// mux.HandleFunc("/ws", s.handleWebSocket)
```

Update `NewServer` to accept a hub parameter or initialize it internally.

- [ ] **Step 5: Get dependency and run tests**

Run: `go get github.com/coder/websocket && go test ./internal/api/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add internal/api/ go.mod go.sum
git commit -m "feat: add WebSocket hub for real-time file change events"
```

---

## Task 11: Wire Up Main Entry Point

**Files:**
- Modify: `cmd/planboard/main.go`

- [ ] **Step 1: Implement full server startup in main.go**

```go
// cmd/planboard/main.go
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/caisergan/planboard/internal/api"
	"github.com/caisergan/planboard/internal/config"
	"github.com/caisergan/planboard/internal/scanner"
	"github.com/caisergan/planboard/internal/watcher"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	initFlag := flag.Bool("init", false, "Create default config")
	cfgPath := flag.String("config", config.ConfigPath(), "Config file path")
	flag.Parse()

	if *initFlag {
		cfg := config.Default()
		if err := cfg.Save(*cfgPath); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}
		fmt.Printf("Config created at %s\n", *cfgPath)
		return nil
	}

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("No config found. Run with --init to create one.")
			return nil
		}
		return fmt.Errorf("loading config: %w", err)
	}

	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		return fmt.Errorf("scanning: %w", err)
	}

	totalFiles := 0
	for _, files := range index {
		totalFiles += len(files)
	}
	log.Printf("Scanned %d projects, %d files", len(index), totalFiles)

	hub := api.NewHub()
	go hub.Run()

	srv := api.NewServerWithHub(index, cfg, hub)

	watchDirs, _ := s.WatchDirs()
	events := make(chan watcher.Event, 100)
	w, err := watcher.New(watchDirs, time.Duration(cfg.Watch.DebounceMs)*time.Millisecond, events)
	if err != nil {
		log.Printf("Warning: file watcher failed to start: %v", err)
	} else {
		go w.Start()
		go func() {
			for ev := range events {
				evType := "file-changed"
				switch ev.Type {
				case watcher.FileAdded:
					evType = "file-added"
				case watcher.FileDeleted:
					evType = "file-deleted"
				}
				hub.Broadcast(api.WSEvent{
					Type:    evType,
					Path:    ev.Path,
					Project: ev.Project,
				})
			}
		}()
		defer w.Close()
	}

	addr := fmt.Sprintf("127.0.0.1:%d", cfg.Server.Port)
	httpSrv := &http.Server{
		Addr:    addr,
		Handler: srv.Handler(),
	}

	go func() {
		log.Printf("Planboard running at http://%s", addr)
		if err := httpSrv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return httpSrv.Shutdown(ctx)
}
```

- [ ] **Step 2: Add NewServerWithHub to api package**

```go
// Add to internal/api/router.go
func NewServerWithHub(index scanner.ProjectIndex, cfg *config.Config, hub *Hub) *Server {
	return &Server{
		index: index,
		cfg:   cfg,
		hub:   hub,
	}
}
```

- [ ] **Step 3: Verify compilation**

Run: `go build ./cmd/planboard`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add cmd/planboard/ internal/api/router.go
git commit -m "feat: wire up main entry point with server, scanner, and watcher"
```

---

## Task 12: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/lib/types.ts`

- [ ] **Step 1: Initialize frontend project**

Run:
```bash
mkdir -p frontend/src/{components,hooks,lib}
cd frontend
npm init -y
npm install preact
npm install -D vite @preact/preset-vite typescript
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create types.ts**

```typescript
// frontend/src/lib/types.ts
export interface FileMetadata {
  title: string
  type: 'plan' | 'spec'
  project: string
  created: string
  status: 'pending' | 'in-progress' | 'done'
  total_tasks: number
  completed_tasks: number
  version: number
  path: string
  format: 'html' | 'md'
}

export interface ProjectSummary {
  name: string
  file_count: number
}

export interface FileResult {
  content: string
  format: 'html' | 'md'
  metadata: FileMetadata
}

export interface WSEvent {
  type: 'file-changed' | 'file-added' | 'file-deleted' | 'scan-complete'
  path: string
  project: string
  metadata?: FileMetadata
}
```

- [ ] **Step 6: Create main.tsx and App.tsx**

```tsx
// frontend/src/main.tsx
import { render } from 'preact'
import { App } from './App'

render(<App />, document.getElementById('app')!)
```

```tsx
// frontend/src/App.tsx
import { useState } from 'preact/hooks'

export function App() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside style={{ width: '280px', borderRight: '1px solid #1e293b', padding: '1rem', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.25rem', color: '#818cf8', marginBottom: '1rem' }}>Planboard</h1>
        <p style={{ color: '#64748b' }}>Loading projects...</p>
      </aside>
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <p style={{ color: '#64748b' }}>Select a file to view</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Verify dev server starts**

Run: `cd frontend && npm run dev`
Expected: Vite server starts on :5173, page renders in browser

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Preact frontend with Vite and proxy config"
```

---

## Task 13: Frontend API Client & WebSocket Hook

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useFileIndex.ts`

- [ ] **Step 1: Create API client**

```typescript
// frontend/src/lib/api.ts
import type { FileMetadata, FileResult, ProjectSummary } from './types'

const BASE = ''

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${BASE}/api/projects`)
  return res.json()
}

export async function fetchProjectFiles(name: string): Promise<FileMetadata[]> {
  const res = await fetch(`${BASE}/api/projects/${name}/files`)
  return res.json()
}

export async function fetchFile(path: string): Promise<FileResult> {
  const res = await fetch(`${BASE}/api/files?path=${encodeURIComponent(path)}`)
  return res.json()
}

export async function toggleTask(path: string, taskId: string, status: string): Promise<FileMetadata> {
  const res = await fetch(`${BASE}/api/files/tasks`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, taskId, status }),
  })
  return res.json()
}
```

- [ ] **Step 2: Create WebSocket hook**

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'preact/hooks'
import type { WSEvent } from '../lib/types'

export function useWebSocket(onEvent: (event: WSEvent) => void) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>()

  useEffect(() => {
    let attempt = 0

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        attempt = 0
      }

      ws.onmessage = (ev) => {
        const event: WSEvent = JSON.parse(ev.data)
        onEvent(event)
      }

      ws.onclose = () => {
        setConnected(false)
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        attempt++
        reconnectTimer.current = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { connected }
}
```

- [ ] **Step 3: Create file index hook**

```typescript
// frontend/src/hooks/useFileIndex.ts
import { useState, useEffect, useCallback } from 'preact/hooks'
import type { FileMetadata, ProjectSummary, WSEvent } from '../lib/types'
import { fetchProjects, fetchProjectFiles } from '../lib/api'

interface FileIndex {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
}

export function useFileIndex() {
  const [index, setIndex] = useState<FileIndex>({ projects: [], files: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    const projects = await fetchProjects()
    const files: Record<string, FileMetadata[]> = {}

    for (const project of projects) {
      files[project.name] = await fetchProjectFiles(project.name)
    }

    setIndex({ projects, files })
    setLoading(false)
  }

  const handleWSEvent = useCallback((event: WSEvent) => {
    if (event.type === 'file-changed' || event.type === 'file-added' || event.type === 'file-deleted') {
      loadProjects()
    }
  }, [])

  return { index, loading, handleWSEvent, refresh: loadProjects }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/ frontend/src/hooks/
git commit -m "feat: add API client, WebSocket hook, and file index state"
```

---

## Task 14: Sidebar Component

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge**

```tsx
// frontend/src/components/StatusBadge.tsx
interface Props {
  status: string
}

const colors: Record<string, string> = {
  'done': '#4ade80',
  'in-progress': '#fbbf24',
  'pending': '#64748b',
}

export function StatusBadge({ status }: Props) {
  const color = colors[status] || colors.pending
  return (
    <span style={{
      fontSize: '0.7rem',
      padding: '2px 6px',
      borderRadius: '4px',
      background: `${color}22`,
      color: color,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Create Sidebar**

```tsx
// frontend/src/components/Sidebar.tsx
import { useState } from 'preact/hooks'
import type { FileMetadata, ProjectSummary } from '../lib/types'
import { StatusBadge } from './StatusBadge'

interface Props {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
  onFileSelect: (file: FileMetadata) => void
  selectedPath: string | null
}

export function Sidebar({ projects, files, onFileSelect, selectedPath }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggle(name: string) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <aside style={{ width: '280px', borderRight: '1px solid #1e293b', padding: '1rem', overflowY: 'auto', height: '100vh' }}>
      <h1 style={{ fontSize: '1.25rem', color: '#818cf8', marginBottom: '1rem' }}>Planboard</h1>

      {projects.map(project => (
        <div key={project.name} style={{ marginBottom: '0.5rem' }}>
          <div
            onClick={() => toggle(project.name)}
            style={{ cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
              {expanded[project.name] ? '▼' : '▶'}
            </span>
            <span style={{ fontWeight: 500 }}>{project.name}</span>
            <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: 'auto' }}>
              {project.file_count}
            </span>
          </div>

          {expanded[project.name] && files[project.name]?.map(file => (
            <div
              key={file.path}
              onClick={() => onFileSelect(file)}
              style={{
                padding: '4px 8px 4px 24px',
                cursor: 'pointer',
                borderRadius: '4px',
                background: selectedPath === file.path ? '#1e293b' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ color: file.format === 'html' ? '#818cf8' : '#94a3b8' }}>
                {file.format === 'html' ? '◆' : '◇'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.title || 'Untitled'}
              </span>
              {file.status && <StatusBadge status={file.status} />}
            </div>
          ))}
        </div>
      ))}
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add Sidebar and StatusBadge components"
```

---

## Task 15: PlanViewer & TaskList Components

**Files:**
- Create: `frontend/src/components/PlanViewer.tsx`
- Create: `frontend/src/components/TaskList.tsx`
- Create: `frontend/src/components/ProgressBar.tsx`

- [ ] **Step 1: Create ProgressBar**

```tsx
// frontend/src/components/ProgressBar.tsx
interface Props {
  completed: number
  total: number
}

export function ProgressBar({ completed, total }: Props) {
  const pct = total > 0 ? (completed / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#1e293b' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: '#818cf8', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{completed}/{total}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create TaskList**

```tsx
// frontend/src/components/TaskList.tsx
import { useState } from 'preact/hooks'
import { toggleTask } from '../lib/api'

interface Task {
  id: string
  text: string
  status: string
}

interface Props {
  tasks: Task[]
  filePath: string
  onToggle: () => void
}

export function TaskList({ tasks, filePath, onToggle }: Props) {
  const [pending, setPending] = useState<Set<string>>(new Set())

  async function handleToggle(task: Task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    setPending(prev => new Set(prev).add(task.id))

    await toggleTask(filePath, task.id, newStatus)
    setPending(prev => {
      const next = new Set(prev)
      next.delete(task.id)
      return next
    })
    onToggle()
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {tasks.map(task => (
        <li
          key={task.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 0',
            opacity: pending.has(task.id) ? 0.5 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={() => handleToggle(task)}
            disabled={pending.has(task.id)}
            style={{ cursor: 'pointer', accentColor: '#818cf8' }}
          />
          <span style={{
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            color: task.status === 'done' ? '#64748b' : task.status === 'active' ? '#fbbf24' : '#e2e8f0',
          }}>
            {task.text}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Create PlanViewer**

```tsx
// frontend/src/components/PlanViewer.tsx
import { useState, useEffect } from 'preact/hooks'
import type { FileResult } from '../lib/types'
import { fetchFile } from '../lib/api'
import { TaskList } from './TaskList'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

interface Props {
  path: string
}

interface Phase {
  id: string
  title: string
  status: string
  tasks: { id: string; text: string; status: string }[]
}

export function PlanViewer({ path }: Props) {
  const [file, setFile] = useState<FileResult | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])

  useEffect(() => { load() }, [path])

  async function load() {
    const result = await fetchFile(path)
    setFile(result)
    setPhases(parsePhases(result.content))
  }

  if (!file) return <p style={{ color: '#64748b' }}>Loading...</p>

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'done').length, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#f1f5f9' }}>{file.metadata.title}</h2>
        {file.metadata.status && <StatusBadge status={file.metadata.status} />}
      </div>

      <ProgressBar completed={doneTasks} total={totalTasks} />

      {phases.map(phase => (
        <div key={phase.id} style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>{phase.title}</h3>
            <StatusBadge status={phase.status} />
          </div>
          <ProgressBar
            completed={phase.tasks.filter(t => t.status === 'done').length}
            total={phase.tasks.length}
          />
          <TaskList tasks={phase.tasks} filePath={path} onToggle={load} />
        </div>
      ))}
    </div>
  )
}

function parsePhases(html: string): Phase[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const phases: Phase[] = []

  doc.querySelectorAll('[data-phase]').forEach(el => {
    const phaseEl = el as HTMLElement
    const tasks: Phase['tasks'] = []

    phaseEl.querySelectorAll('[data-task-id]').forEach(taskEl => {
      const li = taskEl as HTMLElement
      tasks.push({
        id: li.dataset.taskId!,
        text: li.textContent?.trim() || '',
        status: li.dataset.taskStatus || 'pending',
      })
    })

    phases.push({
      id: phaseEl.dataset.phase!,
      title: phaseEl.querySelector('h3')?.textContent || `Phase ${phaseEl.dataset.phase}`,
      status: phaseEl.dataset.phaseStatus || 'pending',
      tasks,
    })
  })

  return phases
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add PlanViewer, TaskList, and ProgressBar components"
```

---

## Task 16: MarkdownViewer Component

**Files:**
- Create: `frontend/src/components/MarkdownViewer.tsx`

- [ ] **Step 1: Install markdown dependencies**

Run: `cd frontend && npm install marked highlight.js`

- [ ] **Step 2: Create MarkdownViewer**

```tsx
// frontend/src/components/MarkdownViewer.tsx
import { useState, useEffect } from 'preact/hooks'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { fetchFile } from '../lib/api'
import { StatusBadge } from './StatusBadge'

interface Props {
  path: string
}

marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

export function MarkdownViewer({ path }: Props) {
  const [html, setHtml] = useState('')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function load() {
      const result = await fetchFile(path)
      setTitle(result.metadata.title)
      setStatus(result.metadata.status)

      let content = result.content
      if (content.startsWith('---')) {
        const end = content.indexOf('---', 3)
        if (end !== -1) {
          content = content.slice(end + 3).trim()
        }
      }

      setHtml(marked(content) as string)
    }
    load()
  }, [path])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#f1f5f9' }}>{title}</h2>
        {status && <StatusBadge status={status} />}
        <span style={{ fontSize: '0.7rem', color: '#64748b', padding: '2px 6px', border: '1px solid #334155', borderRadius: '4px' }}>
          read-only
        </span>
      </div>
      <div
        class="markdown-body"
        style={{ lineHeight: 1.7, color: '#cbd5e1' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MarkdownViewer.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add MarkdownViewer with syntax highlighting"
```

---

## Task 17: Wire App with All Components

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Connect all components in App.tsx**

```tsx
// frontend/src/App.tsx
import { useState } from 'preact/hooks'
import type { FileMetadata } from './lib/types'
import { useFileIndex } from './hooks/useFileIndex'
import { useWebSocket } from './hooks/useWebSocket'
import { Sidebar } from './components/Sidebar'
import { PlanViewer } from './components/PlanViewer'
import { MarkdownViewer } from './components/MarkdownViewer'

export function App() {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const { index, loading, handleWSEvent } = useFileIndex()
  const { connected } = useWebSocket(handleWSEvent)

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        projects={index.projects}
        files={index.files}
        onFileSelect={setSelectedFile}
        selectedPath={selectedFile?.path || null}
      />
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {!selectedFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: '#64748b' }}>Select a file to view</p>
          </div>
        )}
        {selectedFile?.format === 'html' && <PlanViewer path={selectedFile.path} />}
        {selectedFile?.format === 'md' && <MarkdownViewer path={selectedFile.path} />}
      </main>
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '8px 16px', background: '#1e293b', borderTop: '1px solid #334155',
        fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px',
      }}>
        <span>{index.projects.length} projects</span>
        <span>|</span>
        <span>{Object.values(index.files).flat().length} files</span>
        <span>|</span>
        <span style={{ color: connected ? '#4ade80' : '#ef4444' }}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify frontend renders with backend running**

Run (terminal 1): `go run ./cmd/planboard`
Run (terminal 2): `cd frontend && npm run dev`
Expected: Open http://localhost:5173, see Planboard with projects in sidebar

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire App with Sidebar, PlanViewer, and MarkdownViewer"
```

---

## Task 18: MD → HTML Converter

**Files:**
- Create: `internal/fileio/converter.go`
- Create: `internal/fileio/converter_test.go`

- [ ] **Step 1: Write failing test**

```go
// internal/fileio/converter_test.go
package fileio

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertMDToHTML(t *testing.T) {
	src := testdataPath("sample-plan.md")
	dir := t.TempDir()
	dst := filepath.Join(dir, "sample-plan.html")

	err := ConvertMDToHTML(src, dst)
	if err != nil {
		t.Fatalf("ConvertMDToHTML() error: %v", err)
	}

	content, _ := os.ReadFile(dst)
	html := string(content)

	if !strings.Contains(html, `data-planboard-version="1"`) {
		t.Error("missing planboard version attribute")
	}
	if !strings.Contains(html, `planboard:type`) {
		t.Error("missing planboard:type meta")
	}
	if !strings.Contains(html, `data-task-id="1"`) {
		t.Error("missing task ID for first checkbox")
	}
	if !strings.Contains(html, `data-task-status="done"`) {
		t.Error("missing done status for checked items")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/fileio/ -v -run TestConvert`
Expected: FAIL — `ConvertMDToHTML` not defined

- [ ] **Step 3: Implement converter**

```go
// internal/fileio/converter.go
package fileio

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func ConvertMDToHTML(srcPath, dstPath string) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	var title, fileType, project, status, created string
	var lines []string
	inFrontmatter := false
	frontmatterDone := false

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()

		if !frontmatterDone && strings.TrimSpace(line) == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				frontmatterDone = true
				inFrontmatter = false
				continue
			}
		}

		if inFrontmatter {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				k, v := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
				switch k {
				case "title":
					title = v
				case "type":
					fileType = v
				case "project":
					project = v
				case "status":
					status = v
				case "date":
					created = v
				}
			}
			continue
		}

		lines = append(lines, line)
	}

	if title == "" {
		title = strings.TrimSuffix(filepath.Base(srcPath), filepath.Ext(srcPath))
	}
	if fileType == "" {
		fileType = "plan"
	}
	if status == "" {
		status = "pending"
	}
	if created == "" {
		created = time.Now().Format("2006-01-02")
	}

	taskID := 0
	totalTasks := 0
	completedTasks := 0
	var bodyLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "- [x]") || strings.HasPrefix(trimmed, "- [X]") {
			taskID++
			totalTasks++
			completedTasks++
			text := strings.TrimSpace(trimmed[5:])
			bodyLines = append(bodyLines, fmt.Sprintf(`        <li data-task-id="%d" data-task-status="done">%s</li>`, taskID, text))
		} else if strings.HasPrefix(trimmed, "- [ ]") {
			taskID++
			totalTasks++
			text := strings.TrimSpace(trimmed[5:])
			bodyLines = append(bodyLines, fmt.Sprintf(`        <li data-task-id="%d" data-task-status="pending">%s</li>`, taskID, text))
		} else if strings.HasPrefix(trimmed, "# ") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <h1>%s</h1>`, trimmed[2:]))
		} else if strings.HasPrefix(trimmed, "## ") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <h2>%s</h2>`, trimmed[3:]))
		} else if strings.HasPrefix(trimmed, "### ") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <h3>%s</h3>`, trimmed[4:]))
		} else if trimmed != "" {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <p>%s</p>`, trimmed))
		}
	}

	phaseStatus := "pending"
	if completedTasks == totalTasks && totalTasks > 0 {
		phaseStatus = "done"
	} else if completedTasks > 0 {
		phaseStatus = "in-progress"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en" data-planboard-version="1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
  <meta name="planboard:type" content="%s">
  <meta name="planboard:project" content="%s">
  <meta name="planboard:created" content="%s">
  <meta name="planboard:status" content="%s">
  <meta name="planboard:total-tasks" content="%d">
  <meta name="planboard:completed-tasks" content="%d">
  <style>
    :root { --bg: #0f172a; --text: #e2e8f0; --accent: #818cf8; --success: #4ade80; --warning: #fbbf24; --muted: #64748b; }
    body { font-family: system-ui; background: var(--bg); color: var(--text); max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: var(--accent); }
    [data-task-status="done"] { text-decoration: line-through; color: var(--muted); }
  </style>
</head>
<body>
  <header data-section="header">
    <h1>%s</h1>
    <p class="meta">Project: %s | Created: %s | Status: %s</p>
  </header>
  <section data-section="phases">
    <div data-phase="1" data-phase-status="%s">
      <ul data-task-list>
%s
      </ul>
    </div>
  </section>
</body>
</html>`, title, fileType, project, created, status, totalTasks, completedTasks,
		title, project, created, status, phaseStatus,
		strings.Join(bodyLines, "\n"))

	return atomicWrite(dstPath, []byte(html))
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./internal/fileio/ -v -run TestConvert`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/fileio/converter.go internal/fileio/converter_test.go
git commit -m "feat: add markdown to planboard HTML converter"
```

---

## Task 19: CLI Subcommands

**Files:**
- Modify: `cmd/planboard/main.go`

- [ ] **Step 1: Add convert and scan subcommands**

```go
// Update cmd/planboard/main.go — replace the flag parsing with subcommand handling:

func run() error {
	if len(os.Args) < 2 {
		return runServer()
	}

	switch os.Args[1] {
	case "--init":
		return runInit()
	case "convert":
		if len(os.Args) < 3 {
			return fmt.Errorf("usage: planboard convert <file.md>")
		}
		return runConvert(os.Args[2])
	case "scan":
		return runScan()
	case "init":
		return runProjectInit()
	default:
		return runServer()
	}
}

func runInit() error {
	cfg := config.Default()
	path := config.ConfigPath()
	if err := cfg.Save(path); err != nil {
		return err
	}
	fmt.Printf("Config created at %s\n", path)
	return nil
}

func runConvert(mdPath string) error {
	abs, err := filepath.Abs(mdPath)
	if err != nil {
		return err
	}
	htmlPath := strings.TrimSuffix(abs, filepath.Ext(abs)) + ".html"
	if err := fileio.ConvertMDToHTML(abs, htmlPath); err != nil {
		return err
	}
	fmt.Printf("Converted: %s → %s\n", abs, htmlPath)
	return nil
}

func runScan() error {
	cfg, err := config.Load(config.ConfigPath())
	if err != nil {
		return err
	}
	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		return err
	}
	for name, files := range index {
		fmt.Printf("%s (%d files)\n", name, len(files))
		for _, f := range files {
			fmt.Printf("  %s [%s] %s\n", f.Title, f.Type, f.Status)
		}
	}
	return nil
}

func runProjectInit() error {
	fmt.Println("Project init — creates .planboard-active (not yet implemented)")
	return nil
}
```

- [ ] **Step 2: Verify CLI works**

Run: `go run ./cmd/planboard scan`
Expected: Lists discovered projects (or "no config" message)

Run: `go run ./cmd/planboard convert testdata/sample-plan.md`
Expected: Creates `testdata/sample-plan.html`

- [ ] **Step 3: Commit**

```bash
git add cmd/planboard/main.go
git commit -m "feat: add CLI subcommands (convert, scan, init)"
```

---

## Task 20: Hook Script

**Files:**
- Create: `hooks/planboard-sync.sh`

- [ ] **Step 1: Create the hook script**

```bash
#!/bin/bash
# hooks/planboard-sync.sh
# Claude Code hook — detects plan file changes between prompts

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ -f "$PROJECT_DIR/.planboard-active" ]; then
  PLAN_FILE="$PROJECT_DIR/$(cat "$PROJECT_DIR/.planboard-active")"
else
  PLAN_FILE=$(find "$PROJECT_DIR/docs" -name "*.html" -path "*/plans/*" 2>/dev/null | sort -r | head -1)
fi

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  exit 0
fi

if command -v md5sum &>/dev/null; then
  HASH=$(echo "$PROJECT_DIR" | md5sum | cut -c1-8)
elif command -v md5 &>/dev/null; then
  HASH=$(md5 -q -s "$PROJECT_DIR")
else
  HASH=$(echo "$PROJECT_DIR" | cksum | cut -d' ' -f1)
fi

STATE_FILE="/tmp/planboard-mtime-$HASH"

if [ "$(uname)" = "Darwin" ]; then
  CURRENT_MTIME=$(stat -f %m "$PLAN_FILE" 2>/dev/null)
else
  CURRENT_MTIME=$(stat -c %Y "$PLAN_FILE" 2>/dev/null)
fi

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

- [ ] **Step 2: Make executable**

Run: `chmod +x hooks/planboard-sync.sh`

- [ ] **Step 3: Commit**

```bash
git add hooks/
git commit -m "feat: add Claude Code hook for mid-session plan change detection"
```

---

## Task 21: Production Build (embed.FS)

**Files:**
- Modify: `cmd/planboard/main.go`
- Modify: `Makefile`

- [ ] **Step 1: Add embed directive for frontend dist**

Add to `cmd/planboard/main.go`:

```go
import "embed"

//go:embed all:../../frontend/dist
var frontendFS embed.FS

// In runServer(), after setting up API routes:
// Serve embedded frontend in production (when frontend/dist exists in the binary)
```

Update the server setup to serve static files from the embedded FS when not in dev mode:

```go
func runServer() error {
	// ... existing setup ...

	// Check if running in dev mode (frontend dev server is separate)
	devMode := os.Getenv("PLANBOARD_DEV") == "1"

	if !devMode {
		// Serve embedded frontend
		distFS, err := fs.Sub(frontendFS, "frontend/dist")
		if err == nil {
			mux.Handle("/", http.FileServer(http.FS(distFS)))
		}
	}

	// ... rest of server startup ...
}
```

- [ ] **Step 2: Update Makefile for production build**

```makefile
.PHONY: dev build run test clean

dev:
	@PLANBOARD_DEV=1 air &
	@cd frontend && npm run dev

build: frontend-build
	@go build -o bin/planboard ./cmd/planboard

frontend-build:
	@cd frontend && npm run build

run: build
	@./bin/planboard

test:
	@go test ./... -v
	@cd frontend && npm test 2>/dev/null || true

clean:
	@rm -rf bin/ frontend/dist/
```

- [ ] **Step 3: Verify production build**

Run: `make build`
Expected: Produces `bin/planboard` binary that serves both API and frontend

- [ ] **Step 4: Commit**

```bash
git add cmd/planboard/main.go Makefile
git commit -m "feat: add production build with embedded frontend via embed.FS"
```

---

## Task 22: Integration Test

**Files:**
- Create: `integration_test.go`

- [ ] **Step 1: Write end-to-end integration test**

```go
// integration_test.go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/caisergan/planboard/internal/api"
	"github.com/caisergan/planboard/internal/config"
	"github.com/caisergan/planboard/internal/scanner"
	"github.com/caisergan/planboard/internal/watcher"
)

func TestIntegration_FullFlow(t *testing.T) {
	root := t.TempDir()
	planDir := filepath.Join(root, "my-project", "docs", "superpowers", "plans")
	os.MkdirAll(planDir, 0755)

	planContent, _ := os.ReadFile("testdata/sample-plan.html")
	planPath := filepath.Join(planDir, "2026-05-20-setup.html")
	os.WriteFile(planPath, planContent, 0644)

	cfg := &config.Config{
		Roots:           []string{root},
		ScanPatterns:    []string{"docs/**/*.html", "docs/**/*.md"},
		ExcludePatterns: []string{"node_modules"},
		Server:          config.ServerConfig{Port: 0},
		Watch:           config.WatchConfig{DebounceMs: 50},
	}

	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if _, ok := index["my-project"]; !ok {
		t.Fatal("my-project not found in index")
	}

	hub := api.NewHub()
	go hub.Run()

	srv := api.NewServerWithHub(index, cfg, hub)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// GET /api/projects
	resp, _ := http.Get(ts.URL + "/api/projects")
	var projects []api.ProjectSummary
	json.NewDecoder(resp.Body).Decode(&projects)
	resp.Body.Close()

	if len(projects) != 1 || projects[0].Name != "my-project" {
		t.Errorf("projects = %v, want [my-project]", projects)
	}

	// GET /api/files
	resp, _ = http.Get(ts.URL + "/api/files?path=" + planPath)
	var fileResult map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&fileResult)
	resp.Body.Close()

	if fileResult["format"] != "html" {
		t.Errorf("format = %v, want html", fileResult["format"])
	}

	// PATCH /api/files/tasks — toggle task 3 to done
	body := fmt.Sprintf(`{"path":"%s","taskId":"3","status":"done"}`, planPath)
	req, _ := http.NewRequest("PATCH", ts.URL+"/api/files/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("toggle status = %d, want 200", resp.StatusCode)
	}

	// Verify file was updated
	updated, _ := os.ReadFile(planPath)
	if !strings.Contains(string(updated), `data-task-id="3" data-task-status="done"`) {
		t.Error("task 3 not toggled in file")
	}

	// Verify watcher ignores self-write
	events := make(chan watcher.Event, 10)
	w, _ := watcher.New([]string{planDir}, 50*time.Millisecond, events)
	go w.Start()
	defer w.Close()

	time.Sleep(200 * time.Millisecond)

	select {
	case <-events:
		t.Error("received event for self-write — suppression failed")
	case <-time.After(300 * time.Millisecond):
		// Good — no event
	}
}
```

- [ ] **Step 2: Run integration test**

Run: `go test -v -run TestIntegration`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add integration_test.go
git commit -m "test: add end-to-end integration test for full flow"
```

---

## Task 23: Final Cleanup & README

**Files:**
- Modify: `Makefile` (final version)
- Verify all tests pass

- [ ] **Step 1: Run full test suite**

Run: `go test ./... -v`
Expected: All tests PASS

- [ ] **Step 2: Run linter**

Run: `go vet ./...`
Expected: No issues

- [ ] **Step 3: Verify production build works end-to-end**

Run: `cd frontend && npm install && npm run build && cd .. && make build`
Run: `./bin/planboard --init`
Run: `./bin/planboard scan`
Expected: Config created, scan runs (may show 0 projects if no roots configured)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and build verification"
```
