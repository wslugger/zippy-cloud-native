---
description: Test, commit, merge, push, and clean up the current feature or bugfix branch
---
// turbo-all
When the user wants to finish their current branch, follow these steps:

1. If the user hasn't provided a commit description, ask for a brief one-liner describing the work.
2. Run `git rev-parse --abbrev-ref HEAD` to capture the current branch name. If it is `main`, stop and tell the user they are already on main — nothing to finish.
3. Run `npm test` to execute the test suite. If tests fail, stop and show the user the failure output — do not commit.
4. Run `git status --short` to show what changed. Stage only modified and new tracked files: run `git add -u` to stage deletions and modifications, then `git add` for any intentional new files the user has mentioned. Do NOT run `git add .`.
5. Determine the commit prefix from the branch name: branches starting with `feature/` use `feat:`, branches starting with `fix/` use `fix:`, anything else uses `chore:`.
6. Run `git commit -m "<prefix> <description>\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`.
7. Run `git checkout main`.
8. Run `git merge <branch-name> --no-ff -m "Merge <branch-name>"` to merge with a merge commit.
9. Run `git push origin main`.
10. Run `git branch -d <branch-name>` to delete the local branch.
11. Confirm to the user: branch name, commit message used, and that main is now up to date.
