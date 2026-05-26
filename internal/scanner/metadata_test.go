package scanner

import (
	"os"
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

func TestExtractHTMLMetadata_Spec(t *testing.T) {
	meta, err := ExtractHTMLMetadata(testdataPath("sample-spec.html"))
	if err != nil {
		t.Fatalf("ExtractHTMLMetadata() error: %v", err)
	}

	if meta.Type != "spec" {
		t.Errorf("Type = %q, want %q", meta.Type, "spec")
	}
	if meta.Status != "done" {
		t.Errorf("Status = %q, want %q", meta.Status, "done")
	}
	if meta.Title != "Sample Spec" {
		t.Errorf("Title = %q, want %q", meta.Title, "Sample Spec")
	}
}

func TestExtractHTMLMetadata_FileNotFound(t *testing.T) {
	_, err := ExtractHTMLMetadata("/nonexistent/file.html")
	if err == nil {
		t.Error("expected error for nonexistent file")
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
	if meta.Created != "2026-05-15" {
		t.Errorf("Created = %q, want %q", meta.Created, "2026-05-15")
	}
}

func TestExtractMDMetadata_NoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "no-frontmatter.md")
	if err := os.WriteFile(path, []byte("# Just a Title\n\nSome content."), 0644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	meta, err := ExtractMDMetadata(path)
	if err != nil {
		t.Fatalf("ExtractMDMetadata() error: %v", err)
	}

	if meta.Title != "no-frontmatter" {
		t.Errorf("Title = %q, want %q", meta.Title, "no-frontmatter")
	}
	if meta.Type != "" {
		t.Errorf("Type = %q, want empty", meta.Type)
	}
}

func TestExtractMDMetadata_FileNotFound(t *testing.T) {
	_, err := ExtractMDMetadata("/nonexistent/file.md")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}
