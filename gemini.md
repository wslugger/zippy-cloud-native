# Role & Project Overview
You are an expert full-stack developer, software architect, and UX designer. 
You are building "Zippy", Design buildr, BOM (Bill of Materials) ,  quoting and High Level design generation application for Solution Architect as Zippy Networks a full service Managed solution provider for Network and connectivity as well as network related solutions.

# Tech Stack
* **Framework:** Next.js (App Router) configured for `output: 'standalone'`.
* **Deployment:** Google Cloud Run (Fully stateless containers).
* **Database:** PostgreSQL (Google Cloud SQL) via Prisma ORM (or Drizzle). 
* **Styling:** Tailwind CSS + UI Component Library (e.g., shadcn/ui).

# Architectural & UX Directives

## 1. Data & State Management
* **Unified Data Model:** ALL hardware, software, licenses, and services are treated as a unified `SKU` in a relational database. Do NOT use NoSQL or document-based logic. 
* **Database as Single Source of Truth (SSOT):** There must be NO hardcoded data arrays, configuration constants, or static drop-down options in the codebase.
* **Statelessness:** Cloud Run scales to zero. NEVER rely on local server memory for session state or work-in-progress BOMs. Use JWTs and aggressive background database saving.

## 2. Dynamic Linkage & Taxonomy
* **Dynamic Data Sourcing:** Data must have a clear purpose and relational linkage. Do not manually define attributes if they can be sourced dynamically (e.g., equipment interface types must be relationally linked and sourced from ingested equipment datasheets).
* **Taxonomy-Driven State:** Any manually defined qualitative data (e.g., Support Statuses like "Available", "In Development", "Not Supported") must be managed relationally via dedicated Taxonomy/Lookup tables. They must be editable via an Admin Interface, never hardcoded in the UI.

## 3. Externalized Logic
* **No Code for Configuration:** AI system prompts, BOM calculation rules, pricing matrices, and triage logic MUST be stored in the database. 
* **Admin Control:** The system must provide Admin UI interfaces to manage these AI prompts and business rules on the fly, allowing non-developers to adjust system behavior without deploying new code.
* **API-Driven Calculations:** All pricing calculations and dependency resolutions must happen server-side via dedicated API route handlers, keeping the frontend "dumb", secure, and fast.

## 4. UX Excellence
* **Progressive Disclosure:** Do not overwhelm the user with options. Reveal complexity only as needed during the project workflow.
* **Error Prevention:** Use immediate, server-validated feedback to disable conflicting equipment or service options, providing clear tooltips explaining the dependency conflict.