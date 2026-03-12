# Skill: Deploy Infrastructure (Cloud Run + Database)

## Goal
Deploy Zippy reliably to Google Cloud Run with safe database migrations and repeatable CI/CD behavior.

## Preconditions
- `Dockerfile` builds Next.js standalone image and exposes `8080`
- `DATABASE_URL` and required app secrets are available
- Workload Identity Federation is configured for GitHub Actions

## Workflow
1. Validate local build contract:
   - `npm ci`
   - `npm run build`
   - Confirm runtime binds to `PORT` and app starts with production env.
2. Verify Docker dependencies for native modules (for example Prisma, bcrypt, sharp): add Alpine packages as needed.
3. Ensure Artifact Registry path variables are sanitized in CI before use.
4. Run database migrations in CI with explicit step env injection:
   - `env: DATABASE_URL: ${{ secrets.DATABASE_URL }}`
   - `npm ci && npx prisma migrate deploy`
5. Confirm deploy identity has least required roles:
   - `roles/run.admin`
   - `roles/iam.serviceAccountUser`
   - `roles/artifactregistry.writer`
6. Deploy Cloud Run revision and verify health/logs before promoting traffic.

## Failure Triage
- Auth failures: validate WIF provider string, service account, and principal bindings.
- Build failures: inspect missing Alpine packages or incorrect Docker context.
- Runtime failures: inspect Cloud Run logs for startup crash due to env or database connectivity.
- Migration failures: check DB reachability and Prisma binary compatibility in container.
