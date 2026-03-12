-- AlterTable
ALTER TABLE "DesignOptionValue"
ADD COLUMN "description" TEXT,
ADD COLUMN "constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "assumptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
