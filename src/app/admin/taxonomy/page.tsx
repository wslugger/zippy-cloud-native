'use client';

import { useState } from 'react';
import { useTaxonomySharedData } from './hooks/use-taxonomy-shared-data';
import { TermsWorkspace } from './workspaces/terms-workspace';
import { DesignOptionsWorkspace } from './workspaces/design-options-workspace';
import { FeaturesWorkspace } from './workspaces/features-workspace';
import type { WorkspaceTab } from './types';

export default function TaxonomyPage() {
    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('design-options');
    const shared = useTaxonomySharedData();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Taxonomy Manager</h2>
                        <p className="text-slate-600 font-medium">Manage taxonomy terms and design option builder from one place.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWorkspaceTab('design-options')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'design-options'
                                ? 'bg-zippy-green text-white border-zippy-green'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Design Options Builder
                        </button>
                        <button
                            onClick={() => setWorkspaceTab('terms')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'terms'
                                ? 'bg-zippy-green text-white border-zippy-green'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Taxonomy Terms
                        </button>
                        <button
                            onClick={() => setWorkspaceTab('features')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'features'
                                ? 'bg-zippy-green text-white border-zippy-green'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Features Builder
                        </button>
                    </div>
                </div>
            </section>

            <TermsWorkspace
                isActive={workspaceTab === 'terms'}
                terms={shared.terms}
                termsLoading={shared.termsLoading}
                termsError={shared.termsError}
                clearTermsError={shared.clearTermsError}
                reloadTerms={shared.reloadTerms}
            />

            <DesignOptionsWorkspace
                isActive={workspaceTab === 'design-options'}
                services={shared.services}
                selectedServiceId={shared.selectedServiceId}
                setSelectedServiceId={shared.setSelectedServiceId}
                servicesLoading={shared.servicesLoading}
                servicesError={shared.servicesError}
            />

            <FeaturesWorkspace
                isActive={workspaceTab === 'features'}
                terms={shared.terms}
                services={shared.services}
                selectedServiceId={shared.selectedServiceId}
                setSelectedServiceId={shared.setSelectedServiceId}
                termsLoading={shared.termsLoading}
                termsError={shared.termsError}
                servicesLoading={shared.servicesLoading}
                servicesError={shared.servicesError}
                reloadTerms={shared.reloadTerms}
            />
        </div>
    );
}
