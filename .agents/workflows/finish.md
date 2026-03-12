---
description: Test, commit, merge, push, and clean up the current feature or bugfix branch
---
// turbo-all
When the user wants to finish their current branch, follow these steps:

1. If the user hasn't provided a commit description, ask for a brief one-liner describing the work.
2. Run `npm run workflow:finish -- --message "<description>"`.
3. By default, the script runs tests (`npm test`), commits staged tracked changes with a branch-based prefix, merges into `main`, and pushes `main`.
4. If there are intentional new files, include `--include-untracked`.
5. If stricter checks are requested, include `--run-lint` and/or `--run-build`.
6. If cleanup is requested, include `--delete-branch` to delete the source branch locally and on origin.
7. Confirm to the user: branch name, commit message used, and push result.
