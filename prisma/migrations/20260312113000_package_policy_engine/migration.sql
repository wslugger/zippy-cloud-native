-- CreateEnum
CREATE TYPE "DesignOptionValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "PackageCompositionRole" AS ENUM ('REQUIRED', 'OPTIONAL', 'AUTO_INCLUDED');

-- CreateEnum
CREATE TYPE "PackagePolicyOperator" AS ENUM ('FORCE', 'FORBID', 'ALLOW_ONLY', 'REQUIRE_ONE_OF');

-- CreateEnum
CREATE TYPE "PackagePolicyScope" AS ENUM ('PROJECT', 'SITE');

-- CreateEnum
CREATE TYPE "RequirementDocumentStatus" AS ENUM ('UPLOADED', 'PARSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationState" AS ENUM ('PENDING', 'ADOPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "DesignOptionDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "valueType" "DesignOptionValueType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignOptionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignOptionValue" (
    "id" TEXT NOT NULL,
    "designOptionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemDesignOption" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "designOptionId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowMulti" BOOLEAN NOT NULL DEFAULT false,
    "defaultValueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItemDesignOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemDesignOptionValue" (
    "id" TEXT NOT NULL,
    "itemDesignOptionId" TEXT NOT NULL,
    "designOptionValueId" TEXT NOT NULL,

    CONSTRAINT "CatalogItemDesignOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCompositionItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "role" "PackageCompositionRole" NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER,
    "defaultQty" INTEGER NOT NULL DEFAULT 1,
    "isSelectable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageCompositionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDesignOptionPolicy" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "targetCatalogItemId" TEXT NOT NULL,
    "designOptionId" TEXT NOT NULL,
    "operator" "PackagePolicyOperator" NOT NULL,
    "scope" "PackagePolicyScope" NOT NULL DEFAULT 'PROJECT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDesignOptionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDesignOptionPolicyValue" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "designOptionValueId" TEXT NOT NULL,

    CONSTRAINT "PackageDesignOptionPolicyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRequirementDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "gcsUri" TEXT NOT NULL,
    "extractedText" TEXT,
    "status" "RequirementDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRequirementDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRecommendation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "sourceModel" TEXT NOT NULL,
    "state" "RecommendationState" NOT NULL DEFAULT 'PENDING',
    "requiredIncluded" TEXT[] NOT NULL,
    "optionalRecommended" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignOptionDefinition_key_key" ON "DesignOptionDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DesignOptionValue_designOptionId_value_key" ON "DesignOptionValue"("designOptionId", "value");

-- CreateIndex
CREATE INDEX "DesignOptionValue_designOptionId_sortOrder_idx" ON "DesignOptionValue"("designOptionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItemDesignOption_catalogItemId_designOptionId_key" ON "CatalogItemDesignOption"("catalogItemId", "designOptionId");

-- CreateIndex
CREATE INDEX "CatalogItemDesignOption_catalogItemId_idx" ON "CatalogItemDesignOption"("catalogItemId");

-- CreateIndex
CREATE INDEX "CatalogItemDesignOption_designOptionId_idx" ON "CatalogItemDesignOption"("designOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItemDesignOptionValue_itemDesignOptionId_designOptionValueI_key" ON "CatalogItemDesignOptionValue"("itemDesignOptionId", "designOptionValueId");

-- CreateIndex
CREATE INDEX "CatalogItemDesignOptionValue_itemDesignOptionId_idx" ON "CatalogItemDesignOptionValue"("itemDesignOptionId");

-- CreateIndex
CREATE INDEX "CatalogItemDesignOptionValue_designOptionValueId_idx" ON "CatalogItemDesignOptionValue"("designOptionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageCompositionItem_packageId_catalogItemId_key" ON "PackageCompositionItem"("packageId", "catalogItemId");

-- CreateIndex
CREATE INDEX "PackageCompositionItem_packageId_role_idx" ON "PackageCompositionItem"("packageId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDesignOptionPolicy_packageId_targetCatalogItemId_designOptio_key" ON "PackageDesignOptionPolicy"("packageId", "targetCatalogItemId", "designOptionId", "operator");

-- CreateIndex
CREATE INDEX "PackageDesignOptionPolicy_packageId_active_idx" ON "PackageDesignOptionPolicy"("packageId", "active");

-- CreateIndex
CREATE INDEX "PackageDesignOptionPolicy_targetCatalogItemId_designOptionId_idx" ON "PackageDesignOptionPolicy"("targetCatalogItemId", "designOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageDesignOptionPolicyValue_policyId_designOptionValueId_key" ON "PackageDesignOptionPolicyValue"("policyId", "designOptionValueId");

-- CreateIndex
CREATE INDEX "PackageDesignOptionPolicyValue_policyId_idx" ON "PackageDesignOptionPolicyValue"("policyId");

-- CreateIndex
CREATE INDEX "ProjectRequirementDocument_projectId_status_idx" ON "ProjectRequirementDocument"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRecommendation_projectId_catalogItemId_key" ON "ProjectRecommendation"("projectId", "catalogItemId");

-- CreateIndex
CREATE INDEX "ProjectRecommendation_projectId_state_idx" ON "ProjectRecommendation"("projectId", "state");

-- AddForeignKey
ALTER TABLE "DesignOptionValue" ADD CONSTRAINT "DesignOptionValue_designOptionId_fkey" FOREIGN KEY ("designOptionId") REFERENCES "DesignOptionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemDesignOption" ADD CONSTRAINT "CatalogItemDesignOption_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemDesignOption" ADD CONSTRAINT "CatalogItemDesignOption_designOptionId_fkey" FOREIGN KEY ("designOptionId") REFERENCES "DesignOptionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemDesignOption" ADD CONSTRAINT "CatalogItemDesignOption_defaultValueId_fkey" FOREIGN KEY ("defaultValueId") REFERENCES "DesignOptionValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemDesignOptionValue" ADD CONSTRAINT "CatalogItemDesignOptionValue_itemDesignOptionId_fkey" FOREIGN KEY ("itemDesignOptionId") REFERENCES "CatalogItemDesignOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemDesignOptionValue" ADD CONSTRAINT "CatalogItemDesignOptionValue_designOptionValueId_fkey" FOREIGN KEY ("designOptionValueId") REFERENCES "DesignOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCompositionItem" ADD CONSTRAINT "PackageCompositionItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCompositionItem" ADD CONSTRAINT "PackageCompositionItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesignOptionPolicy" ADD CONSTRAINT "PackageDesignOptionPolicy_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesignOptionPolicy" ADD CONSTRAINT "PackageDesignOptionPolicy_targetCatalogItemId_fkey" FOREIGN KEY ("targetCatalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesignOptionPolicy" ADD CONSTRAINT "PackageDesignOptionPolicy_designOptionId_fkey" FOREIGN KEY ("designOptionId") REFERENCES "DesignOptionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesignOptionPolicyValue" ADD CONSTRAINT "PackageDesignOptionPolicyValue_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PackageDesignOptionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesignOptionPolicyValue" ADD CONSTRAINT "PackageDesignOptionPolicyValue_designOptionValueId_fkey" FOREIGN KEY ("designOptionValueId") REFERENCES "DesignOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequirementDocument" ADD CONSTRAINT "ProjectRequirementDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRecommendation" ADD CONSTRAINT "ProjectRecommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRecommendation" ADD CONSTRAINT "ProjectRecommendation_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
