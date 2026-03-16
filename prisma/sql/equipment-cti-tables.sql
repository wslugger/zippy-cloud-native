-- Physical CTI-style equipment tables synchronized from CatalogItem + Equipment* tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_category') THEN
    CREATE TYPE equipment_category AS ENUM ('WAN', 'LAN', 'WLAN');
  END IF;
END $$;

-- Remove prior compatibility views if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'equipment_wan' AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW public.equipment_wan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'equipment_lan' AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW public.equipment_lan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'equipment_wlan' AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW public.equipment_wlan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'equipment' AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW public.equipment';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS equipment (
  id VARCHAR(100) PRIMARY KEY,
  primary_category equipment_category NOT NULL,
  secondary_categories equipment_category[] DEFAULT '{}',
  make VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  pricing_sku VARCHAR(100),
  family VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_primary_cat ON equipment(primary_category);
CREATE INDEX IF NOT EXISTS idx_equipment_secondary_cat ON equipment USING GIN (secondary_categories);

CREATE TABLE IF NOT EXISTS equipment_wan (
  equipment_id VARCHAR(100) PRIMARY KEY REFERENCES equipment(id) ON DELETE CASCADE,
  throughput_mbps INTEGER,
  vpn_tunnels INTEGER,
  cellular_support BOOLEAN DEFAULT false,
  form_factor VARCHAR(50),
  interfaces JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS equipment_lan (
  equipment_id VARCHAR(100) PRIMARY KEY REFERENCES equipment(id) ON DELETE CASCADE,
  port_count INTEGER,
  port_speed VARCHAR(20),
  poe_budget_watts INTEGER,
  stackable BOOLEAN DEFAULT false,
  uplink_ports JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS equipment_wlan (
  equipment_id VARCHAR(100) PRIMARY KEY REFERENCES equipment(id) ON DELETE CASCADE,
  wifi_standard VARCHAR(50),
  max_clients INTEGER,
  indoor_outdoor VARCHAR(20),
  radios JSONB DEFAULT '[]'::jsonb
);

CREATE OR REPLACE FUNCTION sync_equipment_base(p_catalog_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO equipment (
    id,
    primary_category,
    secondary_categories,
    make,
    model,
    pricing_sku,
    family,
    description,
    created_at,
    updated_at
  )
  SELECT
    c."id"::varchar(100),
    c."primaryPurpose"::text::equipment_category,
    COALESCE(
      ARRAY(
        SELECT purpose::text::equipment_category
        FROM unnest(c."secondaryPurposes") AS purpose
      ),
      ARRAY[]::equipment_category[]
    ),
    LEFT(ep."make", 50)::varchar(50),
    LEFT(ep."model", 100)::varchar(100),
    LEFT(ep."pricingSku", 100)::varchar(100),
    LEFT(ep."family", 100)::varchar(100),
    c."detailedDescription",
    c."createdAt",
    c."updatedAt"
  FROM "CatalogItem" c
  JOIN "EquipmentProfile" ep ON ep."catalogItemId" = c."id"
  WHERE c."id" = p_catalog_item_id
    AND c."type" = 'HARDWARE'
    AND c."primaryPurpose" IS NOT NULL
  ON CONFLICT (id) DO UPDATE
  SET
    primary_category = EXCLUDED.primary_category,
    secondary_categories = EXCLUDED.secondary_categories,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    pricing_sku = EXCLUDED.pricing_sku,
    family = EXCLUDED.family,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at;

  DELETE FROM equipment e
  WHERE e.id = p_catalog_item_id
    AND NOT EXISTS (
      SELECT 1
      FROM "CatalogItem" c
      JOIN "EquipmentProfile" ep ON ep."catalogItemId" = c."id"
      WHERE c."id" = p_catalog_item_id
        AND c."type" = 'HARDWARE'
        AND c."primaryPurpose" IS NOT NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION sync_equipment_wan(p_catalog_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO equipment_wan (equipment_id, throughput_mbps, vpn_tunnels, cellular_support, form_factor, interfaces)
  SELECT
    ws."catalogItemId"::varchar(100),
    ws."throughputMbps",
    ws."vpnTunnels",
    ws."cellularSupport",
    LEFT(ws."formFactor", 50)::varchar(50),
    ws."interfaces"
  FROM "EquipmentWanSpec" ws
  JOIN equipment e ON e.id = ws."catalogItemId"
  WHERE ws."catalogItemId" = p_catalog_item_id
  ON CONFLICT (equipment_id) DO UPDATE
  SET
    throughput_mbps = EXCLUDED.throughput_mbps,
    vpn_tunnels = EXCLUDED.vpn_tunnels,
    cellular_support = EXCLUDED.cellular_support,
    form_factor = EXCLUDED.form_factor,
    interfaces = EXCLUDED.interfaces;

  DELETE FROM equipment_wan ew
  WHERE ew.equipment_id = p_catalog_item_id
    AND NOT EXISTS (
      SELECT 1
      FROM "EquipmentWanSpec" ws
      JOIN equipment e ON e.id = ws."catalogItemId"
      WHERE ws."catalogItemId" = p_catalog_item_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION sync_equipment_lan(p_catalog_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO equipment_lan (equipment_id, port_count, port_speed, poe_budget_watts, stackable, uplink_ports)
  SELECT
    ls."catalogItemId"::varchar(100),
    ls."portCount",
    LEFT(ls."portSpeed", 20)::varchar(20),
    ls."poeBudgetWatts",
    ls."stackable",
    ls."uplinkPorts"
  FROM "EquipmentLanSpec" ls
  JOIN equipment e ON e.id = ls."catalogItemId"
  WHERE ls."catalogItemId" = p_catalog_item_id
  ON CONFLICT (equipment_id) DO UPDATE
  SET
    port_count = EXCLUDED.port_count,
    port_speed = EXCLUDED.port_speed,
    poe_budget_watts = EXCLUDED.poe_budget_watts,
    stackable = EXCLUDED.stackable,
    uplink_ports = EXCLUDED.uplink_ports;

  DELETE FROM equipment_lan el
  WHERE el.equipment_id = p_catalog_item_id
    AND NOT EXISTS (
      SELECT 1
      FROM "EquipmentLanSpec" ls
      JOIN equipment e ON e.id = ls."catalogItemId"
      WHERE ls."catalogItemId" = p_catalog_item_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION sync_equipment_wlan(p_catalog_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO equipment_wlan (equipment_id, wifi_standard, max_clients, indoor_outdoor, radios)
  SELECT
    ws."catalogItemId"::varchar(100),
    LEFT(ws."wifiStandard", 50)::varchar(50),
    ws."maxClients",
    LEFT(ws."indoorOutdoor", 20)::varchar(20),
    ws."radios"
  FROM "EquipmentWlanSpec" ws
  JOIN equipment e ON e.id = ws."catalogItemId"
  WHERE ws."catalogItemId" = p_catalog_item_id
  ON CONFLICT (equipment_id) DO UPDATE
  SET
    wifi_standard = EXCLUDED.wifi_standard,
    max_clients = EXCLUDED.max_clients,
    indoor_outdoor = EXCLUDED.indoor_outdoor,
    radios = EXCLUDED.radios;

  DELETE FROM equipment_wlan ew
  WHERE ew.equipment_id = p_catalog_item_id
    AND NOT EXISTS (
      SELECT 1
      FROM "EquipmentWlanSpec" ws
      JOIN equipment e ON e.id = ws."catalogItemId"
      WHERE ws."catalogItemId" = p_catalog_item_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_equipment_from_catalog_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_equipment_base(OLD."id");
  ELSE
    PERFORM sync_equipment_base(NEW."id");
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_equipment_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_equipment_base(OLD."catalogItemId");
  ELSE
    PERFORM sync_equipment_base(NEW."catalogItemId");
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_equipment_wan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."catalogItemId" ELSE NEW."catalogItemId" END;
  PERFORM sync_equipment_wan(target_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_equipment_lan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."catalogItemId" ELSE NEW."catalogItemId" END;
  PERFORM sync_equipment_lan(target_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_equipment_wlan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."catalogItemId" ELSE NEW."catalogItemId" END;
  PERFORM sync_equipment_wlan(target_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_equipment_from_catalog_item ON "CatalogItem";
CREATE TRIGGER trg_sync_equipment_from_catalog_item
AFTER INSERT OR UPDATE OF "type", "primaryPurpose", "secondaryPurposes", "detailedDescription", "updatedAt" OR DELETE
ON "CatalogItem"
FOR EACH ROW EXECUTE FUNCTION trg_sync_equipment_from_catalog_item();

DROP TRIGGER IF EXISTS trg_sync_equipment_from_profile ON "EquipmentProfile";
CREATE TRIGGER trg_sync_equipment_from_profile
AFTER INSERT OR UPDATE OF "make", "model", "pricingSku", "family", "catalogItemId" OR DELETE
ON "EquipmentProfile"
FOR EACH ROW EXECUTE FUNCTION trg_sync_equipment_from_profile();

DROP TRIGGER IF EXISTS trg_sync_equipment_wan ON "EquipmentWanSpec";
CREATE TRIGGER trg_sync_equipment_wan
AFTER INSERT OR UPDATE OR DELETE
ON "EquipmentWanSpec"
FOR EACH ROW EXECUTE FUNCTION trg_sync_equipment_wan();

DROP TRIGGER IF EXISTS trg_sync_equipment_lan ON "EquipmentLanSpec";
CREATE TRIGGER trg_sync_equipment_lan
AFTER INSERT OR UPDATE OR DELETE
ON "EquipmentLanSpec"
FOR EACH ROW EXECUTE FUNCTION trg_sync_equipment_lan();

DROP TRIGGER IF EXISTS trg_sync_equipment_wlan ON "EquipmentWlanSpec";
CREATE TRIGGER trg_sync_equipment_wlan
AFTER INSERT OR UPDATE OR DELETE
ON "EquipmentWlanSpec"
FOR EACH ROW EXECUTE FUNCTION trg_sync_equipment_wlan();

-- Initial backfill from current canonical tables.
INSERT INTO equipment (
  id,
  primary_category,
  secondary_categories,
  make,
  model,
  pricing_sku,
  family,
  description,
  created_at,
  updated_at
)
SELECT
  c."id"::varchar(100),
  c."primaryPurpose"::text::equipment_category,
  COALESCE(
    ARRAY(
      SELECT purpose::text::equipment_category
      FROM unnest(c."secondaryPurposes") AS purpose
    ),
    ARRAY[]::equipment_category[]
  ),
  LEFT(ep."make", 50)::varchar(50),
  LEFT(ep."model", 100)::varchar(100),
  LEFT(ep."pricingSku", 100)::varchar(100),
  LEFT(ep."family", 100)::varchar(100),
  c."detailedDescription",
  c."createdAt",
  c."updatedAt"
FROM "CatalogItem" c
JOIN "EquipmentProfile" ep ON ep."catalogItemId" = c."id"
WHERE c."type" = 'HARDWARE'
  AND c."primaryPurpose" IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET
  primary_category = EXCLUDED.primary_category,
  secondary_categories = EXCLUDED.secondary_categories,
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  pricing_sku = EXCLUDED.pricing_sku,
  family = EXCLUDED.family,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;

DELETE FROM equipment e
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogItem" c
  JOIN "EquipmentProfile" ep ON ep."catalogItemId" = c."id"
  WHERE c."id" = e.id
    AND c."type" = 'HARDWARE'
    AND c."primaryPurpose" IS NOT NULL
);

INSERT INTO equipment_wan (equipment_id, throughput_mbps, vpn_tunnels, cellular_support, form_factor, interfaces)
SELECT
  ws."catalogItemId"::varchar(100),
  ws."throughputMbps",
  ws."vpnTunnels",
  ws."cellularSupport",
  LEFT(ws."formFactor", 50)::varchar(50),
  ws."interfaces"
FROM "EquipmentWanSpec" ws
JOIN equipment e ON e.id = ws."catalogItemId"
ON CONFLICT (equipment_id) DO UPDATE
SET
  throughput_mbps = EXCLUDED.throughput_mbps,
  vpn_tunnels = EXCLUDED.vpn_tunnels,
  cellular_support = EXCLUDED.cellular_support,
  form_factor = EXCLUDED.form_factor,
  interfaces = EXCLUDED.interfaces;

DELETE FROM equipment_wan ew
WHERE NOT EXISTS (
  SELECT 1
  FROM "EquipmentWanSpec" ws
  JOIN equipment e ON e.id = ws."catalogItemId"
  WHERE ws."catalogItemId" = ew.equipment_id
);

INSERT INTO equipment_lan (equipment_id, port_count, port_speed, poe_budget_watts, stackable, uplink_ports)
SELECT
  ls."catalogItemId"::varchar(100),
  ls."portCount",
  LEFT(ls."portSpeed", 20)::varchar(20),
  ls."poeBudgetWatts",
  ls."stackable",
  ls."uplinkPorts"
FROM "EquipmentLanSpec" ls
JOIN equipment e ON e.id = ls."catalogItemId"
ON CONFLICT (equipment_id) DO UPDATE
SET
  port_count = EXCLUDED.port_count,
  port_speed = EXCLUDED.port_speed,
  poe_budget_watts = EXCLUDED.poe_budget_watts,
  stackable = EXCLUDED.stackable,
  uplink_ports = EXCLUDED.uplink_ports;

DELETE FROM equipment_lan el
WHERE NOT EXISTS (
  SELECT 1
  FROM "EquipmentLanSpec" ls
  JOIN equipment e ON e.id = ls."catalogItemId"
  WHERE ls."catalogItemId" = el.equipment_id
);

INSERT INTO equipment_wlan (equipment_id, wifi_standard, max_clients, indoor_outdoor, radios)
SELECT
  ws."catalogItemId"::varchar(100),
  LEFT(ws."wifiStandard", 50)::varchar(50),
  ws."maxClients",
  LEFT(ws."indoorOutdoor", 20)::varchar(20),
  ws."radios"
FROM "EquipmentWlanSpec" ws
JOIN equipment e ON e.id = ws."catalogItemId"
ON CONFLICT (equipment_id) DO UPDATE
SET
  wifi_standard = EXCLUDED.wifi_standard,
  max_clients = EXCLUDED.max_clients,
  indoor_outdoor = EXCLUDED.indoor_outdoor,
  radios = EXCLUDED.radios;

DELETE FROM equipment_wlan ew
WHERE NOT EXISTS (
  SELECT 1
  FROM "EquipmentWlanSpec" ws
  JOIN equipment e ON e.id = ws."catalogItemId"
  WHERE ws."catalogItemId" = ew.equipment_id
);
