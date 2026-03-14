-- Add structured design option selections for project/site items.
ALTER TABLE "ProjectItem"
  ADD COLUMN "designOptionValues" JSONB;

ALTER TABLE "SiteSelection"
  ADD COLUMN "designOptionValues" JSONB;

-- Add persisted design document metadata with editable AI-authored sections.
CREATE TYPE "DesignDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "ProjectDesignDocument" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "DesignDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL DEFAULT 'Design Document',
  "executiveSummary" TEXT,
  "conclusions" TEXT,
  "generatorModel" TEXT,
  "generationMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDesignDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectDesignDocument_projectId_version_key"
  ON "ProjectDesignDocument"("projectId", "version");

CREATE INDEX "ProjectDesignDocument_projectId_status_idx"
  ON "ProjectDesignDocument"("projectId", "status");

ALTER TABLE "ProjectDesignDocument"
  ADD CONSTRAINT "ProjectDesignDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
