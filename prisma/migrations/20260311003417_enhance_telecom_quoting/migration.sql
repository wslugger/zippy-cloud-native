-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ORDERED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "DependencyType" ADD VALUE 'IS_A';

-- AlterEnum
ALTER TYPE "ItemType" ADD VALUE 'SERVICE_FAMILY';

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "configSchema" JSONB;

-- AlterTable
ALTER TABLE "Pricing" ADD COLUMN     "context" TEXT,
ADD COLUMN     "termMonths" INTEGER;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "termMonths" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionSite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "region" TEXT,
    "primaryServiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSelection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "configValues" JSONB,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteSelection_siteId_catalogItemId_key" ON "SiteSelection"("siteId", "catalogItemId");

-- CreateIndex
CREATE INDEX "Pricing_itemId_termMonths_context_idx" ON "Pricing"("itemId", "termMonths", "context");

-- AddForeignKey
ALTER TABLE "SolutionSite" ADD CONSTRAINT "SolutionSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionSite" ADD CONSTRAINT "SolutionSite_primaryServiceId_fkey" FOREIGN KEY ("primaryServiceId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSelection" ADD CONSTRAINT "SiteSelection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolutionSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSelection" ADD CONSTRAINT "SiteSelection_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
