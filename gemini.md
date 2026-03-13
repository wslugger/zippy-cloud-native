# Role & Project Overview (Gemini)
You are working on Zippy, a cloud-native BOM and quoting platform for Solution Architects. Architects browse a catalog of services and packages, configure design options, manage multi-site projects, and calculate pricing with automatic dependency resolution.

## Stack
- **Framework:** Next.js 16 (App Router, `output: 'standalone'`)
- **UI:** React 19, TypeScript 5, Tailwind CSS 4, Radix UI primitives
- **Database:** Prisma 7 + PostgreSQL
- **Auth:** JWT via `jose` (2-hour sessions, httpOnly cookies)
- **Testing:** Vitest 4
- **Deploy:** Docker → Google Cloud Run (stateless containers, port 8080)

## Shared Canonical Standards
- Cloud Run: `.agent/shared/standards/CLOUD_RUN.md`
- Database: `.agent/shared/standards/DB.md`
- UX: `.agent/shared/standards/UX.md`

## Non-Negotiables
1. Database is the Single Source of Truth. No hardcoded catalogs, pricing matrices, dropdown values, or dependency logic.
2. Keep Cloud Run workloads stateless. Persist data server-side; never rely on process memory.
3. Keep business logic server-side in API routes or services. Keep UI thin.
4. Qualitative labels (statuses, support flags, categories) must be taxonomy-driven and admin-editable.
5. Prompts and mutable rules belong in the database with admin controls, not in source constants.

## Project Structure
- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — ~40 API route files across auth, admin, bom, catalog, projects, sa
- `src/app/projects/` — SA-facing project management pages
- `src/app/admin/` — Admin pages (catalog, taxonomy, prompts, rules)
- `src/components/` — Shared React components
- `src/components/sa-flow/` — 4-step guided wizard
- `src/components/ui/` — Radix-based UI primitives
- `src/lib/` — Business logic, auth, DB client, utilities
- `prisma/` — Schema and migrations

## Key Business Logic
- `src/lib/bom-engine.ts` — BOM calculation: dependency traversal, pricing with term+context priority, NRC/MRC/TCV totals
- `src/lib/package-policy-engine.ts` — Package validation: FORCE/FORBID/ALLOW_ONLY/REQUIRE_ONE_OF policies, composition enforcement
- `src/lib/auth.ts` — JWT session management
- `src/middleware.ts` — Route protection (SA vs ADMIN roles)
- `src/lib/prisma.ts` — Singleton Prisma client

## Data Model (prisma/schema.prisma)
- `CatalogItem` — unified model; types: PACKAGE, HARDWARE, MANAGED_SERVICE, SERVICE_OPTION, CONNECTIVITY
- `ItemDependency` — REQUIRES, INCLUDES, MANDATORY_ATTACHMENT, OPTIONAL_ATTACHMENT, INCOMPATIBLE, RECOMMENDS
- `Pricing` + `PricingTier` — FLAT, TIERED, PER_UNIT, USAGE_BASED, PERCENTAGE
- `Project` → `SolutionSite` → `SiteSelection` — multi-site hierarchy
- `DesignOptionDefinition` → `DesignOptionValue` — dynamic design options
- `PackageCompositionItem` + `PackageDesignOptionPolicy` — package composition and policy enforcement
- `TaxonomyTerm` — admin-editable taxonomy
- `User` — roles: SA, ADMIN

## API Route Organization
- `/api/auth/*` — login/logout
- `/api/admin/*` — catalog CRUD, design-options, packages, taxonomy, prompts, rules (ADMIN role)
- `/api/catalog/*` — public queries: services, packages, compare, config-schema
- `/api/projects/*` — project CRUD, items, sites, selections, BOM calculation, recommendations
- `/api/bom/calculate` — standalone BOM calculation
- `/api/sa/suggest-services` — AI service suggestions
