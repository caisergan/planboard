package watcher

import (
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/caisergan/planboard/internal/fileio"
	"github.com/fsnotify/fsnotify"
)

type EventType int

const (
	FileChanged EventType = iota
	FileAdded
	FileDeleted
)

type Event struct {
	Type    EventType
	Path    string
	Project string
}

type Watcher struct {
	fsw      *fsnotify.Watcher
	debounce time.Duration
	events   chan<- Event
	pending  map[string]*time.Timer
	mu       sync.Mutex
	done     chan struct{}
}

func New(dirs []string, debounce time.Duration, events chan<- Event) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	for _, dir := range dirs {
		if err := fsw.Add(dir); err != nil {
			fsw.Close()
			return nil, err
		}
	}

	return &Watcher{
		fsw:      fsw,
		debounce: debounce,
		events:   events,
		pending:  make(map[string]*time.Timer),
		done:     make(chan struct{}),
	}, nil
}

func (w *Watcher) Start() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case err, ok := <-w.fsw.Errors:
			if ok && err != nil {
				log.Printf("watcher error: %v", err)
			}
		case <-ticker.C:
			fileio.CleanSelfWrites()
		case <-w.done:
			return
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	ext := filepath.Ext(event.Name)
	if ext != ".html" && ext != ".md" {
		return
	}

	if fileio.IsSelfWrite(event.Name) {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if timer, exists := w.pending[event.Name]; exists {
		timer.Stop()
	}

	op := event.Op
	w.pending[event.Name] = time.AfterFunc(w.debounce, func() {
		w.mu.Lock()
		delete(w.pending, event.Name)
		w.mu.Unlock()

		var evType EventType
		switch {
		case op&fsnotify.Create != 0:
			evType = FileAdded
		case op&fsnotify.Remove != 0 || op&fsnotify.Rename != 0:
			evType = FileDeleted
		default:
			evType = FileChanged
		}

		w.events <- Event{
			Type: evType,
			Path: event.Name,
		}
	})
}

func (w *Watcher) AddDir(dir string) error {
	return w.fsw.Add(dir)
}

func (w *Watcher) Close() {
	close(w.done)
	w.fsw.Close()
}
