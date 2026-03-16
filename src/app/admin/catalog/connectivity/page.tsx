import CatalogListView from '@/components/admin/catalog/catalog-list-view';

export default function ConnectivityCatalogPage() {
    return (
        <CatalogListView
            title="Connectivity Catalog"
            description="Manage connectivity SKUs and provider-specific options."
            forcedType="CONNECTIVITY"
        />
    );
}
