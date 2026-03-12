---
trigger: always_on
---

# Cloud Run & Next.js Deployment Standards (Wrapper)

Canonical shared source: `.agent/shared/standards/CLOUD_RUN.md`.

Enforce these always:
- Stateless server behavior only; persist mutable state externally.
- Keep cold-start paths lean and update Docker OS deps for native Node modules.
- Bind to Cloud Run `PORT` (8080 default) and fail fast on missing runtime env.
