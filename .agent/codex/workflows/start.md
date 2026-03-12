---
description: Start a new feature or bugfix branch from main
---

When starting new work, use this flow:

1. If branch type is missing, ask whether this is `feature` or `fix`.
2. If short name is missing, request kebab-case name (example: `add-catalog-search`).
3. Map prefixes:
   - `feature` or `feat` -> `feature/`
   - `fix`, `bugfix`, or `bug` -> `fix/`
4. Run `git checkout main`.
5. Run `git pull`.
6. Run `git checkout -b <prefix><name>`.
7. Confirm branch name and list expected scope before code changes.
