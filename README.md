# Zippy Cloud-Native

Cloud-native quoting and BOM generator for Solution Architects. Browse a catalog of services and packages, configure design options, manage multi-site projects, and calculate pricing with automatic dependency resolution.

Built with Next.js 16, React 19, Prisma 7, PostgreSQL, and deployed on Google Cloud Run.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or [Neon](https://neon.tech) for serverless)
- npm 10+

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url> && cd zippy-cloud-native
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL, ADMIN_PASSPHRASE, and JWT_SECRET (>=32 chars)
   ```

4. Set up the database:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Branch Workflow (Code Window)

Use these local commands from the terminal/code window:

1. Start work on a new branch:
   - `npm run workflow:start -- feature add-catalog-search`
   - optional base validation: `npm run workflow:start -- feature add-catalog-search --run-tests`
   - conversational trigger: first prompt starting with `start <name>` should create `feature/<name>` before edits
2. Finish work (test, commit, merge to `main`, push):
   - `npm run workflow:finish -- --message "add catalog search"`
   - include new files: `npm run workflow:finish -- --message "add catalog search" --include-untracked`
   - stricter checks: add `--run-lint` and/or `--run-build`
   - cleanup branch after merge: add `--delete-branch`

Slash workflows `/start` and `/finish` are wired to these commands in:

- `.agents/workflows/start.md`
- `.agents/workflows/finish.md`

GitHub CI still validates `main` with lint, tests, and build in `.github/workflows/ci.yml`.

## Local Automation

- Husky pre-push hook runs `npm test` and `npm run build` automatically.
- Build uses a dummy DB URL to mirror CI behavior:
  - `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm run build`
- Emergency bypass for local build gate:
  - `SKIP_BUILD_ON_PUSH=1 git push`
- Optional changed-file lint on push:
  - `RUN_LINT_ON_PUSH=1 git push`

Common task shortcuts are available via `Makefile`:

- `make start TYPE=feature NAME=add-catalog-search [RUN_TESTS=1]`
- `make finish MSG="add catalog search" [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]`
- `make finish-strict MSG="add catalog search" [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]`
- `make test`, `make lint`, `make lint-changed`, `make build`, `make deploy-check`

## PR And Branch Policy

- PR template is enabled via:
  - `.github/pull_request_template.md`
- Apply required CI check policy on `main`:
  - `make protect-main`
  - optional context override: `make protect-main CHECK="build"`

## Lint Performance

- Full lint uses ESLint cache:
  - `npm run lint`
- Changed-file lint also uses cache:
  - `npm run lint:changed`

## Migration Safety

- Run lock/connectivity guard before migrations:
  - `make deploy-check DATABASE_URL="<postgres-url>"`
- Deploy workflow also runs this guard before `prisma migrate deploy`.
