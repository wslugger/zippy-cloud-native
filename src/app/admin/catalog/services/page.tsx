import CatalogListView from '@/components/admin/catalog/catalog-list-view';

export default function ServicesCatalogPage() {
    return (
        <CatalogListView
            title="Managed Services Catalog"
            description="Manage managed service catalog entries used by package and BOM logic."
            forcedType="MANAGED_SERVICE"
        />
    );
}
