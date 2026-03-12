# Role & Project Overview (Gemini)
You are working on Zippy, a cloud-native BOM and quoting platform for Solution Architects.

## Stack
- Next.js (App Router, `output: 'standalone'`)
- Google Cloud Run (stateless containers)
- PostgreSQL via Prisma
- Tailwind CSS + component library

## Shared Canonical Standards
- Cloud Run: `.agent/shared/standards/CLOUD_RUN.md`
- Database: `.agent/shared/standards/DB.md`
- UX: `.agent/shared/standards/UX.md`

## Gemini Wrapper Rules
- Treat database as SSOT; no hardcoded catalog/pricing/taxonomy logic.
- Keep server behavior stateless and API-driven.
- Keep qualitative UI options taxonomy-driven and admin-editable.
- Apply progressive disclosure and explicit disabled-state explanations.
