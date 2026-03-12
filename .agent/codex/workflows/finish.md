---
description: Test, commit, merge, push, and clean up current branch
---

When finishing work, use this flow:

1. If no commit description is provided, request a one-line summary.
2. Capture current branch with `git rev-parse --abbrev-ref HEAD`.
3. If branch is `main`, stop (nothing to finish).
4. Run project tests (`npm test`, or targeted suite when global tests are unavailable).
5. Run `git status --short` and stage intentionally:
   - `git add -u` for tracked changes
   - `git add <new-file>` for intentional new files
6. Commit prefix by branch:
   - `feature/` -> `feat:`
   - `fix/` -> `fix:`
   - otherwise -> `chore:`
7. Commit with format:
   - `<prefix> <description>`
   - optional co-author lines only when requested
8. Run `git checkout main`.
9. Merge with `git merge <branch-name> --no-ff -m "Merge <branch-name>"`.
10. Run `git push origin main`.
11. Delete local branch with `git branch -d <branch-name>`.
12. Confirm: branch name, test status, commit message, and push result.
