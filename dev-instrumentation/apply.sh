#!/usr/bin/env bash

# Apply instrumentation: copy prepared files into node_modules, backing up originals.
# Run from project root: ./dev-instrumentation/apply.sh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
INSTR_DIR="$ROOT_DIR/dev-instrumentation/patches"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"
BACKUP_DIR="$ROOT_DIR/dev-instrumentation/backups"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$INSTR_DIR" ]; then
  echo "No patches found in $INSTR_DIR"
  exit 0
fi

for f in $(find "$INSTR_DIR" -type f); do
  rel=${f#"$INSTR_DIR"}
  target="$NODE_MODULES_DIR$rel"
  target_dir=$(dirname "$target")
  backup="$BACKUP_DIR$rel.bak"

  mkdir -p "$target_dir"
  mkdir -p "$(dirname "$backup")"

  if [ -f "$target" ] && [ ! -f "$backup" ]; then
    echo "Backing up $target -> $backup"
    cp "$target" "$backup"
  fi

  echo "Applying $f -> $target"
  cp "$f" "$target"
done

echo "Instrumentation applied. Use dev-instrumentation/revert.sh to revert changes."
