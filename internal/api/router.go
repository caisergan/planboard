package api

import (
	"net/http"
	"sync"

	"github.com/caisergan/planboard/internal/config"
	"github.com/caisergan/planboard/internal/scanner"
)

type Server struct {
	index   scanner.ProjectIndex
	cfg     *config.Config
	hub     *Hub
	scanner *scanner.Scanner
	mu      sync.RWMutex
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

func NewServerWithHub(index scanner.ProjectIndex, cfg *config.Config, hub *Hub, sc *scanner.Scanner) *Server {
	return &Server{
		index:   index,
		cfg:     cfg,
		hub:     hub,
		scanner: sc,
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
	mux.HandleFunc("POST /api/rescan", s.handleRescan)

	if s.hub != nil {
		mux.HandleFunc("/ws", s.handleWebSocket)
	}

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
