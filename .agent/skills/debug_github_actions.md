# Skill: Debugging GitHub Actions for Cloud Run

## Overview
This skill provides a systematic approach to diagnosing and fixing failures in the GitHub Actions CI/CD pipeline for the Zippy application.

## 1. Authentication Failures (Workload Identity Federation)
*   **Symptoms:** `google-github-actions/auth` step fails with 403 or 401.
*   **Checklist:**
    *   Verify `WORKLOAD_IDENTITY_PROVIDER` string in `deploy.yml` matches exactly the one in GCP.
    *   Verify `SERVICE_ACCOUNT` email is correct.
    *   Ensure the Service Account has `roles/iam.workloadIdentityUser` for the `principalSet://...` of the repository.
    *   Check if the `attribute-condition` in the OIDC provider allows the specific repository/branch.

## 2. Docker Build & Push Failures
*   **Symptoms:** `docker build` fails or `docker push` fails with "permission denied".
*   **Checklist:**
    *   **Registry URL:** Verify `GAR_LOCATION`-docker.pkg.dev is correct.
    *   **Secrets:** Ensure `GAR_REPOSITORY` and `GCP_PROJECT_ID` secrets are set in GitHub.
    *   **Build Context:** Check `.dockerignore` to ensure necessary files like `prisma/schema.prisma` are NOT ignored but heavy local folders are.
    *   **Native Modules:** If build fails during `npm install`, ensure `apk add` in `Dockerfile` includes required native build tools (e.g., `make`, `g++`, `python3`).

## 3. Deployment Failures (Cloud Run)
*   **Symptoms:** `google-github-actions/deploy-cloudrun` fails with error or times out.
*   **Checklist:**
    *   **IAM:** Does the SA have `roles/run.admin` and `roles/iam.serviceAccountUser`?
    *   **Port:** Ensure Next.js is listening on the port Cloud Run expects (8080).
    *   **Env Vars:** Check if missing secrets (like `DATABASE_URL`) are causing the app to crash on startup.
    *   **Logs:** Use `gcloud run services logs tail zippy-app` to see real-time startup errors.

## 4. Database & Prisma Failures
*   **Symptoms:** `npx prisma migrate deploy` fails.
*   **Checklist:**
    *   **Connectivity:** Cloud Run must be able to reach your database. Ensure the `DATABASE_URL` uses the correct connection string (e.g., via Cloud SQL Auth Proxy or Direct VPC if applicable).
    *   **Binary Compatibility:** Ensure `lib64-compat` and `openssl` are in the Alpine image to run the Prisma engine.

## 5. Summary Extraction Tools
*   Use `gh run view [RUN_ID] --log` to pull logs locally for analysis.
*   Use `gh run list --workflow deploy.yml --limit 5` to check recent history.
