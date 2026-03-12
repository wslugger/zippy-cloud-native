---
description: Start a new feature or bugfix branch from main
---

When starting new work, use this flow:

1. If branch type is missing, ask whether this is `feature` or `fix`.
2. If short name is missing, request kebab-case name (example: `add-catalog-search`).
3. Run `npm run workflow:start -- <type> <name>`.
4. Add `--run-tests` only when base branch verification is requested.
5. Confirm branch name and list expected scope before code changes.
