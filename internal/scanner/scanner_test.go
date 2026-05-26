package scanner

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanRoots(t *testing.T) {
	root := t.TempDir()

	planDir := filepath.Join(root, "project-a", "docs", "superpowers", "plans")
	if err := os.MkdirAll(planDir, 0755); err != nil {
		t.Fatalf("setup: %v", err)
	}

	planContent, _ := os.ReadFile(testdataPath("sample-plan.html"))
	if err := os.WriteFile(filepath.Join(planDir, "2026-05-20-setup.html"), planContent, 0644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	specDir := filepath.Join(root, "project-a", "docs", "superpowers", "specs")
	if err := os.MkdirAll(specDir, 0755); err != nil {
		t.Fatalf("setup: %v", err)
	}

	mdContent, _ := os.ReadFile(testdataPath("sample-plan.md"))
	if err := os.WriteFile(filepath.Join(specDir, "design.md"), mdContent, 0644); err != nil {
		t.Fatalf("setup: %v", err)
	}

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
		t.Errorf("len(files) = %d, want 2", len(files))
		for _, f := range files {
			t.Logf("  file: %s", f.Path)
		}
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

func TestScanRoots_EmptyRoot(t *testing.T) {
	root := t.TempDir()

	s := New([]string{root}, []string{"docs/**/*.html"}, []string{})
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if len(index) != 0 {
		t.Errorf("len(index) = %d, want 0", len(index))
	}
}

func TestScanRoots_NonexistentRoot(t *testing.T) {
	s := New([]string{"/nonexistent/path"}, []string{"docs/**/*.html"}, []string{})
	index, err := s.Scan()
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}

	if len(index) != 0 {
		t.Errorf("len(index) = %d, want 0", len(index))
	}
}

func TestWatchDirs(t *testing.T) {
	root := t.TempDir()

	docsDir := filepath.Join(root, "my-project", "docs", "superpowers", "plans")
	os.MkdirAll(docsDir, 0755)

	s := New([]string{root}, []string{"docs/**/*.html"}, []string{"node_modules"})
	dirs, err := s.WatchDirs()
	if err != nil {
		t.Fatalf("WatchDirs() error: %v", err)
	}

	if len(dirs) == 0 {
		t.Error("WatchDirs() returned empty, want at least one docs dir")
	}

	found := false
	for _, d := range dirs {
		if filepath.Base(d) == "docs" || filepath.Base(d) == "plans" || filepath.Base(d) == "superpowers" {
			found = true
		}
	}
	if !found {
		t.Errorf("WatchDirs() = %v, expected a docs-related directory", dirs)
	}
}
