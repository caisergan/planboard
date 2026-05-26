package scanner

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

type Scanner struct {
	roots           []string
	scanPatterns    []string
	excludePatterns []string
}

type ProjectIndex map[string][]*FileMetadata

func New(roots, scanPatterns, excludePatterns []string) *Scanner {
	return &Scanner{
		roots:           roots,
		scanPatterns:    scanPatterns,
		excludePatterns: excludePatterns,
	}
}

func (s *Scanner) Scan() (ProjectIndex, error) {
	index := make(ProjectIndex)

	for _, root := range s.roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			projectName := entry.Name()
			projectPath := filepath.Join(root, projectName)
			files, err := s.scanProject(projectPath)
			if err != nil {
				continue
			}

			if len(files) > 0 {
				index[projectName] = files
			}
		}
	}

	return index, nil
}

func (s *Scanner) scanProject(projectPath string) ([]*FileMetadata, error) {
	var files []*FileMetadata

	for _, pattern := range s.scanPatterns {
		fullPattern := filepath.Join(projectPath, pattern)
		matches, err := doublestar.FilepathGlob(fullPattern)
		if err != nil {
			continue
		}

		for _, match := range matches {
			if s.isExcluded(match) {
				continue
			}

			var meta *FileMetadata
			var extractErr error

			switch filepath.Ext(match) {
			case ".html":
				meta, extractErr = ExtractHTMLMetadata(match)
			case ".md":
				meta, extractErr = ExtractMDMetadata(match)
			default:
				continue
			}

			if extractErr != nil {
				continue
			}

			meta.Path = match
			files = append(files, meta)
		}
	}

	return files, nil
}

func (s *Scanner) isExcluded(path string) bool {
	for _, pattern := range s.excludePatterns {
		if strings.Contains(path, string(filepath.Separator)+pattern+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

func (s *Scanner) WatchDirs() ([]string, error) {
	var dirs []string
	seen := make(map[string]bool)

	for _, root := range s.roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			projectPath := filepath.Join(root, entry.Name())
			filepath.WalkDir(projectPath, func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return nil
				}
				if !d.IsDir() {
					return nil
				}
				if s.isExcluded(path + string(filepath.Separator)) {
					return filepath.SkipDir
				}
				base := filepath.Base(path)
				if base == "docs" || strings.Contains(path, string(filepath.Separator)+"docs"+string(filepath.Separator)) {
					if !seen[path] {
						dirs = append(dirs, path)
						seen[path] = true
					}
				}
				return nil
			})
		}
	}

	return dirs, nil
}
