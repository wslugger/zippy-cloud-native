# Shared Standard: UX and Interaction Safety

## Intent
Keep complex BOM and quoting flows understandable while preventing invalid configurations.

## Required Rules
- Apply progressive disclosure so advanced options appear only after prerequisites are satisfied.
- Use disabled states for invalid combinations and provide explicit reason text/tooltips.
- Prefer optimistic UI feedback for quantity/config changes while reconciling with server validation.
- Server responses are authoritative for dependency and pricing outcomes.
- Preserve clear interaction affordances across normal, loading, disabled, and error states.
