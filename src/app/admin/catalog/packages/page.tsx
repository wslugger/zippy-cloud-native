import CatalogListView from '@/components/admin/catalog/catalog-list-view';

export default function PackagesCatalogPage() {
    return (
        <CatalogListView
            title="Package Catalog"
            description="Manage package-level bundles and dependencies."
            forcedType="PACKAGE"
        />
    );
}
