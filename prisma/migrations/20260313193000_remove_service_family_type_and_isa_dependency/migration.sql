-- Migrate legacy classification rows before enum contraction.
UPDATE "CatalogItem"
SET "type" = 'MANAGED_SERVICE'
WHERE "type" = 'SERVICE_FAMILY';

-- Convert legacy IS_A edges into INCLUDES where no duplicate INCLUDES edge exists.
UPDATE "ItemDependency" d
SET "type" = 'INCLUDES'
WHERE d."type" = 'IS_A'
  AND NOT EXISTS (
    SELECT 1
    FROM "ItemDependency" existing
    WHERE existing."parentId" = d."parentId"
      AND existing."childId" = d."childId"
      AND existing."type" = 'INCLUDES'
  );

-- Remove remaining IS_A edges that would otherwise block enum contraction.
DELETE FROM "ItemDependency"
WHERE "type" = 'IS_A';

-- Remove SERVICE_FAMILY from ItemType enum.
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
CREATE TYPE "ItemType" AS ENUM ('PACKAGE', 'HARDWARE', 'MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY');
ALTER TABLE "CatalogItem"
  ALTER COLUMN "type" TYPE "ItemType"
  USING ("type"::text::"ItemType");
DROP TYPE "ItemType_old";

-- Remove IS_A from DependencyType enum.
ALTER TYPE "DependencyType" RENAME TO "DependencyType_old";
CREATE TYPE "DependencyType" AS ENUM ('REQUIRES', 'INCLUDES', 'MANDATORY_ATTACHMENT', 'OPTIONAL_ATTACHMENT', 'INCOMPATIBLE', 'RECOMMENDS');
ALTER TABLE "ItemDependency"
  ALTER COLUMN "type" TYPE "DependencyType"
  USING ("type"::text::"DependencyType");
DROP TYPE "DependencyType_old";
