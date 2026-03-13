---
description: Start a new feature or bugfix branch from main
---

When starting new work, use this flow:

1. If the first actionable user message starts with `start `, treat it as a branch kickoff.
2. For `start <name>` with no explicit type, default to `feature`.
3. Normalize `<name>` to kebab-case and run `npm run workflow:start -- <type> <name>` before any code edits.
4. If branch type is missing outside the `start <name>` pattern, ask whether this is `feature` or `fix`.
5. If short name is missing or cannot be normalized safely, request a kebab-case name (example: `add-catalog-search`).
6. Add `--run-tests` only when base branch verification is requested.
7. Confirm branch name and list expected scope before code changes.
