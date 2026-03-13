# Lessons Learned

## 2026-03-13
- Seed drift happens quickly when catalog and taxonomy are edited directly in the DB.
- Keeping a generated `prisma/seed-data.json` snapshot plus a reusable export script makes local onboarding and resets deterministic.
- A generic snapshot loader in `prisma/seed.ts` is easier to maintain than a long hand-written seed file.
