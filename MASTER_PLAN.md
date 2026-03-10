
# MASTER PLAN: Zippy Cloud-Native Rebuild

## System Architecture & UX Vision
You are building the next generation of "Zippy," a quoting and Bill of Materials (BOM) generator for Solution Architects.
* **Tech Stack:** Next.js (App Router, standalone output), Tailwind CSS, Prisma ORM, PostgreSQL (Google Cloud SQL), deployed statelessly on Google Cloud Run.
* **UX Principles:** Minimize cognitive load through Progressive Disclosure. Enforce Jakob Nielsen's Error Prevention by dynamically disabling invalid hardware/service combinations based on strict relational database rules.
* **Architectural Directives:** The database is the Single Source of Truth. No hardcoded logic, arrays, or dropdowns. All state must be managed via backend APIs and database persistence (stateless containers).

---

## Phase 1: Initialize Agent Context Boundaries
**Agent Action:** Create the following directories and files to establish your own operating rules for this workspace.

1.  **Create `gemini.md` (Root Directory)**
    * *Content:* Define the core architecture. Relational SSOT, Statelessness, API-Driven BOMs, No hardcoded taxonomy.
2.  **Create `.agent/rules/CLOUD_RUN_STANDARDS.md`**
    * *Content:* Rule: All Next.js API routes must be stateless. Dockerfiles must include Alpine OS dependencies for new native node modules. Use dynamic imports to optimize cold starts.
3.  **Create `.agent/rules/DB_STANDARDS.md`**
    * *Content:* Rule: Strict relational integrity. Use foreign keys for dependencies. Never use JSONB for complex pricing logic; use relational tables.
4.  **Create `.agent/rules/UX_STANDARDS.md`**
    * *Content:* Rule: Use optimistic UI updates for BOM calculations. Form inputs must have tooltips explaining disabled states (Error Prevention).
5.  **Create `.agent/skills/deploy_infrastructure.md`**
    * *Content:* Skill: Use Cloud Run MCP `deploy-local-folder`. Inject `DATABASE_URL`. Check Dockerfile if build fails.

---

## Phase 2: Project Bootstrap & Containerization
**Agent Action:** Scaffold the frontend and container environment.

1.  Initialize a new Next.js project in the current directory (TypeScript, Tailwind, ESLint, App Router).
2.  Update `next.config.ts` to include `output: 'standalone'`.
3.  Generate a `Dockerfile` optimized for Next.js standalone using an Alpine Linux Node image, exposing port 8080, setting `NODE_ENV` to production.

---

## Phase 3: The Unified Catalog Engine (Database)
**Agent Action:** Setup Prisma and define the relational schema.

1.  Install `prisma` and `@prisma/client`. Initialize Prisma with PostgreSQL.
2.  Overwrite `prisma/schema.prisma` with the following unified architecture to support Packages, Connectivity Pricing, and Managed Attachments:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// -- 1. TAXONOMY (Dynamic Dropdowns & Attributes) --
model TaxonomyTerm {
  id          String   @id @default(uuid())
  category    String   // e.g., "VENDOR", "INTERFACE_TYPE"
  value       String   // e.g., "Cisco Meraki", "WAN"
  label       String   
  itemAttributes ItemAttribute[]
  @@unique([category, value])
  @@index([category])
}

// -- 2. UNIFIED CATALOG --
enum ItemType {
  PACKAGE
  HARDWARE
  SOFTWARE
  LICENSE
  MANAGED_SERVICE
  SERVICE_OPTION
  CONNECTIVITY
}

