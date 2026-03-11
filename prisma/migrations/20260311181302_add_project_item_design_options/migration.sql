-- AlterTable
ALTER TABLE "ProjectItem" ADD COLUMN     "configValues" JSONB;

-- CreateTable
CREATE TABLE "ProjectItemDesignOption" (
    "id" TEXT NOT NULL,
    "projectItemId" TEXT NOT NULL,
    "taxonomyTermId" TEXT NOT NULL,

    CONSTRAINT "ProjectItemDesignOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectItemDesignOption_projectItemId_taxonomyTermId_key" ON "ProjectItemDesignOption"("projectItemId", "taxonomyTermId");

-- AddForeignKey
ALTER TABLE "ProjectItemDesignOption" ADD CONSTRAINT "ProjectItemDesignOption_projectItemId_fkey" FOREIGN KEY ("projectItemId") REFERENCES "ProjectItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItemDesignOption" ADD CONSTRAINT "ProjectItemDesignOption_taxonomyTermId_fkey" FOREIGN KEY ("taxonomyTermId") REFERENCES "TaxonomyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
