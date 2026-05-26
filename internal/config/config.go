package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Roots           []string     `json:"roots"`
	ScanPatterns    []string     `json:"scan_patterns"`
	ExcludePatterns []string     `json:"exclude_patterns"`
	Server          ServerConfig `json:"server"`
	Watch           WatchConfig  `json:"watch"`
}

type ServerConfig struct {
	Port         int `json:"port"`
	FrontendPort int `json:"frontend_port"`
}

type WatchConfig struct {
	DebounceMs int `json:"debounce_ms"`
}

func Default() *Config {
	return &Config{
		Roots:           []string{},
		ScanPatterns:    []string{"docs/**/*.html", "docs/**/*.md"},
		ExcludePatterns: []string{"node_modules", ".git", "vendor"},
		Server:          ServerConfig{Port: 8080, FrontendPort: 5173},
		Watch:           WatchConfig{DebounceMs: 100},
	}
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	cfg := Default()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	for i, root := range cfg.Roots {
		cfg.Roots[i] = expandTilde(root)
	}

	return cfg, nil
}

func (c *Config) Save(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

func ConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}
	return filepath.Join(home, ".config", "planboard", "config.json"), nil
}

func expandTilde(path string) string {
	if path == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return home
	}
	if !strings.HasPrefix(path, "~/") {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	return filepath.Join(home, path[2:])
}
