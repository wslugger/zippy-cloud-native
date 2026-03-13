# Claude Project Instructions (Zippy)

## What is Zippy
Zippy is a cloud-native quoting and Bill of Materials (BOM) generator for Solution Architects. Architects browse a catalog of services and packages, configure design options, manage multi-site projects, and calculate pricing with automatic dependency resolution. AI-powered recommendations suggest services from uploaded requirement documents.

## Architecture Principles
- **Stateless servers** — no process-memory state; Cloud Run cold-start safe
- **Database as SSOT** — all catalog, dependency, pricing, and taxonomy logic is relational
- **Progressive disclosure UX** — advanced options appear only when prerequisites are met; disabled states show reason text
- **Server-authoritative validation** — client uses optimistic UI but server responses are final for pricing/dependency outcomes

## Shared Standards
- Cloud Run: `.agent/shared/standards/CLOUD_RUN.md`
- Database: `.agent/shared/standards/DB.md`
- UX: `.agent/shared/standards/UX.md`

## Tech Stack
- **Framework:** Next.js 16 (App Router, `output: 'standalone'` for Docker)
- **UI:** React 19, TypeScript 5, Tailwind CSS 4, Radix UI primitives, Lucide icons
- **Database:** Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- **Auth:** JWT via `jose` (HS256, 2-hour sessions, httpOnly cookies)
- **Testing:** Vitest 4 with `@vitest/coverage-v8`
- **CI:** GitHub Actions — lint (non-blocking), tests + build (required)
- **Deploy:** Docker multi-stage Alpine → Google Cloud Run (port 8080)

## Non-Negotiables
1. Database is the Single Source of Truth. No hardcoded catalogs, pricing matrices, dropdown values, or dependency logic.
2. Keep Cloud Run workloads stateless. Persist data server-side; never rely on process memory.
3. Keep business logic server-side in API routes or services. Keep UI thin.
4. Qualitative labels (statuses, support flags, categories) must be taxonomy-driven and admin-editable.
5. Prompts and mutable rules belong in the database with admin controls, not in source constants.

## Multi-Agent Protocol (Gemini/Claude/Codex)
1. Before editing, inspect current workspace changes and do not revert unrelated diffs.
2. Minimize overlap: avoid editing files another agent is actively changing unless explicitly requested.
3. Prefer additive, scoped commits and clear file-level summaries to simplify merges.
4. If you detect conflicting concurrent edits, stop and request direction before continuing.

## Project Structure

### Key Directories
- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — ~40 API route files across auth, admin, bom, catalog, projects, sa
- `src/app/projects/` — SA-facing project management pages
- `src/app/admin/` — Admin pages (catalog, taxonomy, prompts, rules)
- `src/components/` — Shared React components
- `src/components/sa-flow/` — 4-step guided wizard (base selection → service options → design options → attachments)
- `src/components/ui/` — Radix-based UI primitives (button, input, select, badge, tooltip, etc.)
- `src/lib/` — Business logic, auth, DB client, utilities
- `prisma/` — Schema and migrations

### Key Business Logic
- `src/lib/bom-engine.ts` — BOM calculation: dependency traversal, tiered/flat/per-unit pricing with term+context priority, NRC/MRC/TCV totals
- `src/lib/package-policy-engine.ts` — Package validation: FORCE/FORBID/ALLOW_ONLY/REQUIRE_ONE_OF policies on design options, composition role enforcement, conflict detection
- `src/lib/auth.ts` — JWT encrypt/decrypt/getSession
- `src/middleware.ts` — Route protection: public routes, role-based access (SA vs ADMIN), cookie refresh
- `src/lib/prisma.ts` — Singleton Prisma client with connection pooling
- `src/lib/project-ownership.ts` — Project authorization checks
- `src/lib/rate-limit.ts` — API rate limiting

## Data Model (prisma/schema.prisma)

### Core Entities
- `CatalogItem` — unified item model; `ItemType` enum: PACKAGE, HARDWARE, MANAGED_SERVICE, SERVICE_OPTION, CONNECTIVITY
- `ItemDependency` — relationship types: REQUIRES, INCLUDES, MANDATORY_ATTACHMENT, OPTIONAL_ATTACHMENT, INCOMPATIBLE, RECOMMENDS
- `Pricing` + `PricingTier` — models: FLAT, TIERED, PER_UNIT, USAGE_BASED, PERCENTAGE; filtered by term/context/date
- `Project` → `SolutionSite` → `SiteSelection` — multi-site project hierarchy
- `DesignOptionDefinition` → `DesignOptionValue` — dynamic design option system (STRING, NUMBER, BOOLEAN)
- `CatalogItemDesignOption` — links items to design options with defaults and allowed values
- `PackageCompositionItem` — package members with roles: REQUIRED, OPTIONAL, AUTO_INCLUDED
- `PackageDesignOptionPolicy` — policy enforcement: FORCE, FORBID, ALLOW_ONLY, REQUIRE_ONE_OF
- `TaxonomyTerm` — admin-editable taxonomy (category/value/label)
- `User` — roles: SA, ADMIN

## API Route Organization
- `/api/auth/*` — login/logout (SA)
- `/api/admin/*` — catalog CRUD, design-options, packages (composition + policies), taxonomy, prompts, rules (requires ADMIN role)
- `/api/catalog/*` — public queries: services, packages, compare, config-schema
- `/api/projects/*` — project CRUD, items, sites, selections, design options, BOM calculation, recommendations, requirements upload
- `/api/bom/calculate` — standalone BOM calculation
- `/api/sa/suggest-services` — AI-powered service suggestions

### API Response Pattern
- Success: `NextResponse.json(data)` or `NextResponse.json(data, { status: 201 })`
- Error: `NextResponse.json({ error: "message" }, { status: 4xx/5xx })`
- Wrap handlers in try/catch; return 500 on unexpected errors

## Development Workflow

### npm Scripts
- `npm run dev` — local dev server
- `npm test` — vitest run
- `npm run build` — production build
- `npm run lint` — ESLint with cache
- `npm run lint:changed` — lint only changed files

### Branch Workflow
- Start: `npm run workflow:start -- feature <kebab-name>` or `make start TYPE=feature NAME=<name>`
- Finish: `npm run workflow:finish -- --message "<summary>"` or `make finish MSG="<summary>"`
- Strict: add `--run-lint --run-build` or use `make finish-strict`
- Options: `--include-untracked`, `--delete-branch`, `--run-tests`
- Husky pre-push runs `npm test`

## Testing Conventions
- Framework: Vitest 4 with node environment
- Test location: `src/lib/__tests__/` (co-located with business logic)
- Mock pattern: `vi.mock('@/lib/prisma')` to mock Prisma client before imports
- Primary targets: bom-engine and package-policy-engine
- CI runs tests as required check; lint is non-blocking

## Coding Conventions
- TypeScript strict, path alias `@/` → `src/`
- React Server Components by default; `"use client"` for interactive components
- UI primitives in `src/components/ui/` built on Radix + CVA + tailwind-merge
- Dynamic forms via `config-form-renderer.tsx` for schema-driven rendering
- Prisma enums used directly as TypeScript types
- `Prisma.Decimal` → `Number()` conversion in business logic
