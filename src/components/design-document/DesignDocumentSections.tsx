'use client';

interface FeatureRow {
  termId: string;
  label: string;
  status: string;
}

interface ServiceOptionRow {
  id: string;
  name: string;
  description: string | null;
  selected: boolean;
}

interface DesignOptionValueRow {
  value: string;
  label: string;
}

interface DesignOptionRow {
  key: string;
  label: string;
  required: boolean;
  allowMulti: boolean;
  selectedValues: DesignOptionValueRow[];
  availableValues: DesignOptionValueRow[];
}

interface ServiceSection {
  kind: 'SERVICE';
  catalogItemId: string;
  name: string;
  sku: string;
  itemType: string;
  selected: boolean;
  description: string | null;
  serviceOptions: ServiceOptionRow[];
  designOptions: DesignOptionRow[];
  features: FeatureRow[];
}

interface PackageSection {
  kind: 'PACKAGE';
  catalogItemId: string;
  name: string;
  sku: string;
  description: string | null;
  features: FeatureRow[];
  services: ServiceSection[];
}

interface AppendixEntry {
  catalogItemId: string;
  name: string;
  itemType: string;
  constraints: string[];
  assumptions: string[];
}

export interface DesignDocumentSectionsModel {
  sections: Array<PackageSection | ServiceSection>;
  appendix: AppendixEntry[];
}

function ServiceBlock({ service, nested }: { service: ServiceSection; nested?: boolean }) {
  return (
    <article className={`rounded-xl border ${nested ? 'border-slate-200 bg-slate-50' : 'border-slate-300 bg-white'} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{service.name}</h4>
          <p className="text-[11px] text-slate-500 font-mono">{service.sku} · {service.itemType}</p>
          {service.description && <p className="text-sm text-slate-700 mt-2">{service.description}</p>}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded ${service.selected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
          {service.selected ? 'Selected' : 'Available'}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Service Options</p>
        {service.serviceOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No service options.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {service.serviceOptions.map((option) => (
              <span
                key={option.id}
                className={`text-xs px-2 py-1 rounded border ${option.selected ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600'}`}
              >
                {option.name} ({option.selected ? 'Selected' : 'Available'})
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Design Options</p>
        {service.designOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No design options.</p>
        ) : (
          <div className="space-y-2">
            {service.designOptions.map((option) => (
              <div key={option.key} className="rounded border border-slate-200 bg-white p-2">
                <p className="text-xs font-semibold text-slate-800">{option.label}</p>
                <p className="text-[11px] text-slate-600">
                  Selected: {option.selectedValues.length > 0 ? option.selectedValues.map((value) => value.label).join(', ') : 'Default/None'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Available: {option.availableValues.length > 0 ? option.availableValues.map((value) => value.label).join(', ') : 'None'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Features</p>
        {service.features.length === 0 ? (
          <p className="text-xs text-slate-500">No features listed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {service.features.map((feature) => (
              <span key={feature.termId} className="text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-700">
                {feature.label}: {feature.status}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function DesignDocumentSections({ sections, appendix }: DesignDocumentSectionsModel) {
  return (
    <div className="space-y-6">
      {sections.map((section) =>
        section.kind === 'PACKAGE' ? (
          <section key={`package-${section.catalogItemId}`} className="rounded-2xl border border-slate-300 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{section.name}</h3>
              <p className="text-[11px] text-slate-500 font-mono">{section.sku} · PACKAGE</p>
              {section.description && <p className="text-sm text-slate-700 mt-2">{section.description}</p>}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Package Feature Status</p>
              {section.features.length === 0 ? (
                <p className="text-xs text-slate-500">No package features listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {section.features.map((feature) => (
                    <span key={feature.termId} className="text-xs px-2 py-1 rounded border border-slate-300 bg-slate-100 text-slate-700">
                      {feature.label}: {feature.status}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Services</p>
              {section.services.length === 0 ? (
                <p className="text-xs text-slate-500">No services listed in this package.</p>
              ) : (
                section.services.map((service) => (
                  <ServiceBlock key={`service-${service.catalogItemId}`} service={service} nested />
                ))
              )}
            </div>
          </section>
        ) : (
          <ServiceBlock key={`service-${section.catalogItemId}`} service={section} />
        )
      )}

      <section className="rounded-2xl border border-slate-300 bg-white p-5 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Appendix: Constraints and Assumptions</h3>
        {appendix.length === 0 ? (
          <p className="text-sm text-slate-500">No appendix entries available.</p>
        ) : (
          <div className="space-y-3">
            {appendix.map((entry) => (
              <article key={entry.catalogItemId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{entry.name}</p>
                <p className="text-[11px] text-slate-500 mb-2">{entry.itemType}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Constraints</p>
                {entry.constraints.length === 0 ? (
                  <p className="text-xs text-slate-500">None.</p>
                ) : (
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
                    {entry.constraints.map((constraint, index) => (
                      <li key={`${entry.catalogItemId}-constraint-${index}`}>{constraint}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-2">Assumptions</p>
                {entry.assumptions.length === 0 ? (
                  <p className="text-xs text-slate-500">None.</p>
                ) : (
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
                    {entry.assumptions.map((assumption, index) => (
                      <li key={`${entry.catalogItemId}-assumption-${index}`}>{assumption}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
