---
trigger: always_on
---

# Codex DB Standards (Wrapper)

Canonical shared source: `.agent/shared/standards/DB.md`.

Apply on every change:
- Unified relational catalog and explicit dependency relations.
- Avoid complex logic in JSONB when relational modeling is possible.
- Keep taxonomy dynamic/admin-editable and ship proper migrations.
