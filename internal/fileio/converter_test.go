package fileio

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/caisergan/planboard/internal/scanner"
)

func TestConvertMDToHTML(t *testing.T) {
	src := testdataPath("sample-plan.md")
	dir := t.TempDir()
	dst := filepath.Join(dir, "sample-plan.html")

	err := ConvertMDToHTML(src, dst)
	if err != nil {
		t.Fatalf("ConvertMDToHTML() error: %v", err)
	}

	content, err := os.ReadFile(dst)
	if err != nil {
		t.Fatalf("reading output: %v", err)
	}
	html := string(content)

	if !strings.Contains(html, `data-planboard-version="1"`) {
		t.Error("missing planboard version attribute")
	}
	if !strings.Contains(html, `name="planboard:type" content="plan"`) {
		t.Error("missing planboard:type meta")
	}
	if !strings.Contains(html, `name="planboard:project" content="test-project"`) {
		t.Error("missing planboard:project meta")
	}
	if !strings.Contains(html, `data-task-id="1" data-task-status="done"`) {
		t.Error("missing done status for first checked item")
	}
	if !strings.Contains(html, `data-task-id="3" data-task-status="pending"`) {
		t.Error("missing pending status for unchecked item")
	}
	if !strings.Contains(html, `name="planboard:total-tasks" content="4"`) {
		t.Errorf("expected 4 total tasks")
	}
	if !strings.Contains(html, `name="planboard:completed-tasks" content="2"`) {
		t.Errorf("expected 2 completed tasks")
	}
}

func TestConvertMDToHTML_MetadataReadable(t *testing.T) {
	src := testdataPath("sample-plan.md")
	dir := t.TempDir()
	dst := filepath.Join(dir, "plan.html")

	if err := ConvertMDToHTML(src, dst); err != nil {
		t.Fatalf("ConvertMDToHTML() error: %v", err)
	}

	meta, err := scanner.ExtractHTMLMetadata(dst)
	if err != nil {
		t.Fatalf("ExtractHTMLMetadata() error: %v", err)
	}

	if meta.Type != "plan" {
		t.Errorf("Type = %q, want plan", meta.Type)
	}
	if meta.Project != "test-project" {
		t.Errorf("Project = %q, want test-project", meta.Project)
	}
	if meta.TotalTasks != 4 {
		t.Errorf("TotalTasks = %d, want 4", meta.TotalTasks)
	}
	if meta.CompletedTasks != 2 {
		t.Errorf("CompletedTasks = %d, want 2", meta.CompletedTasks)
	}
	if meta.Status != "in-progress" {
		t.Errorf("Status = %q, want in-progress", meta.Status)
	}
}

func TestConvertMDToHTML_NoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "bare.md")
	dst := filepath.Join(dir, "bare.html")

	content := "# My Plan\n\n- [ ] Do thing one\n- [x] Do thing two\n"
	if err := os.WriteFile(src, []byte(content), 0644); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if err := ConvertMDToHTML(src, dst); err != nil {
		t.Fatalf("ConvertMDToHTML() error: %v", err)
	}

	meta, err := scanner.ExtractHTMLMetadata(dst)
	if err != nil {
		t.Fatalf("ExtractHTMLMetadata() error: %v", err)
	}

	if meta.Title != "bare" {
		t.Errorf("Title = %q, want bare (from filename)", meta.Title)
	}
	if meta.TotalTasks != 2 {
		t.Errorf("TotalTasks = %d, want 2", meta.TotalTasks)
	}
	if meta.CompletedTasks != 1 {
		t.Errorf("CompletedTasks = %d, want 1", meta.CompletedTasks)
	}
}

func TestConvertMDToHTML_FileNotFound(t *testing.T) {
	err := ConvertMDToHTML("/nonexistent/file.md", "/tmp/out.html")
	if err == nil {
		t.Error("expected error for nonexistent source")
	}
}
