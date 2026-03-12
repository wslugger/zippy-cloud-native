-- AlterTable
ALTER TABLE "DesignOptionDefinition"
ADD COLUMN "constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "assumptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
