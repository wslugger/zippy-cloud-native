# Skill: Generate Unified Relational Schema

## Goal
Create or evolve `prisma/schema.prisma` into a unified catalog model for hardware, software, services, licenses, pricing, and dependency logic.

## Inputs
- Business requirements for item types and dependencies
- Pricing dimensions (flat, per-unit, tiered, percentage)
- Required taxonomy categories for dynamic UI options

## Required Output
- Updated Prisma schema with relational models and enums
- Migration command plan (`migrate dev` for local, `migrate deploy` for CI/CD)
- Validation checklist and known risks

## Workflow
1. Read current `prisma/schema.prisma` and existing migrations before proposing changes.
2. Enforce unified catalog design (single item table + type enum), not separate per-domain item tables.
3. Model dependencies using explicit junction tables with relation names and unique constraints.
4. Keep pricing logic relational (pricing tables and tiers). Do not encode pricing behavior in JSONB.
5. Represent UI taxonomies through dedicated lookup/taxonomy tables editable by admin interfaces.
6. Add indexes/uniques for SKU lookup and dependency traversal hotspots.
7. Run:
   - `npx prisma format`
   - `npx prisma generate`
8. When schema changed, add or update migration files and document rollback considerations.

## Review Checklist
- Any hardcoded option list duplicated from DB content
- Missing foreign keys/on-delete behavior
- Missing unique constraints for relationship dedupe
- Pricing model unable to represent contract edge cases
- Potential migration data loss or lock-heavy operations
