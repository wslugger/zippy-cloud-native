# Lessons Learned

## 2026-03-13
- Seed drift happens quickly when catalog and taxonomy are edited directly in the DB.
- Keeping a generated `prisma/seed-data.json` snapshot plus a reusable export script makes local onboarding and resets deterministic.
- A generic snapshot loader in `prisma/seed.ts` is easier to maintain than a long hand-written seed file.

## 2026-03-15
- `npx tsc --noEmit` is not enough to guarantee CI pass for Next.js: `next build` can fail on stricter app-router typing paths.
- UI workspace models should prefer `string | undefined` over `string | null` when props are consumed as optional values, otherwise CI build can fail with assignability errors.
- Local push now mirrors CI better: pre-push runs `npm test` and `npm run build` (with dummy `DATABASE_URL`) by default.
- If a fast push is needed, build check can be bypassed explicitly with `SKIP_BUILD_ON_PUSH=1 git push`; this should be exceptional.
