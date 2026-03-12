---
trigger: always_on
---

# Database Architecture Standards (Wrapper)

Canonical shared source: `.agent/shared/standards/DB.md`.

Enforce these always:
- Database is SSOT with unified catalog modeling.
- Dependency and pricing logic must be relational with keys/constraints, not complex JSONB.
- Taxonomy values are DB-managed and editable; include migrations for schema changes.
