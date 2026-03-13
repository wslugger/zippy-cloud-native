# Agent Workflow Rules

## Branch Start Trigger
- If the first actionable user request in a new conversation starts with `start `, treat it as a branch-start instruction.
- Before making any code edits, run:
  - `npm run workflow:start -- feature <kebab-name>`
- Derive `<kebab-name>` from the text after `start ` by lowercasing and converting spaces/underscores to hyphens.
- If the derived name would be empty or invalid, ask for a kebab-case short name before editing.
- Do not continue implementation on `main` when this trigger is present.

