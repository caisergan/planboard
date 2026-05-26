package fileio

import (
	"os"
	"path/filepath"

	"github.com/caisergan/planboard/internal/scanner"
)

type FileResult struct {
	Content  string                `json:"content"`
	Format   string                `json:"format"`
	Metadata *scanner.FileMetadata `json:"metadata"`
}

func ReadFile(path string) (*FileResult, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	ext := filepath.Ext(path)
	format := "html"
	if ext == ".md" {
		format = "md"
	}

	var meta *scanner.FileMetadata
	switch format {
	case "html":
		meta, err = scanner.ExtractHTMLMetadata(path)
	case "md":
		meta, err = scanner.ExtractMDMetadata(path)
	}
	if err != nil {
		return nil, err
	}

	return &FileResult{
		Content:  string(content),
		Format:   format,
		Metadata: meta,
	}, nil
}
