import CatalogListView from '@/components/admin/catalog/catalog-list-view';

export default function HardwareCatalogPage() {
    return (
        <CatalogListView
            title="Hardware Catalog"
            description="Manage equipment inventory and datasheet-driven ingestion."
            forcedType="HARDWARE"
            showIngestion
        />
    );
}
