#!/usr/bin/env bash

# Revert instrumentation: restore backups made by apply.sh
# Run from project root: ./dev-instrumentation/revert.sh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKUP_DIR="$ROOT_DIR/dev-instrumentation/backups"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "No backups found in $BACKUP_DIR"
  exit 0
fi

for f in $(find "$BACKUP_DIR" -type f -name "*.bak"); do
  rel=${f#"$BACKUP_DIR"}
  # rel starts with /node_modules/..., strip the leading /node_modules
  rel_stripped=${rel#"/node_modules"}
  # remove the trailing .bak from the filename when restoring
  target="$NODE_MODULES_DIR$rel_stripped"
  target_no_bak="${target%.bak}"
  echo "Restoring $f -> $target_no_bak"
  mkdir -p "$(dirname "$target_no_bak")"
  cp "$f" "$target_no_bak"
  rm -f "$f"
done

# Cleanup empty backup directories
find "$BACKUP_DIR" -type d -empty -delete || true

echo "Revert complete."
