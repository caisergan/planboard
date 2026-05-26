package fileio

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	selfWrites    sync.Map
	taskLineRe    = regexp.MustCompile(`(<li\s+data-task-id="(\d+)"\s+data-task-status=")([^"]+)(")`)
	metaCountRe   = regexp.MustCompile(`(<meta\s+name="planboard:(completed-tasks|total-tasks)"\s+content=")(\d+)(")`)
	metaStatusRe  = regexp.MustCompile(`(<meta\s+name="planboard:status"\s+content=")([^"]+)(")`)
	phaseBlockRe  = regexp.MustCompile(`(?s)(<div\s+data-phase="\d+"\s+data-phase-status=")([^"]+)(".*?</div>)`)
)

func ToggleTask(path, taskID, newStatus string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	html := string(content)

	targetPattern := fmt.Sprintf(`data-task-id="%s" data-task-status="`, taskID)
	if !strings.Contains(html, targetPattern) {
		return fmt.Errorf("task %s not found in %s", taskID, path)
	}

	html = taskLineRe.ReplaceAllStringFunc(html, func(match string) string {
		groups := taskLineRe.FindStringSubmatch(match)
		if groups[2] == taskID {
			return groups[1] + newStatus + groups[4]
		}
		return match
	})

	html = recomputeMetaCounts(html)
	html = recomputePhaseStatuses(html)

	return atomicWrite(path, []byte(html))
}

func recomputeMetaCounts(html string) string {
	matches := taskLineRe.FindAllStringSubmatch(html, -1)
	total := len(matches)
	completed := 0
	active := 0
	for _, m := range matches {
		switch m[3] {
		case "done":
			completed++
		case "active":
			active++
		}
	}

	html = metaCountRe.ReplaceAllStringFunc(html, func(match string) string {
		groups := metaCountRe.FindStringSubmatch(match)
		switch groups[2] {
		case "total-tasks":
			return groups[1] + strconv.Itoa(total) + groups[4]
		case "completed-tasks":
			return groups[1] + strconv.Itoa(completed) + groups[4]
		}
		return match
	})

	var newStatus string
	switch {
	case total > 0 && completed == total:
		newStatus = "done"
	case completed > 0 || active > 0:
		newStatus = "in-progress"
	default:
		newStatus = "pending"
	}
	html = metaStatusRe.ReplaceAllString(html, "${1}"+newStatus+"${3}")

	return html
}

func recomputePhaseStatuses(html string) string {
	return phaseBlockRe.ReplaceAllStringFunc(html, func(match string) string {
		phaseMatches := taskLineRe.FindAllStringSubmatch(match, -1)
		taskCount := len(phaseMatches)
		doneCount := 0
		activeCount := 0
		for _, m := range phaseMatches {
			switch m[3] {
			case "done":
				doneCount++
			case "active":
				activeCount++
			}
		}

		var status string
		switch {
		case taskCount == 0:
			status = "pending"
		case doneCount == taskCount:
			status = "done"
		case doneCount > 0 || activeCount > 0:
			status = "in-progress"
		default:
			status = "pending"
		}

		groups := phaseBlockRe.FindStringSubmatch(match)
		return groups[1] + status + groups[3]
	})
}

func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".planboard-tmp-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	selfWrites.Store(path, time.Now())
	return nil
}

func IsSelfWrite(path string) bool {
	val, ok := selfWrites.Load(path)
	if !ok {
		return false
	}
	writeTime := val.(time.Time)
	if time.Since(writeTime) < 500*time.Millisecond {
		return true
	}
	selfWrites.Delete(path)
	return false
}

func CleanSelfWrites() {
	selfWrites.Range(func(key, val any) bool {
		writeTime := val.(time.Time)
		if time.Since(writeTime) > 5*time.Second {
			selfWrites.Delete(key)
		}
		return true
	})
}
