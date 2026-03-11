import { prisma } from "@/lib/prisma";
import {
    Package,
    Cpu,
    FileCheck,
    Layers,
    Activity,
    ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
    // Fetch some summary stats
    const [itemsCount, packageCount, dependencyCount, promptCount] = await Promise.all([
        prisma.catalogItem.count(),
        prisma.catalogItem.count({ where: { type: 'PACKAGE' } }),
        prisma.itemDependency.count(),
        prisma.systemConfig.count({ where: { key: { startsWith: 'PROMPT_' } } })
    ]);

    const stats = [
        { name: 'Total Catalog items', value: itemsCount, icon: Layers, color: 'text-blue-500' },
        { name: 'Active Packages', value: packageCount, icon: Package, color: 'text-emerald-500' },
        { name: 'BOM Dependency Rules', value: dependencyCount, icon: Cpu, color: 'text-purple-500' },
        { name: 'Managed AI Prompts', value: promptCount, icon: Activity, color: 'text-orange-500' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
                <p className="text-slate-600">Manage the technical core of Zippy Networks.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm transition-all hover:border-slate-300">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <span className="text-sm font-medium text-slate-600">
                                {stat.name}
                            </span>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 p-6 rounded-xl bg-white border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/admin/taxonomy" className="group p-4 rounded-lg bg-slate-100/50 hover:bg-slate-100 border border-slate-300/50 border-dashed transition-all">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Define Taxonomy</span>
                                <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Manage statuses, tiers, and technical metadata.</p>
                        </Link>
                        <Link href="/admin/prompts" className="group p-4 rounded-lg bg-slate-100/50 hover:bg-slate-100 border border-slate-300/50 border-dashed transition-all">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Update AI Prompts</span>
                                <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Refine the logic used for automated BOM generation.</p>
                        </Link>
                    </div>
                </div>

                <div className="col-span-3 p-6 rounded-xl bg-white border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4">System Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Database Connection</span>
                            <span className="flex items-center gap-2 text-emerald-500 font-medium">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Healthy
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Prisma Engine</span>
                            <span className="text-slate-800">v7.0.0 (Adapter-PG)</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Environment</span>
                            <span className="text-blue-600 font-medium px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                Production Standalone
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
