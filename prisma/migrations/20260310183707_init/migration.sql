-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PACKAGE', 'HARDWARE', 'SOFTWARE', 'LICENSE', 'MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('REQUIRES', 'INCLUDES', 'MANDATORY_ATTACHMENT', 'OPTIONAL_ATTACHMENT', 'INCOMPATIBLE', 'RECOMMENDS');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FLAT', 'TIERED', 'PER_UNIT', 'USAGE_BASED', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ItemType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAttribute" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "taxonomyTermId" TEXT NOT NULL,

    CONSTRAINT "ItemAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDependency" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL,
    "quantityMultiplier" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ItemDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'FLAT',
    "unitOfMeasure" TEXT,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER,
    "costNrc" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "costMrc" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "priceNrc" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "priceMrc" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "percentageRate" DECIMAL(5,4),
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "startingUnit" INTEGER NOT NULL,
    "endingUnit" INTEGER,
    "priceMrc" DECIMAL(10,2) NOT NULL,
    "costMrc" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxonomyTerm_category_idx" ON "TaxonomyTerm"("category");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_category_value_key" ON "TaxonomyTerm"("category", "value");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_sku_key" ON "CatalogItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAttribute_itemId_taxonomyTermId_key" ON "ItemAttribute"("itemId", "taxonomyTermId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDependency_parentId_childId_type_key" ON "ItemDependency"("parentId", "childId", "type");

-- CreateIndex
CREATE INDEX "Pricing_itemId_idx" ON "Pricing"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_pricingId_startingUnit_key" ON "PricingTier"("pricingId", "startingUnit");

-- AddForeignKey
ALTER TABLE "ItemAttribute" ADD CONSTRAINT "ItemAttribute_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttribute" ADD CONSTRAINT "ItemAttribute_taxonomyTermId_fkey" FOREIGN KEY ("taxonomyTermId") REFERENCES "TaxonomyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDependency" ADD CONSTRAINT "ItemDependency_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDependency" ADD CONSTRAINT "ItemDependency_childId_fkey" FOREIGN KEY ("childId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pricing" ADD CONSTRAINT "Pricing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingTier" ADD CONSTRAINT "PricingTier_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
