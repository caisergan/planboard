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
	httpSrv := &http.Server{
		Addr:    addr,
		Handler: srv.Handler(),
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
