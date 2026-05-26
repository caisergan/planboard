package fileio

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func ConvertMDToHTML(srcPath, dstPath string) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	var title, fileType, project, status, created string
	var lines []string
	inFrontmatter := false
	frontmatterDone := false

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()

		if !frontmatterDone && strings.TrimSpace(line) == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				frontmatterDone = true
				inFrontmatter = false
				continue
			}
		}

		if inFrontmatter {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				k, v := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
				switch k {
				case "title":
					title = v
				case "type":
					fileType = v
				case "project":
					project = v
				case "status":
					status = v
				case "date":
					created = v
				}
			}
			continue
		}

		lines = append(lines, line)
	}

	if title == "" {
		title = strings.TrimSuffix(filepath.Base(srcPath), filepath.Ext(srcPath))
	}
	if fileType == "" {
		fileType = "plan"
	}
	if status == "" {
		status = "pending"
	}
	if created == "" {
		created = time.Now().Format("2006-01-02")
	}

	taskID := 0
	totalTasks := 0
	completedTasks := 0
	var bodyLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "- [x]") || strings.HasPrefix(trimmed, "- [X]") {
			taskID++
			totalTasks++
			completedTasks++
			text := strings.TrimSpace(trimmed[5:])
			bodyLines = append(bodyLines, fmt.Sprintf(`        <li data-task-id="%d" data-task-status="done">%s</li>`, taskID, text))
		} else if strings.HasPrefix(trimmed, "- [ ]") {
			taskID++
			totalTasks++
			text := strings.TrimSpace(trimmed[5:])
			bodyLines = append(bodyLines, fmt.Sprintf(`        <li data-task-id="%d" data-task-status="pending">%s</li>`, taskID, text))
		} else if strings.HasPrefix(trimmed, "# ") && len(bodyLines) == 0 {
			// skip top-level heading (used as title)
		} else if strings.HasPrefix(trimmed, "## ") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <h2>%s</h2>`, trimmed[3:]))
		} else if strings.HasPrefix(trimmed, "### ") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <h3>%s</h3>`, trimmed[4:]))
		} else if trimmed != "" && !strings.HasPrefix(trimmed, "- [") {
			bodyLines = append(bodyLines, fmt.Sprintf(`    <p>%s</p>`, trimmed))
		}
	}

	phaseStatus := "pending"
	if completedTasks == totalTasks && totalTasks > 0 {
		phaseStatus = "done"
	} else if completedTasks > 0 {
		phaseStatus = "in-progress"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en" data-planboard-version="1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
  <meta name="planboard:type" content="%s">
  <meta name="planboard:project" content="%s">
  <meta name="planboard:created" content="%s">
  <meta name="planboard:status" content="%s">
  <meta name="planboard:total-tasks" content="%d">
  <meta name="planboard:completed-tasks" content="%d">
  <style>
    :root { --bg: #0f172a; --text: #e2e8f0; --accent: #818cf8; --success: #4ade80; --warning: #fbbf24; --muted: #64748b; }
    body { font-family: system-ui; background: var(--bg); color: var(--text); max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: var(--accent); }
    [data-task-status="done"] { text-decoration: line-through; color: var(--muted); }
  </style>
</head>
<body>
  <header data-section="header">
    <h1>%s</h1>
    <p class="meta">Project: %s | Created: %s | Status: %s</p>
  </header>
  <section data-section="phases">
    <div data-phase="1" data-phase-status="%s">
      <ul data-task-list>
%s
      </ul>
    </div>
  </section>
</body>
</html>`, title, fileType, project, created, status, totalTasks, completedTasks,
		title, project, created, status, phaseStatus,
		strings.Join(bodyLines, "\n"))

	return atomicWrite(dstPath, []byte(html))
}
