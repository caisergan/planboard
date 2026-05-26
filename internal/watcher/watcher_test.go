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
	if err := os.WriteFile(path, []byte("initial"), 0644); err != nil {
		t.Fatalf("setup: %v", err)
	}

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
		t.Fatal("timeout waiting for change event")
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
		t.Fatal("timeout waiting for add event")
	}
}

func TestWatcher_IgnoresNonPlanFiles(t *testing.T) {
	dir := t.TempDir()

	events := make(chan Event, 10)
	w, err := New([]string{dir}, 50*time.Millisecond, events)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Close()

	go w.Start()
	time.Sleep(100 * time.Millisecond)

	os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("ignored"), 0644)

	select {
	case ev := <-events:
		t.Errorf("unexpected event for non-plan file: %+v", ev)
	case <-time.After(200 * time.Millisecond):
		// good — no event
	}
}

func TestWatcher_DetectsFileDelete(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "plan.html")
	os.WriteFile(path, []byte("content"), 0644)

	events := make(chan Event, 10)
	w, err := New([]string{dir}, 50*time.Millisecond, events)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Close()

	go w.Start()
	time.Sleep(100 * time.Millisecond)

	os.Remove(path)

	select {
	case ev := <-events:
		if ev.Type != FileDeleted {
			t.Errorf("Type = %v, want FileDeleted", ev.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for delete event")
	}
}
