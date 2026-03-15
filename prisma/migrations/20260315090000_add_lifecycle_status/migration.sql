DO $$
BEGIN
  CREATE TYPE "LifecycleStatus" AS ENUM (
    'SUPPORTED',
    'IN_DEVELOPMENT',
    'APPROVAL_REQUIRED',
    'DEPRECATED',
    'END_OF_SALE',
    'END_OF_SUPPORT',
    'NOT_AVAILABLE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TaxonomyTerm"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'SUPPORTED';

ALTER TABLE "CatalogItem"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'SUPPORTED';

ALTER TABLE "DesignOptionDefinition"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'SUPPORTED';
