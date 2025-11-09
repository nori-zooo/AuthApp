This folder contains tooling to safely apply and revert development instrumentation that was
temporarily added to files under `node_modules/` for debugging the nativewind / css-interop
pipeline.

Usage
- Apply instrumentation (copies files from this folder into node_modules and backs up originals):
  npm run dev:instrument-apply

- Revert instrumentation (restores backups made when applying instrumentation):
  npm run dev:instrument-revert

Notes
- These scripts are intended for local development only. Do not commit changes to node_modules
  into source control. Use `dev:instrument-revert` before committing or sharing the repo.
