package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/caisergan/planboard/internal/api"
	"github.com/caisergan/planboard/internal/config"
	"github.com/caisergan/planboard/internal/fileio"
	"github.com/caisergan/planboard/internal/scanner"
	"github.com/caisergan/planboard/internal/watcher"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--init":
			return runInit()
		case "convert":
			if len(os.Args) < 3 {
				return fmt.Errorf("usage: planboard convert <file.md>")
			}
			return runConvert(os.Args[2])
		case "scan":
			return runScan()
		case "init":
			return runProjectInit()
		case "install-hook":
			return runInstallHook()
		}
	}
	return runServer()
}

func runInit() error {
	cfgPath, err := config.ConfigPath()
	if err != nil {
		return err
	}
	cfg := config.Default()
	if err := cfg.Save(cfgPath); err != nil {
		return err
	}
	fmt.Printf("Config created at %s\n", cfgPath)
	return nil
}

func runConvert(mdPath string) error {
	abs, err := filepath.Abs(mdPath)
	if err != nil {
		return err
	}
	htmlPath := strings.TrimSuffix(abs, filepath.Ext(abs)) + ".html"
	if err := fileio.ConvertMDToHTML(abs, htmlPath); err != nil {
		return err
	}
	fmt.Printf("Converted: %s -> %s\n", abs, htmlPath)
	return nil
}

func runScan() error {
	cfgPath, err := config.ConfigPath()
	if err != nil {
		return err
	}
	cfg, err := config.Load(cfgPath)
	if err != nil {
		return err
	}
	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		return err
	}
	for name, files := range index {
		fmt.Printf("%s (%d files)\n", name, len(files))
		for _, f := range files {
			status := f.Status
			if status == "" {
				status = "-"
			}
			fmt.Printf("  %s [%s] %s\n", f.Title, f.Type, status)
		}
	}
	if len(index) == 0 {
		fmt.Println("No plan/spec files found. Check your config roots.")
	}
	return nil
}

func runProjectInit() error {
	fmt.Println("Project init: creates .planboard-active (not yet implemented)")
	return nil
}

func runInstallHook() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot determine home directory: %w", err)
	}

	hookDir := filepath.Join(home, ".config", "planboard", "hooks")
	if err := os.MkdirAll(hookDir, 0755); err != nil {
		return err
	}

	hookPath := filepath.Join(hookDir, "planboard-sync.sh")
	hookContent := `#!/bin/bash
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ -f "$PROJECT_DIR/.planboard-active" ]; then
  PLAN_FILE="$PROJECT_DIR/$(cat "$PROJECT_DIR/.planboard-active")"
else
  PLAN_FILE=$(find "$PROJECT_DIR/docs" -name "*.html" -path "*/plans/*" 2>/dev/null | sort -r | head -1)
fi

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  exit 0
fi

if command -v md5sum &>/dev/null; then
  HASH=$(echo "$PROJECT_DIR" | md5sum | cut -c1-8)
elif command -v md5 &>/dev/null; then
  HASH=$(md5 -q -s "$PROJECT_DIR")
else
  HASH=$(echo "$PROJECT_DIR" | cksum | cut -d' ' -f1)
fi

STATE_FILE="/tmp/planboard-mtime-$HASH"

if [ "$(uname)" = "Darwin" ]; then
  CURRENT_MTIME=$(stat -f %m "$PLAN_FILE" 2>/dev/null)
else
  CURRENT_MTIME=$(stat -c %Y "$PLAN_FILE" 2>/dev/null)
fi

if [ -f "$STATE_FILE" ]; then
  LAST_MTIME=$(cat "$STATE_FILE")
  if [ "$CURRENT_MTIME" != "$LAST_MTIME" ]; then
    echo "PLANBOARD: Plan file was modified externally."
    echo "  File: $PLAN_FILE"
    echo "  Re-read this file for updated task states."
  fi
fi

echo "$CURRENT_MTIME" > "$STATE_FILE"
`

	if err := os.WriteFile(hookPath, []byte(hookContent), 0755); err != nil {
		return err
	}

	fmt.Printf("Hook installed at %s\n", hookPath)
	fmt.Println("Add to your .claude/settings.json:")
	fmt.Println(`  "hooks": { "user-prompt-submit": [{ "command": "` + hookPath + `" }] }`)
	return nil
}

func runServer() error {
	cfgPath, err := config.ConfigPath()
	if err != nil {
		return err
	}
	cfg, err := config.Load(cfgPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("No config found. Run `planboard --init` to create one.")
			return nil
		}
		return fmt.Errorf("loading config: %w", err)
	}

	s := scanner.New(cfg.Roots, cfg.ScanPatterns, cfg.ExcludePatterns)
	index, err := s.Scan()
	if err != nil {
		return fmt.Errorf("scanning: %w", err)
	}

	totalFiles := 0
	for _, files := range index {
		totalFiles += len(files)
	}
	log.Printf("Scanned %d projects, %d files", len(index), totalFiles)

	hub := api.NewHub()
	go hub.Run()

	srv := api.NewServerWithHub(index, cfg, hub)

	watchDirs, _ := s.WatchDirs()
	if len(watchDirs) > 0 {
		events := make(chan watcher.Event, 100)
		w, err := watcher.New(watchDirs, time.Duration(cfg.Watch.DebounceMs)*time.Millisecond, events)
		if err != nil {
			log.Printf("Warning: file watcher failed to start: %v", err)
		} else {
			go w.Start()
			go func() {
				for ev := range events {
					evType := "file-changed"
					switch ev.Type {
					case watcher.FileAdded:
						evType = "file-added"
					case watcher.FileDeleted:
						evType = "file-deleted"
					}
					hub.Broadcast(api.WSEvent{
						Type:    evType,
						Path:    ev.Path,
						Project: ev.Project,
					})
				}
			}()
			defer w.Close()
		}
	}

	addr := fmt.Sprintf("127.0.0.1:%d", cfg.Server.Port)

	var handler http.Handler
	apiHandler := srv.Handler()
	devMode := os.Getenv("PLANBOARD_DEV") == "1"

	if devMode {
		handler = apiHandler
	} else {
		static := staticFileHandler()
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/ws" {
				apiHandler.ServeHTTP(w, r)
				return
			}
			static.ServeHTTP(w, r)
		})
	}

	httpSrv := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	go func() {
		log.Printf("Planboard running at http://%s", addr)
		if err := httpSrv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return httpSrv.Shutdown(ctx)
}
