-- Analytics and workflow tracking for project funnel reporting.
CREATE TYPE "ProjectWorkflowStage" AS ENUM (
    'PROJECT_CREATED',
    'REQUIREMENTS_CAPTURED',
    'RECOMMENDATIONS_READY',
    'SERVICE_SELECTED'
);

CREATE TYPE "ProjectEventType" AS ENUM (
    'PROJECT_CREATED',
    'REQUIREMENT_DOC_UPLOADED',
    'NOTES_ENTERED',
    'RECOMMENDATIONS_GENERATED',
    'RECOMMENDATION_ADOPTED',
    'SERVICE_MANUALLY_ADDED',
    'SERVICE_REMOVED',
    'COLLATERAL_CLICKED'
);

ALTER TABLE "Project"
    ADD COLUMN "workflowStage" "ProjectWorkflowStage" NOT NULL DEFAULT 'PROJECT_CREATED',
    ADD COLUMN "manualNotes" TEXT;

CREATE TABLE "ProjectRecommendationRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "sourceModel" TEXT NOT NULL,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectRecommendationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRecommendationRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "certaintyPercent" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "shortReason" TEXT,
    "requiredIncluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optionalRecommended" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchedCharacteristics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverageAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectRecommendationRunItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "ProjectEventType" NOT NULL,
    "workflowStage" "ProjectWorkflowStage",
    "catalogItemId" TEXT,
    "collateralId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectRecommendationRun_projectId_createdAt_idx" ON "ProjectRecommendationRun"("projectId", "createdAt");
CREATE INDEX "ProjectRecommendationRun_userId_createdAt_idx" ON "ProjectRecommendationRun"("userId", "createdAt");

CREATE INDEX "ProjectRecommendationRunItem_runId_rank_idx" ON "ProjectRecommendationRunItem"("runId", "rank");
CREATE INDEX "ProjectRecommendationRunItem_catalogItemId_createdAt_idx" ON "ProjectRecommendationRunItem"("catalogItemId", "createdAt");

CREATE INDEX "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");
CREATE INDEX "ProjectEvent_eventType_createdAt_idx" ON "ProjectEvent"("eventType", "createdAt");
CREATE INDEX "ProjectEvent_userId_createdAt_idx" ON "ProjectEvent"("userId", "createdAt");
CREATE INDEX "ProjectEvent_catalogItemId_createdAt_idx" ON "ProjectEvent"("catalogItemId", "createdAt");
CREATE INDEX "ProjectEvent_collateralId_createdAt_idx" ON "ProjectEvent"("collateralId", "createdAt");

ALTER TABLE "ProjectRecommendationRun"
    ADD CONSTRAINT "ProjectRecommendationRun_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRecommendationRun"
    ADD CONSTRAINT "ProjectRecommendationRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectRecommendationRunItem"
    ADD CONSTRAINT "ProjectRecommendationRunItem_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ProjectRecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRecommendationRunItem"
    ADD CONSTRAINT "ProjectRecommendationRunItem_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectEvent"
    ADD CONSTRAINT "ProjectEvent_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectEvent"
    ADD CONSTRAINT "ProjectEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectEvent"
    ADD CONSTRAINT "ProjectEvent_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
