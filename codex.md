# Role & Project Overview (Codex)
You are Codex for the Zippy cloud-native platform. Build pragmatic, production-safe changes that preserve architecture integrity and UX clarity.

## What is Zippy
Zippy is a cloud-native quoting and Bill of Materials (BOM) generator for Solution Architects. Architects browse a catalog of services and packages, configure design options, manage multi-site projects, and calculate pricing with automatic dependency resolution. AI-powered recommendations suggest services from uploaded requirement documents.

## Tech Stack
- **Framework:** Next.js 16 (App Router, `output: 'standalone'` for Docker)
- **UI:** React 19, TypeScript 5, Tailwind CSS 4, Radix UI primitives
- **Database:** Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- **Auth:** JWT via `jose` (HS256, 2-hour sessions, httpOnly cookies)
- **Testing:** Vitest 4
- **Deploy:** Docker multi-stage Alpine → Google Cloud Run (port 8080)

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

## Branch Start Trigger
- If the first actionable user message starts with `start `, create a branch before any code edits.
- Use `npm run workflow:start -- feature <kebab-name>` unless the user explicitly asks for a fix branch.
- Derive `<kebab-name>` from the text after `start ` (lowercase, words separated by `-`).
- If the name cannot be normalized safely, ask for a valid kebab-case name first.

## Project Structure

### Key Directories
- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — ~40 API route files across auth, admin, bom, catalog, projects, sa
- `src/app/projects/` — SA-facing project management pages
- `src/app/admin/` — Admin pages (catalog, taxonomy, prompts, rules)
- `src/components/` — Shared React components
- `src/components/sa-flow/` — 4-step guided wizard (base selection → service options → design options → attachments)
- `src/components/ui/` — Radix-based UI primitives
- `src/lib/` — Business logic, auth, DB client, utilities
- `prisma/` — Schema and migrations

### Key Business Logic
- `src/lib/bom-engine.ts` — BOM calculation: dependency traversal, tiered/flat/per-unit pricing with term+context priority, NRC/MRC/TCV totals
- `src/lib/package-policy-engine.ts` — Package validation: FORCE/FORBID/ALLOW_ONLY/REQUIRE_ONE_OF policies, composition role enforcement, conflict detection
- `src/lib/auth.ts` — JWT encrypt/decrypt/getSession
- `src/middleware.ts` — Route protection: public routes, role-based access (SA vs ADMIN), cookie refresh
- `src/lib/prisma.ts` — Singleton Prisma client

## Data Model (prisma/schema.prisma)
- `CatalogItem` — unified model; `ItemType`: PACKAGE, HARDWARE, MANAGED_SERVICE, SERVICE_OPTION, CONNECTIVITY
- `ItemDependency` — types: REQUIRES, INCLUDES, MANDATORY_ATTACHMENT, OPTIONAL_ATTACHMENT, INCOMPATIBLE, RECOMMENDS
- `Pricing` + `PricingTier` — models: FLAT, TIERED, PER_UNIT, USAGE_BASED, PERCENTAGE
- `Project` → `SolutionSite` → `SiteSelection` — multi-site hierarchy
- `DesignOptionDefinition` → `DesignOptionValue` — dynamic design options (STRING, NUMBER, BOOLEAN)
- `CatalogItemDesignOption` — links items to options with defaults/allowed values
- `PackageCompositionItem` — roles: REQUIRED, OPTIONAL, AUTO_INCLUDED
- `PackageDesignOptionPolicy` — operators: FORCE, FORBID, ALLOW_ONLY, REQUIRE_ONE_OF
- `TaxonomyTerm` — admin-editable taxonomy
- `User` — roles: SA, ADMIN

## API Route Organization
- `/api/auth/*` — login/logout
- `/api/admin/*` — catalog CRUD, design-options, packages, taxonomy, prompts, rules (ADMIN role)
- `/api/catalog/*` — public queries: services, packages, compare, config-schema
- `/api/projects/*` — project CRUD, items, sites, selections, BOM calculation, recommendations
- `/api/bom/calculate` — standalone BOM calculation
- `/api/sa/suggest-services` — AI service suggestions

### API Response Pattern
- Success: `NextResponse.json(data)` or `NextResponse.json(data, { status: 201 })`
- Error: `NextResponse.json({ error: "message" }, { status: 4xx/5xx })`

## Testing Conventions
- Framework: Vitest 4 with node environment
- Tests: `src/lib/__tests__/` (co-located with business logic)
- Mock pattern: `vi.mock('@/lib/prisma')` before imports
- Primary targets: bom-engine, package-policy-engine
- CI: tests required, lint non-blocking
