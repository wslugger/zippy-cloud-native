# Shared Standard: Database Architecture

## Intent
Treat the relational database as SSOT for catalog structure, dependency resolution, and pricing behavior.

## Required Rules
- Use a unified catalog model with explicit type classification; avoid fragmented item tables when one model can represent all item classes.
- Model dependency logic via normalized relation/junction tables with foreign keys and constraints.
- Do not encode pricing/dependency behavior in complex JSONB structures if relational modeling is viable.
- Keep taxonomy/lookup data relational and admin-editable; do not hardcode UI option sources.
- Ship schema changes with Prisma migration artifacts and regenerated client.
