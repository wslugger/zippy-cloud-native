---
trigger: always_on
---

# UX & UI Component Standards

## Core Philosophy
Bridge technical complexity with cognitive simplicity. The UI must guide the Solution Architect seamlessly without exposing the underlying relational complexity of the pricing engine.

## Design Rules
* **Optimistic UI:** Always use optimistic UI updates for BOM (Bill of Materials) calculations. When a user changes a quantity or option, update the UI totals immediately to reduce perceived latency, while handling the actual database save asynchronously in the background.
* **Error Prevention (Disabled States):** If a service or equipment option is incompatible with the current configuration, disable the option. You MUST provide a clear tooltip explaining exactly *why* it is disabled (e.g., "Requires Advanced Security License").
* **Clear Affordances:** Form inputs and interactive elements must have clear, recognizable visual affordances following our established design system.
* **Progressive Disclosure:** Reveal complex configuration options only when the prerequisite selections have been logically fulfilled by the user.