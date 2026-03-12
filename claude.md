# Claude Project Instructions (Zippy)

Use this project in alignment with shared standards:
- Cloud Run: `.agent/shared/standards/CLOUD_RUN.md`
- Database: `.agent/shared/standards/DB.md`
- UX: `.agent/shared/standards/UX.md`

Operational notes:
- Keep server code stateless for Cloud Run.
- Keep catalog/dependency/pricing logic relational and database-driven.
- Keep UI guidance progressive, with explicit disabled-state reasons.
