DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_category') THEN
    CREATE TYPE equipment_category AS ENUM ('WAN', 'LAN', 'WLAN');
  END IF;
END $$;

CREATE OR REPLACE VIEW equipment AS
SELECT
  c."id"::varchar(100) AS id,
  c."primaryPurpose"::text::equipment_category AS primary_category,
  COALESCE(
    ARRAY(
      SELECT purpose::text::equipment_category
      FROM unnest(c."secondaryPurposes") AS purpose
    ),
    ARRAY[]::equipment_category[]
  ) AS secondary_categories,
  ep."make"::varchar(50) AS make,
  ep."model"::varchar(100) AS model,
  ep."pricingSku"::varchar(100) AS pricing_sku,
  ep."family"::varchar(100) AS family,
  c."detailedDescription" AS description,
  c."createdAt" AS created_at,
  c."updatedAt" AS updated_at
FROM "CatalogItem" c
JOIN "EquipmentProfile" ep ON ep."catalogItemId" = c."id"
WHERE c."type" = 'HARDWARE';

CREATE OR REPLACE VIEW equipment_wan AS
SELECT
  ws."catalogItemId"::varchar(100) AS equipment_id,
  ws."throughputMbps" AS throughput_mbps,
  ws."vpnTunnels" AS vpn_tunnels,
  ws."cellularSupport" AS cellular_support,
  ws."formFactor"::varchar(50) AS form_factor,
  ws."interfaces" AS interfaces
FROM "EquipmentWanSpec" ws;

CREATE OR REPLACE VIEW equipment_lan AS
SELECT
  ls."catalogItemId"::varchar(100) AS equipment_id,
  ls."portCount" AS port_count,
  ls."portSpeed"::varchar(20) AS port_speed,
  ls."poeBudgetWatts" AS poe_budget_watts,
  ls."stackable" AS stackable,
  ls."uplinkPorts" AS uplink_ports
FROM "EquipmentLanSpec" ls;

CREATE OR REPLACE VIEW equipment_wlan AS
SELECT
  ws."catalogItemId"::varchar(100) AS equipment_id,
  ws."wifiStandard"::varchar(50) AS wifi_standard,
  ws."maxClients" AS max_clients,
  ws."indoorOutdoor"::varchar(20) AS indoor_outdoor,
  ws."radios" AS radios
FROM "EquipmentWlanSpec" ws;
