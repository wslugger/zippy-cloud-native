---
description: Start a new feature or bugfix branch from main
---
// turbo-all
When the user wants to start a new branch, follow these steps:

1. If the user hasn't provided a branch type, ask: "Is this a feature or a bugfix?" Accept "feature", "feat", "fix", "bugfix", or "bug" as valid answers.
2. If the user hasn't provided a short name, ask for one (kebab-case, e.g. "add-catalog-search").
3. Run `npm run workflow:start -- <type> <name>`.
4. If the user asks to verify base health first, add `--run-tests`.
5. Confirm the created branch name to the user and tell them they're ready to code.
