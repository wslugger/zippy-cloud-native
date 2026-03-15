-- Remove the legacy SERVICE_FAMILY classification taxonomy term.
-- A MANAGED_SERVICE classification term already exists, making this redundant.
DELETE FROM "TaxonomyTerm"
WHERE "category" = 'CLASSIFICATION' AND "value" = 'SERVICE_FAMILY';

-- Update the MANAGED_SERVICE classification label from "Managed Service" to "Services".
UPDATE "TaxonomyTerm"
SET "label" = 'Services'
WHERE "category" = 'CLASSIFICATION' AND "value" = 'MANAGED_SERVICE';

-- Remove the legacy SERVICE_FAMILY panel visibility term.
-- A MANAGED_SERVICE entry already exists for PANEL_SERVICE_OPTIONS.
DELETE FROM "TaxonomyTerm"
WHERE "category" = 'PANEL_SERVICE_OPTIONS' AND "value" = 'SERVICE_FAMILY';
