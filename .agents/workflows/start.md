---
description: Start a new feature or bugfix branch from main
---
// turbo-all
When the user wants to start a new branch, follow these steps:

1. If the user hasn't provided a branch type, ask: "Is this a feature or a bugfix?" Accept "feature", "feat", "fix", "bugfix", or "bug" as valid answers.
2. If the user hasn't provided a short name, ask for one (kebab-case, e.g. "add-catalog-search").
3. Map the type to a prefix: feature/feat → `feature/`, fix/bugfix/bug → `fix/`.
4. Run `git checkout main` to ensure you are on the main branch.
5. Run `git pull` to fetch the latest changes.
6. Run `git checkout -b <prefix><name>` to create and switch to the new branch.
7. Confirm the branch name to the user and tell them they're ready to code.
