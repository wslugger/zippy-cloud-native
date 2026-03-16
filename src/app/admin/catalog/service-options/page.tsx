import CatalogListView from '@/components/admin/catalog/catalog-list-view';

export default function ServiceOptionsCatalogPage() {
    return (
        <CatalogListView
            title="Service Options Catalog"
            description="Manage optional service add-ons and variants."
            forcedType="SERVICE_OPTION"
        />
    );
}
