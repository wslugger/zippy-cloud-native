---
description: How to setup and maintain the CI/CD pipeline for Cloud Run and Neon database migrations
---

# Deploy CI/CD Workflow

This workflow documents the process and exact steps to maintain the automated GitHub Actions pipeline that builds the container, deploys it to Google Cloud Run, and executes Prisma migrations against a Neon database.

## 1. Google Cloud Authentication
Use Google Cloud Workload Identity Federation for keyless authentication.
- Ensure the following APIs are enabled in your GCP project: `run.googleapis.com`, `artifactregistry.googleapis.com`, and **`iamcredentials.googleapis.com`** (critical for Workload Identity).

## 2. GitHub Secrets Management
Ensure GitHub Secrets are securely passed to the workflow.
- **Gotcha / Lesson Learned:** GitHub Secrets can sometimes contain hidden characters (like trailing newlines). When substituting these secrets to construct URLs (like Artifact Registry domains or Docker Image paths), it can cause fatal errors (e.g., `invalid control character in URL`). 
- **Solution:** Always sanitize these structural variables in the workflow before use.
  ```yaml
  GAR_LOCATION: ${{ secrets.GCP_REGION }}
  run: |
    CLEAN_LOCATION=$(echo "$GAR_LOCATION" | tr -d '\n' | tr -d ' ')
    echo "CLEAN_LOCATION=$CLEAN_LOCATION" >> $GITHUB_ENV
  ```

## 3. Database Migrations via Prisma
When executing `npx prisma migrate deploy` as part of the pipeline:
- **Gotcha / Lesson Learned:** The runner acts as a bare VM. If you just run the Prisma command without installing packages, it will fail because it cannot find configuration files or the local CLI.
- **Solution:** You MUST explicitly run `npm ci` immediately before the migration command in the same step.
- **Gotcha / Lesson Learned:** Providing variables like `DATABASE_URL` inline using bash substitution (`DATABASE_URL=... npx prisma ...`) might result in an empty string being evaluated by Node.
- **Solution:** Always inject secrets into the step using the `env:` block in GitHub Actions.
  ```yaml
  - name: Run Database Migrations
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    run: |
      npm ci
      npx prisma migrate deploy
  ```
- **Gotcha / Lesson Learned:** `import "dotenv/config";` within `prisma.config.ts` or other configuration files can crash the CI pipeline because `dotenv` might not be available globally or correctly resolved. Prisma automatically handles `.env` files, so explicit imports should be avoided.

## 4. Container Build & Deploy
- Ensure `openssl` is added to the Alpine base image in your Dockerfile so Prisma client can execute native code.
- Generate Prisma Client explicitly step-by-step in your Dockerfile `builder` stage (`RUN npx prisma generate`) before compilation so the container has everything it needs.
