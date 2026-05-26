package fileio

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/caisergan/planboard/internal/scanner"
)

func copyFixture(t *testing.T, name string) string {
	t.Helper()
	dir := t.TempDir()
	src := testdataPath(name)
	dst := filepath.Join(dir, name)
	content, err := os.ReadFile(src)
	if err != nil {
		t.Fatalf("setup: read fixture: %v", err)
	}
	if err := os.WriteFile(dst, content, 0644); err != nil {
		t.Fatalf("setup: write fixture: %v", err)
	}
	return dst
}

func TestToggleTask_ActiveToDone(t *testing.T) {
	dst := copyFixture(t, "sample-plan.html")

	if err := ToggleTask(dst, "3", "done"); err != nil {
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
	dst := copyFixture(t, "sample-plan.html")

	if err := ToggleTask(dst, "1", "pending"); err != nil {
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

func TestToggleTask_AllDone(t *testing.T) {
	dst := copyFixture(t, "sample-plan.html")

	for _, id := range []string{"3", "4"} {
		if err := ToggleTask(dst, id, "done"); err != nil {
			t.Fatalf("ToggleTask(%s) error: %v", id, err)
		}
	}

	meta, _ := scanner.ExtractHTMLMetadata(dst)
	if meta.CompletedTasks != 4 {
		t.Errorf("CompletedTasks = %d, want 4", meta.CompletedTasks)
	}
	if meta.Status != "done" {
		t.Errorf("Status = %q, want %q", meta.Status, "done")
	}
}

func TestToggleTask_NotFound(t *testing.T) {
	dst := copyFixture(t, "sample-plan.html")

	err := ToggleTask(dst, "999", "done")
	if err == nil {
		t.Error("expected error for nonexistent task")
	}
}

func TestToggleTask_FileNotFound(t *testing.T) {
	err := ToggleTask("/nonexistent/file.html", "1", "done")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestIsSelfWrite(t *testing.T) {
	dst := copyFixture(t, "sample-plan.html")

	if err := ToggleTask(dst, "3", "done"); err != nil {
		t.Fatalf("ToggleTask() error: %v", err)
	}

	if !IsSelfWrite(dst) {
		t.Error("IsSelfWrite() = false immediately after write, want true")
	}

	time.Sleep(600 * time.Millisecond)

	if IsSelfWrite(dst) {
		t.Error("IsSelfWrite() = true after 600ms, want false")
	}
}

func TestCleanSelfWrites(t *testing.T) {
	selfWrites.Store("/tmp/old-file", time.Now().Add(-10*time.Second))
	selfWrites.Store("/tmp/recent-file", time.Now())

	CleanSelfWrites()

	if _, ok := selfWrites.Load("/tmp/old-file"); ok {
		t.Error("old entry not cleaned up")
	}
	if _, ok := selfWrites.Load("/tmp/recent-file"); !ok {
		t.Error("recent entry was incorrectly cleaned up")
	}

	selfWrites.Delete("/tmp/recent-file")
}
