This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

- Husky pre-push hook runs `npm test` automatically.
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