model CatalogItem {
  id          String   @id @default(uuid())
  sku         String   @unique
  name        String
  description String?
  type        ItemType
  pricing         Pricing[]
  attributes      ItemAttribute[]
  parentDependencies ItemDependency[] @relation("ParentItem")
  childDependencies  ItemDependency[] @relation("ChildItem")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ItemAttribute {
  id             String       @id @default(uuid())
  itemId         String
  taxonomyTermId String
  item           CatalogItem  @relation(fields: [itemId], references: [id], onDelete: Cascade)
  term           TaxonomyTerm @relation(fields: [taxonomyTermId], references: [id], onDelete: Cascade)
  @@unique([itemId, taxonomyTermId])
}

// -- 3. DEPENDENCY ENGINE (Solves Licensing & Bundles) --
enum DependencyType {
  REQUIRES
  INCLUDES
  MANDATORY_ATTACHMENT
  OPTIONAL_ATTACHMENT
  INCOMPATIBLE
  RECOMMENDS
}

model ItemDependency {
  id                 String         @id @default(uuid())
  parentId           String         
  childId            String         
  type               DependencyType
  quantityMultiplier Int            @default(1)
  parentItem         CatalogItem    @relation("ParentItem", fields: [parentId], references: [id], onDelete: Cascade)
  childItem          CatalogItem    @relation("ChildItem", fields: [childId], references: [id], onDelete: Cascade)
  @@unique([parentId, childId, type])
}

// -- 4. PRICING ENGINE (Dimensional & Tiered) --
enum PricingModel {
  FLAT
  TIERED
  PER_UNIT
  USAGE_BASED
  PERCENTAGE
}

model Pricing {
  id             String       @id @default(uuid())
  itemId         String
  pricingModel   PricingModel @default(FLAT)
  unitOfMeasure  String?      // e.g., "Mbps", "Port"
  minQuantity    Int          @default(1)
  maxQuantity    Int?         
  costNrc        Decimal      @default(0.00) @db.Decimal(10, 2)
  costMrc        Decimal      @default(0.00) @db.Decimal(10, 2)
  priceNrc       Decimal      @default(0.00) @db.Decimal(10, 2)
  priceMrc       Decimal      @default(0.00) @db.Decimal(10, 2)
  percentageRate Decimal?     @db.Decimal(5, 4) 
  effectiveDate  DateTime     @default(now())
  expirationDate DateTime?
  item           CatalogItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tiers          PricingTier[] 
  @@index([itemId])
}

model PricingTier {
  id             String   @id @default(uuid())
  pricingId      String
  startingUnit   Int      
  endingUnit     Int?     
  priceMrc       Decimal  @db.Decimal(10, 2)
  costMrc        Decimal  @db.Decimal(10, 2)
  pricing        Pricing  @relation(fields: [pricingId], references: [id], onDelete: Cascade)
  @@unique([pricingId, startingUnit]) 
}

```

3. Run `npx prisma format` and `npx prisma generate`.

---

## Phase 4: CI/CD & Cloud Infrastructure

**Agent Action:** Execute terminal commands to establish the automated pipeline to Google Cloud.

1. Create a GitHub Actions workflow at `.github/workflows/deploy.yml` to build the Docker container and deploy to Cloud Run using Workload Identity Federation.
2. Using your terminal access, run the `gcloud` commands to create a service account (`github-actions-deployer`) in the active project.
3. Assign it roles: `roles/run.admin`, `roles/iam.serviceAccountUser`, and `roles/artifactregistry.writer`.
4. Configure the Workload Identity Pool and OIDC provider for the GitHub repository.
5. Bind the pool to the service account and update the `deploy.yml` with the generated variables.

---

## Phase 5: Scaffold the Core Calculation API

**Agent Action:** Build the foundational stateless endpoint.

1. Create a Next.js API Route at `src/app/api/bom/calculate/route.ts`.
2. Implement a POST handler that accepts an array of `sku_ids`.
3. Scaffold the recursive logic structure to query the database, expand `INCLUDES` and `MANDATORY_ATTACHMENT` dependencies, apply the `PricingModel` logic, and return a standardized JSON Quote object.

```
***

By giving the agent this document, it sets an explicit roadmap. You can instruct the agent to run through them one phase at a time (e.g., "Execute Phase 1," review it, then "Execute Phase 2"). This ensures high-quality code generation and perfectly integrates both our technical architecture and our UX design principles!

```