---
description: Test, commit, merge, push, and clean up current branch
---

When finishing work, use this flow:

1. If no commit description is provided, request a one-line summary.
2. Run `npm run workflow:finish -- --message "<description>"`.
3. Base behavior: run tests, commit staged tracked changes with branch-derived prefix, merge to `main`, and push.
4. If new files should be included, add `--include-untracked`.
5. For strict gates, add `--run-lint` and/or `--run-build`.
6. For branch cleanup, add `--delete-branch`.
7. Confirm: branch name, test status, commit message, and push result.
