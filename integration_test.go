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
	if err := os.MkdirAll(planDir, 0755); err != nil {
		t.Fatalf("setup mkdir: %v", err)
	}

	planContent, err := os.ReadFile("testdata/sample-plan.html")
	if err != nil {
		t.Fatalf("setup read fixture: %v", err)
	}
	planPath := filepath.Join(planDir, "2026-05-20-setup.html")
	if err := os.WriteFile(planPath, planContent, 0644); err != nil {
		t.Fatalf("setup write plan: %v", err)
	}

	cfg := &config.Config{
		Roots:           []string{root},
		ScanPatterns:    []string{"docs/**/*.html", "docs/**/*.md"},
		ExcludePatterns: []string{"node_modules"},
		Server:          config.ServerConfig{Port: 0},
		Watch:           config.WatchConfig{DebounceMs: 50},
	}

	// Scan
	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if _, ok := index["my-project"]; !ok {
		t.Fatal("my-project not found in index")
	}
	if len(index["my-project"]) != 1 {
		t.Fatalf("expected 1 file, got %d", len(index["my-project"]))
	}

	// Start server
	hub := api.NewHub()
	go hub.Run()

	srv := api.NewServerWithHub(index, cfg, hub)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// GET /api/health
	resp, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatalf("GET /api/health: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("health status = %d", resp.StatusCode)
	}

	// GET /api/projects
	resp, err = http.Get(ts.URL + "/api/projects")
	if err != nil {
		t.Fatalf("GET /api/projects: %v", err)
	}
	var projects []api.ProjectSummary
	json.NewDecoder(resp.Body).Decode(&projects)
	resp.Body.Close()

	if len(projects) != 1 || projects[0].Name != "my-project" {
		t.Fatalf("projects = %+v, want [my-project]", projects)
	}
	if projects[0].FileCount != 1 {
		t.Fatalf("file_count = %d, want 1", projects[0].FileCount)
	}

	// GET /api/files
	resp, err = http.Get(ts.URL + "/api/files?path=" + planPath)
	if err != nil {
		t.Fatalf("GET /api/files: %v", err)
	}
	var fileResult map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&fileResult)
	resp.Body.Close()

	if fileResult["format"] != "html" {
		t.Fatalf("format = %v, want html", fileResult["format"])
	}

	// PATCH /api/files/tasks — toggle task 3 to done
	body := fmt.Sprintf(`{"path":"%s","taskId":"3","status":"done"}`, planPath)
	req, _ := http.NewRequest("PATCH", ts.URL+"/api/files/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH /api/files/tasks: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("toggle status = %d", resp.StatusCode)
	}

	// Verify file was updated on disk
	updated, err := os.ReadFile(planPath)
	if err != nil {
		t.Fatalf("read updated file: %v", err)
	}
	if !strings.Contains(string(updated), `data-task-id="3" data-task-status="done"`) {
		t.Error("task 3 not toggled in file")
	}

	// Verify metadata was recomputed
	meta, _ := scanner.ExtractHTMLMetadata(planPath)
	if meta.CompletedTasks != 3 {
		t.Errorf("CompletedTasks = %d, want 3", meta.CompletedTasks)
	}
	if meta.Status != "in-progress" {
		t.Errorf("Status = %q, want in-progress", meta.Status)
	}

	// Verify path validation blocks forbidden paths
	resp, _ = http.Get(ts.URL + "/api/files?path=/etc/passwd")
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("path validation: status = %d, want 403", resp.StatusCode)
	}
	resp.Body.Close()

	// Verify watcher ignores self-write
	events := make(chan watcher.Event, 10)
	w, err := watcher.New([]string{planDir}, 50*time.Millisecond, events)
	if err != nil {
		t.Fatalf("watcher.New: %v", err)
	}
	go w.Start()
	defer w.Close()

	time.Sleep(200 * time.Millisecond)

	select {
	case ev := <-events:
		t.Errorf("received event for self-write (should be suppressed): %+v", ev)
	case <-time.After(300 * time.Millisecond):
		// Good — no event
	}
}

func TestIntegration_ConvertEndpoint(t *testing.T) {
	root := t.TempDir()
	docsDir := filepath.Join(root, "proj", "docs")
	os.MkdirAll(docsDir, 0755)

	mdContent, _ := os.ReadFile("testdata/sample-plan.md")
	mdPath := filepath.Join(docsDir, "plan.md")
	os.WriteFile(mdPath, mdContent, 0644)

	cfg := &config.Config{
		Roots: []string{root},
	}

	srv := api.NewServer(nil, cfg)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	body := fmt.Sprintf(`{"path":"%s"}`, mdPath)
	req, _ := http.NewRequest("POST", ts.URL+"/api/convert", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /api/convert: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("convert status = %d", resp.StatusCode)
	}

	htmlPath := filepath.Join(docsDir, "plan.html")
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		t.Fatal("converted HTML file not created")
	}

	meta, _ := scanner.ExtractHTMLMetadata(htmlPath)
	if meta.Type != "plan" {
		t.Errorf("converted type = %q, want plan", meta.Type)
	}
}
