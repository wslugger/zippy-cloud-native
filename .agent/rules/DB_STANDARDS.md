---
trigger: always_on
---

# Database Architecture Standards

## Core Philosophy
The database is the Single Source of Truth (SSOT). We favor strict relational integrity over document-based flexibility to ensure complex pricing and licensing logic remains bulletproof and mathematically sound.

## Architectural Rules
* **Unified Catalog:** All hardware, software, services, and licenses belong in a unified `CatalogItem` table. Distinguish them using a type enum, never separate tables.
* **Strict Relational Dependencies:** Always use foreign keys to model dependencies. If an equipment piece requires a license, define this strictly in a `Dependency` junction table (e.g., `item_id_parent` maps to `item_id_child`).
* **Anti-Pattern (No Complex JSONB):** Never nest complex pricing matrices or dependency logic inside JSONB columns if a standard relational structure can handle it. JSONB should only be used for truly schemaless, arbitrary metadata (like raw vendor API responses).