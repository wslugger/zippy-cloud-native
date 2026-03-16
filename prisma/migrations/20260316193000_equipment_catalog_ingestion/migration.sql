-- Create enums
CREATE TYPE "EquipmentPurpose" AS ENUM ('WAN', 'LAN', 'WLAN');
CREATE TYPE "EquipmentReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REJECTED');
CREATE TYPE "EquipmentIngestionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
CREATE TYPE "EquipmentIngestionSourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'UPSERTED', 'SKIPPED', 'FAILED');

-- Extend CatalogItem
ALTER TABLE "CatalogItem"
  ADD COLUMN "primaryPurpose" "EquipmentPurpose",
  ADD COLUMN "secondaryPurposes" "EquipmentPurpose"[] DEFAULT ARRAY[]::"EquipmentPurpose"[];

-- Equipment profile and specs
CREATE TABLE "EquipmentProfile" (
  "catalogItemId" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "pricingSku" TEXT,
  "family" TEXT,
  "vendorDatasheetUrl" TEXT,
  "normalizedMakeModel" TEXT NOT NULL,
  "reviewStatus" "EquipmentReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "lastExtractedAt" TIMESTAMP(3),
  "lastExtractedModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EquipmentProfile_pkey" PRIMARY KEY ("catalogItemId")
);

CREATE TABLE "EquipmentWanSpec" (
  "catalogItemId" TEXT NOT NULL,
  "throughputMbps" INTEGER,
  "vpnTunnels" INTEGER,
  "cellularSupport" BOOLEAN NOT NULL DEFAULT false,
  "formFactor" TEXT,
  "interfaces" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "EquipmentWanSpec_pkey" PRIMARY KEY ("catalogItemId")
);

CREATE TABLE "EquipmentLanSpec" (
  "catalogItemId" TEXT NOT NULL,
  "portCount" INTEGER,
  "portSpeed" TEXT,
  "poeBudgetWatts" INTEGER,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "uplinkPorts" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "EquipmentLanSpec_pkey" PRIMARY KEY ("catalogItemId")
);

CREATE TABLE "EquipmentWlanSpec" (
  "catalogItemId" TEXT NOT NULL,
  "wifiStandard" TEXT,
  "maxClients" INTEGER,
  "indoorOutdoor" TEXT,
  "radios" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "EquipmentWlanSpec_pkey" PRIMARY KEY ("catalogItemId")
);

-- Ingestion jobs
CREATE TABLE "EquipmentIngestionJob" (
  "id" TEXT NOT NULL,
  "status" "EquipmentIngestionJobStatus" NOT NULL DEFAULT 'PENDING',
  "submittedBy" TEXT,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "EquipmentIngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EquipmentIngestionSource" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "catalogItemId" TEXT,
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "status" "EquipmentIngestionSourceStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "httpStatus" INTEGER,
  "contentType" TEXT,
  "contentLength" INTEGER,
  "extractedText" TEXT,
  "extractionPayload" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "EquipmentIngestionSource_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "CatalogItem_primaryPurpose_idx" ON "CatalogItem"("primaryPurpose");
CREATE INDEX "CatalogItem_secondaryPurposes_idx" ON "CatalogItem" USING GIN ("secondaryPurposes");

CREATE UNIQUE INDEX "EquipmentProfile_normalizedMakeModel_key" ON "EquipmentProfile"("normalizedMakeModel");
CREATE INDEX "EquipmentProfile_make_model_idx" ON "EquipmentProfile"("make", "model");
CREATE INDEX "EquipmentProfile_reviewStatus_updatedAt_idx" ON "EquipmentProfile"("reviewStatus", "updatedAt");

CREATE INDEX "EquipmentIngestionJob_status_createdAt_idx" ON "EquipmentIngestionJob"("status", "createdAt");
CREATE UNIQUE INDEX "EquipmentIngestionSource_jobId_normalizedUrl_key" ON "EquipmentIngestionSource"("jobId", "normalizedUrl");
CREATE INDEX "EquipmentIngestionSource_status_createdAt_idx" ON "EquipmentIngestionSource"("status", "createdAt");
CREATE INDEX "EquipmentIngestionSource_catalogItemId_idx" ON "EquipmentIngestionSource"("catalogItemId");

-- Foreign keys
ALTER TABLE "EquipmentProfile"
  ADD CONSTRAINT "EquipmentProfile_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentWanSpec"
  ADD CONSTRAINT "EquipmentWanSpec_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "EquipmentProfile"("catalogItemId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentLanSpec"
  ADD CONSTRAINT "EquipmentLanSpec_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "EquipmentProfile"("catalogItemId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentWlanSpec"
  ADD CONSTRAINT "EquipmentWlanSpec_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "EquipmentProfile"("catalogItemId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentIngestionSource"
  ADD CONSTRAINT "EquipmentIngestionSource_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "EquipmentIngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentIngestionSource"
  ADD CONSTRAINT "EquipmentIngestionSource_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
