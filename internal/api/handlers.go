package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/caisergan/planboard/internal/fileio"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	projects := make([]ProjectSummary, 0, len(s.index))
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

	if !s.isPathAllowed(req.Path) {
		http.Error(w, "path outside configured roots", http.StatusForbidden)
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

	result, err := fileio.ReadFile(htmlPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.cfg)
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
