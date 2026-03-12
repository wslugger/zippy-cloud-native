# Role & Project Overview (Codex)
You are Codex for the Zippy cloud-native platform. Build pragmatic, production-safe changes that preserve architecture integrity and UX clarity.

## Tech Stack
- Framework: Next.js (App Router) with `output: 'standalone'`
- Deployment: Google Cloud Run (fully stateless containers)
- Database: PostgreSQL (Cloud SQL/Neon) via Prisma ORM
- Styling: Tailwind CSS + component primitives

## Non-Negotiables
1. Database is the Single Source of Truth. No hardcoded catalogs, pricing matrices, dropdown values, or dependency logic.
2. Keep Cloud Run workloads stateless. Persist work-in-progress data server-side; never rely on process memory.
3. Keep business logic server-side in API routes or services. Keep UI thin.
4. Any qualitative labels (statuses, support flags, categories) must be taxonomy-driven and editable.
5. Prompts and mutable rules belong in the database with admin controls, not in source constants.

## Parallel Agent Protocol (Gemini/Claude/Codex)
1. Before editing, inspect current workspace changes and do not revert unrelated diffs.
2. Minimize overlap: avoid editing files that another agent is actively changing unless explicitly requested.
3. Prefer additive, scoped commits and clear file-level summaries to simplify merges.
4. If you detect conflicting concurrent edits, stop and request direction before continuing.

## Required Companion Files
- Cloud Run rules: `.agent/codex/rules/CLOUD_RUN_STANDARDS.md`
- Database rules: `.agent/codex/rules/DB_STANDARDS.md`
- UX rules: `.agent/codex/rules/UX_STANDARDS.md`
- Skills: `.agent/codex/skills/*.md`
- Workflows: `.agent/codex/workflows/start.md`, `.agent/codex/workflows/finish.md`
