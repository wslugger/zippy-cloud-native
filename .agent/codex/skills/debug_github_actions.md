# Skill: Debug GitHub Actions for Cloud Run

## Goal
Diagnose and resolve CI/CD failures for build, migration, authentication, and deployment steps.

## 1. Authentication (Workload Identity Federation)
- Symptoms: `google-github-actions/auth` fails with `401` or `403`.
- Checks:
  - `WORKLOAD_IDENTITY_PROVIDER` value exactly matches the GCP provider resource.
  - `SERVICE_ACCOUNT` email is correct.
  - Service account has `roles/iam.workloadIdentityUser` for the repo principal set.
  - Attribute conditions allow the current repo and branch.

## 2. Build and Push
- Symptoms: Docker build/push fails or registry permission denied.
- Checks:
  - Registry hostname and repository path are valid.
  - GitHub secrets for region/project/repo are present and sanitized.
  - `.dockerignore` excludes large local artifacts but includes required app and Prisma files.
  - Docker image includes needed native build/runtime packages.

## 3. Deploy to Cloud Run
- Symptoms: deploy action errors or health-check timeout.
- Checks:
  - Deployer identity has `run.admin` and `iam.serviceAccountUser`.
  - Service listens on Cloud Run `PORT` (`8080` by default).
  - Required runtime env vars are configured.
  - Inspect logs: `gcloud run services logs tail <service-name> --region <region>`.

## 4. Prisma and Database
- Symptoms: migration or Prisma client startup failures.
- Checks:
  - `DATABASE_URL` is injected via `env:` (not brittle inline shell substitution).
  - `npm ci` runs in the migration step before Prisma commands.
  - Container includes runtime compatibility packages (`openssl`, compatibility libs).

## 5. Log Collection Commands
- `gh run list --workflow deploy.yml --limit 5`
- `gh run view <run-id> --log`
