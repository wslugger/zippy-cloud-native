# Local Branch And Deploy Workflow Skill

Use this skill when the user asks to manage day-to-day branch work and deploy safety from the code window.

## Goals

- Start and finish branches consistently.
- Enforce fast local quality checks before push/merge.
- Validate migration safety before deploy-related changes.

## Commands

- Start branch:
  - `npm run workflow:start -- feature <kebab-name>`
  - Optional base tests: add `--run-tests`
- Finish branch:
  - `npm run workflow:finish -- --message "<summary>"`
- Strict finish (release-ready):
  - `npm run workflow:finish:strict -- --message "<summary>"`
- Taskfile shortcuts:
  - `make start TYPE=feature NAME=<kebab-name>`
  - `make finish MSG="<summary>"`
  - `make finish-strict MSG="<summary>"`

## Push Checks

- Pre-push hook runs `npm test`.
- Optional lint on changed files:
  - `RUN_LINT_ON_PUSH=1 git push`

## Deploy Safety

- Run migration connectivity/lock check:
  - `make deploy-check DATABASE_URL="<url>"`

## Branch Protection

- Apply required CI status check policy to `main`:
  - `make protect-main`
  - Optional custom check context: `make protect-main CHECK="<context>"`
