package scanner

import (
	"bufio"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

type FileMetadata struct {
	Title          string `json:"title"`
	Type           string `json:"type"`
	Project        string `json:"project"`
	Created        string `json:"created"`
	Status         string `json:"status"`
	TotalTasks     int    `json:"total_tasks"`
	CompletedTasks int    `json:"completed_tasks"`
	Version        int    `json:"version"`
	Path           string `json:"path"`
	Format         string `json:"format"`
}

func ExtractHTMLMetadata(path string) (*FileMetadata, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	meta := &FileMetadata{
		Path:   path,
		Format: "html",
	}

	tokenizer := html.NewTokenizer(f)
	inHead := false

	for {
		tt := tokenizer.Next()
		switch tt {
		case html.ErrorToken:
			if err := tokenizer.Err(); err != nil && err != io.EOF {
				return meta, err
			}
			return meta, nil
		case html.StartTagToken, html.SelfClosingTagToken:
			tn, hasAttr := tokenizer.TagName()
			tagName := string(tn)

			if tagName == "head" {
				inHead = true
				continue
			}
			if tagName == "html" && hasAttr {
				for {
					key, val, more := tokenizer.TagAttr()
					if string(key) == "data-planboard-version" {
						meta.Version, _ = strconv.Atoi(string(val))
					}
					if !more {
						break
					}
				}
				continue
			}
			if tagName == "title" && inHead {
				tokenizer.Next()
				meta.Title = strings.TrimSpace(tokenizer.Token().Data)
				continue
			}
			if tagName == "meta" && inHead && hasAttr {
				var name, content string
				for {
					key, val, more := tokenizer.TagAttr()
					switch string(key) {
					case "name":
						name = string(val)
					case "content":
						content = string(val)
					}
					if !more {
						break
					}
				}
				if strings.HasPrefix(name, "planboard:") {
					field := strings.TrimPrefix(name, "planboard:")
					switch field {
					case "type":
						meta.Type = content
					case "project":
						meta.Project = content
					case "created":
						meta.Created = content
					case "status":
						meta.Status = content
					case "total-tasks":
						meta.TotalTasks, _ = strconv.Atoi(content)
					case "completed-tasks":
						meta.CompletedTasks, _ = strconv.Atoi(content)
					}
				}
				continue
			}
		case html.EndTagToken:
			tn, _ := tokenizer.TagName()
			if string(tn) == "head" {
				return meta, nil
			}
		}
	}
}

func ExtractMDMetadata(path string) (*FileMetadata, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	meta := &FileMetadata{
		Path:   path,
		Format: "md",
		Title:  strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
	}

	sc := bufio.NewScanner(f)
	if !sc.Scan() {
		return meta, nil
	}

	if strings.TrimSpace(sc.Text()) != "---" {
		return meta, nil
	}

	for sc.Scan() {
		line := sc.Text()
		if strings.TrimSpace(line) == "---" {
			break
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch key {
		case "title":
			meta.Title = val
		case "type":
			meta.Type = val
		case "project":
			meta.Project = val
		case "status":
			meta.Status = val
		case "date":
			meta.Created = val
		}
	}

	return meta, nil
}
