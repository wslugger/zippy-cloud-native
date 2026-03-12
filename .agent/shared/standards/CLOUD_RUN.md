# Shared Standard: Cloud Run + Next.js

## Intent
All agents must implement Cloud Run-safe, stateless server behavior with reproducible builds and predictable runtime startup.

## Required Rules
- Stateless API/server logic only. No process-memory session state, local file persistence, or sticky-instance assumptions.
- All mutable app state must be externalized (database/token/session store).
- Optimize cold starts by avoiding heavy top-level imports in frequently executed server paths.
- If native Node dependencies are introduced, update `Dockerfile` system packages in the same change.
- Application must bind to Cloud Run `PORT` (default `8080`) and fail fast with clear logs when required env vars are missing.
