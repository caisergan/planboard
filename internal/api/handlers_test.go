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

	"github.com/caisergan/planboard/internal/config"
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

	var body map[string]string
	json.NewDecoder(w.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("body.status = %q, want %q", body["status"], "ok")
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
		t.Fatalf("len(projects) = %d, want 2", len(result))
	}
	if result[0].Name != "project-a" {
		t.Errorf("result[0].Name = %q, want project-a (sorted)", result[0].Name)
	}
	if result[1].FileCount != 2 {
		t.Errorf("result[1].FileCount = %d, want 2", result[1].FileCount)
	}
}

func TestProjectFilesHandler(t *testing.T) {
	index := scanner.ProjectIndex{
		"my-project": []*scanner.FileMetadata{
			{Title: "Plan", Type: "plan"},
		},
	}

	srv := NewServer(index, nil)
	req := httptest.NewRequest("GET", "/api/projects/my-project/files", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var result []*scanner.FileMetadata
	json.NewDecoder(w.Body).Decode(&result)
	if len(result) != 1 {
		t.Errorf("len(files) = %d, want 1", len(result))
	}
}

func TestProjectFilesHandler_NotFound(t *testing.T) {
	srv := NewServer(scanner.ProjectIndex{}, nil)
	req := httptest.NewRequest("GET", "/api/projects/nonexistent/files", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
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

func TestFilesHandler_PathValidation(t *testing.T) {
	cfg := &config.Config{
		Roots: []string{"/allowed/root"},
	}
	srv := NewServer(nil, cfg)

	req := httptest.NewRequest("GET", "/api/files?path=/forbidden/path/file.html", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
	}
}

func TestTaskToggleHandler(t *testing.T) {
	dir := t.TempDir()
	src := testdataPath("sample-plan.html")
	dst := filepath.Join(dir, "plan.html")
	content, _ := os.ReadFile(src)
	os.WriteFile(dst, content, 0644)

	cfg := &config.Config{Roots: []string{dir}}
	srv := NewServer(nil, cfg)

	body := `{"path":"` + dst + `","taskId":"3","status":"done"}`
	req := httptest.NewRequest("PATCH", "/api/files/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	updated, _ := os.ReadFile(dst)
	if !strings.Contains(string(updated), `data-task-id="3" data-task-status="done"`) {
		t.Error("task 3 was not toggled")
	}
}

func TestCORSHeaders(t *testing.T) {
	srv := NewServer(nil, nil)
	req := httptest.NewRequest("OPTIONS", "/api/health", nil)
	w := httptest.NewRecorder()

	srv.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS status = %d, want %d", w.Code, http.StatusNoContent)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("missing CORS origin header")
	}
}
