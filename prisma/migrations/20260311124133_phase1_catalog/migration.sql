/*
  Warnings:

  - You are about to drop the column `description` on the `CatalogItem` table. All the data in the column will be lost.
  - You are about to drop the `Collateral` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Collateral" DROP CONSTRAINT "Collateral_catalogItemId_fkey";

-- AlterTable
ALTER TABLE "CatalogItem" DROP COLUMN "description",
ADD COLUMN     "detailedDescription" TEXT,
ADD COLUMN     "shortDescription" TEXT;

-- DropTable
DROP TABLE "Collateral";

-- CreateTable
CREATE TABLE "ItemConstraint" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAssumption" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCollateral" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCollateral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemConstraint_itemId_idx" ON "ItemConstraint"("itemId");

-- CreateIndex
CREATE INDEX "ItemAssumption_itemId_idx" ON "ItemAssumption"("itemId");

-- CreateIndex
CREATE INDEX "ItemCollateral_itemId_idx" ON "ItemCollateral"("itemId");

-- AddForeignKey
ALTER TABLE "ItemConstraint" ADD CONSTRAINT "ItemConstraint_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssumption" ADD CONSTRAINT "ItemAssumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCollateral" ADD CONSTRAINT "ItemCollateral_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
