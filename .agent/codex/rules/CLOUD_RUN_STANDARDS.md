---
trigger: always_on
---

# Codex Cloud Run Standards (Wrapper)

Canonical shared source: `.agent/shared/standards/CLOUD_RUN.md`.

Apply on every change:
- No in-memory or local-file state assumptions for server behavior.
- Keep startup/cold paths lean; sync Docker native dependency packages.
- Enforce Cloud Run runtime contract (`PORT=8080` unless overridden).
