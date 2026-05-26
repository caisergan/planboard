package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	content := []byte(`{
		"roots": ["~/projects", "/absolute/path"],
		"scan_patterns": ["docs/**/*.html", "docs/**/*.md"],
		"exclude_patterns": ["node_modules", ".git"],
		"server": {"port": 8080, "frontend_port": 5173},
		"watch": {"debounce_ms": 100}
	}`)
	if err := os.WriteFile(cfgPath, content, 0644); err != nil {
		t.Fatalf("setup: write config: %v", err)
	}

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want 8080", cfg.Server.Port)
	}
	if len(cfg.Roots) != 2 {
		t.Errorf("len(Roots) = %d, want 2", len(cfg.Roots))
	}
}

func TestLoadConfig_MergesWithDefaults(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	content := []byte(`{"roots": ["~/code"]}`)
	if err := os.WriteFile(cfgPath, content, 0644); err != nil {
		t.Fatalf("setup: write config: %v", err)
	}

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want default 8080", cfg.Server.Port)
	}
	if cfg.Watch.DebounceMs != 100 {
		t.Errorf("Watch.DebounceMs = %d, want default 100", cfg.Watch.DebounceMs)
	}
	if len(cfg.ScanPatterns) != 2 {
		t.Errorf("ScanPatterns = %d, want default 2", len(cfg.ScanPatterns))
	}
}

func TestLoadConfig_FileNotFound(t *testing.T) {
	_, err := Load("/nonexistent/path/config.json")
	if err == nil {
		t.Error("Load() expected error for nonexistent file, got nil")
	}
}

func TestLoadConfig_MalformedJSON(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	if err := os.WriteFile(cfgPath, []byte(`{not valid json`), 0644); err != nil {
		t.Fatalf("setup: write config: %v", err)
	}

	_, err := Load(cfgPath)
	if err == nil {
		t.Error("Load() expected error for malformed JSON, got nil")
	}
}

func TestExpandTilde(t *testing.T) {
	home, _ := os.UserHomeDir()
	result := expandTilde("~/projects")
	expected := filepath.Join(home, "projects")
	if result != expected {
		t.Errorf("expandTilde(~/projects) = %q, want %q", result, expected)
	}
}

func TestExpandTilde_BareHome(t *testing.T) {
	home, _ := os.UserHomeDir()
	result := expandTilde("~")
	if result != home {
		t.Errorf("expandTilde(~) = %q, want %q", result, home)
	}
}

func TestExpandTilde_NoTilde(t *testing.T) {
	result := expandTilde("/absolute/path")
	if result != "/absolute/path" {
		t.Errorf("expandTilde(/absolute/path) = %q, want /absolute/path", result)
	}
}

func TestExpandTilde_TildeUser(t *testing.T) {
	result := expandTilde("~otheruser/foo")
	if result != "~otheruser/foo" {
		t.Errorf("expandTilde(~otheruser/foo) = %q, want ~otheruser/foo (should not expand)", result)
	}
}

func TestLoadConfig_ExpandsRoots(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	content := []byte(`{
		"roots": ["~/projects"],
		"scan_patterns": ["docs/**/*.html"],
		"exclude_patterns": [],
		"server": {"port": 8080, "frontend_port": 5173},
		"watch": {"debounce_ms": 100}
	}`)
	if err := os.WriteFile(cfgPath, content, 0644); err != nil {
		t.Fatalf("setup: write config: %v", err)
	}

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, "projects")
	if cfg.Roots[0] != expected {
		t.Errorf("Roots[0] = %q, want %q", cfg.Roots[0], expected)
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := Default()
	if cfg.Server.Port != 8080 {
		t.Errorf("Default().Server.Port = %d, want 8080", cfg.Server.Port)
	}
	if cfg.Watch.DebounceMs != 100 {
		t.Errorf("Default().Watch.DebounceMs = %d, want 100", cfg.Watch.DebounceMs)
	}
	if len(cfg.ScanPatterns) != 2 {
		t.Errorf("Default().ScanPatterns = %d, want 2", len(cfg.ScanPatterns))
	}
}

func TestSaveConfig(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "subdir", "config.json")

	cfg := Default()
	cfg.Roots = []string{"~/test"}

	if err := cfg.Save(cfgPath); err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	loaded, err := Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() after Save() error: %v", err)
	}

	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, "test")
	if loaded.Roots[0] != expected {
		t.Errorf("Roots[0] after save/load = %q, want %q", loaded.Roots[0], expected)
	}
}

func TestConfigPath(t *testing.T) {
	path, err := ConfigPath()
	if err != nil {
		t.Fatalf("ConfigPath() error: %v", err)
	}

	if !strings.HasSuffix(path, filepath.Join(".config", "planboard", "config.json")) {
		t.Errorf("ConfigPath() = %q, want suffix .config/planboard/config.json", path)
	}
}
