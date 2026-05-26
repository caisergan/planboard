#!/bin/bash
# planboard-sync.sh — Claude Code hook for mid-session plan change detection
# Install: planboard install-hook
# Hook type: user-prompt-submit

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
