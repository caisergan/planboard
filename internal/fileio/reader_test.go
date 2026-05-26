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
	if result.Metadata.Title != "Sample Plan" {
		t.Errorf("Title = %q, want %q", result.Metadata.Title, "Sample Plan")
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
	if len(result.Content) == 0 {
		t.Error("Content is empty")
	}
}

func TestReadFile_NotFound(t *testing.T) {
	_, err := ReadFile("/nonexistent/file.html")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}
