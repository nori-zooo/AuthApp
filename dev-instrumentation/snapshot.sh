#!/usr/bin/env bash

# Snapshot current instrumented node_modules files into dev-instrumentation/patches.
# Usage: ./dev-instrumentation/snapshot.sh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PATCH_DIR="$ROOT_DIR/dev-instrumentation/patches/node_modules"
mkdir -p "$PATCH_DIR/@expo/metro-config/build"
mkdir -p "$PATCH_DIR/react-native-css-interop/dist/metro"

cp "$ROOT_DIR/node_modules/@expo/metro-config/build/babel-transformer.js" "$PATCH_DIR/@expo/metro-config/build/babel-transformer.js" || true
cp "$ROOT_DIR/node_modules/react-native-css-interop/dist/metro/index.js" "$PATCH_DIR/react-native-css-interop/dist/metro/index.js" || true
cp "$ROOT_DIR/node_modules/react-native-css-interop/dist/runtime/native/styles.js" "$PATCH_DIR/react-native-css-interop/dist/runtime/native/styles.js" || true

echo "Snapshot complete. Check $PATCH_DIR for files."
