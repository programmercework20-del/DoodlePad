import { BarChart3, Eye, IndianRupee, MousePointerClick, TrendingUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import EmptyState from '@/components/common/EmptyState';
import StatCard from '@/components/cards/StatCard';
import { Badge } from '@/components/ui/badge';
import { useFetch } from '@/hooks/useFetch';
import { revenueService } from '@/services/revenue.service';
import DataTable from '@/components/common/DataTable';
import Avatar from '@/components/common/Avatar';

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function RevenueDashboard() {
    const { data, loading, error } = useFetch(() => revenueService.getOverview(), []);
    const [currentPage, setCurrentPage] = useState(1);

    const paginatedAds = useMemo(() => {
        if (!data?.ads) return [];
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.ads.slice(start, start + ITEMS_PER_PAGE);
    }, [data?.ads, currentPage]);

    const paginationInfo = useMemo(() => {
        if (!data?.ads) return null;
        return {
            total: data.ads.length,
            pages: Math.ceil(data.ads.length / ITEMS_PER_PAGE)
        };
    }, [data?.ads]);

    const COLUMNS = useMemo(() => [
        {
            key: 'title',
            label: 'Ad',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        src={row.image} 
                        name={row.title} 
                        className="h-10 w-10 rounded-lg shrink-0 object-cover"
                    />
                    <div>
                        <div className="font-medium text-gray-900">{row.title}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">{row.status}</div>
                    </div>
                </div>
            )
        },
        { key: 'clicks', label: 'Clicks', render: (row) => formatNumber(row.clicks) },
        { key: 'impressions', label: 'Impressions', render: (row) => formatNumber(row.impressions) },
        { key: 'ctr', label: 'CTR', render: (row) => `${Number(row.ctr).toFixed(2)}%` },
        { key: 'cpcRevenue', label: 'CPC', render: (row) => formatCurrency(row.cpcRevenue) },
        { key: 'cpmRevenue', label: 'CPM', render: (row) => formatCurrency(row.cpmRevenue) },
        {
            key: 'totalRevenue',
            label: 'Total',
            render: (row) => <span className="font-semibold text-gray-900">{formatCurrency(row.totalRevenue)}</span>
        }
    ], []);

    if (loading) return (
        <AdminLayout>
            <Loader size="lg" className="py-16" />
        </AdminLayout>
    );

    if (!data) return (
        <AdminLayout>
            <EmptyState
                icon={BarChart3}
                title="Revenue data unavailable"
                description="Create ads and track activity to build your analytics view."
            />
        </AdminLayout>
    );

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Revenue Dashboard</h1>
                        <p className="mt-1 text-gray-500">
                            Monitor CPC, CPM, CTR, and the ads generating the strongest results.
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                        <div className="text-xs uppercase tracking-[0.25em] text-gray-400">Blended CTR</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900">
                            {Number(data?.ctr || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading revenue data: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Total Revenue" value={formatCurrency(data.totalRevenue)} icon={IndianRupee} />
                    <StatCard title="Paid Budget" value={formatCurrency(data.totalPaid)} icon={TrendingUp} />
                    <StatCard title="Total Clicks" value={formatNumber(data.totalClicks)} icon={MousePointerClick} />
                    <StatCard title="Total Impressions" value={formatNumber(data.totalImpressions)} icon={Eye} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
                    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                        <div className="border-b px-6 py-5 text-gray-900 font-semibold">
                            Top Performing Ads
                        </div>
                        {data.topPerformingAds?.length ? (
                            <div className="divide-y">
                                {data.topPerformingAds.map((ad, index) => (
                                    <div key={ad.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <div className="font-medium text-gray-900">{ad.title}</div>
                                                <div className="text-sm text-gray-500">
                                                    {formatNumber(ad.clicks)} clicks · {formatNumber(ad.impressions)} views
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-gray-900">{formatCurrency(ad.totalRevenue)}</div>
                                            <Badge variant="outline" className="mt-1">{ad.type}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500">No performance data yet</div>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                        <div className="border-b px-6 py-5 text-gray-900 font-semibold">
                            Revenue Formula
                        </div>
                        <div className="space-y-4 p-6">
                            <FormulaCard
                                title="CPC"
                                formula="clicks x 5"
                                description="Each click contributes Rs 5 to ad revenue."
                            />
                            <FormulaCard
                                title="CPM"
                                formula="(impressions / 1000) x 100"
                                description="Every thousand impressions contributes Rs 100."
                            />
                            <FormulaCard
                                title="CTR"
                                formula="(clicks / impressions) x 100"
                                description="Engagement quality across campaigns."
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                    <div className="border-b px-6 py-5">
                        <h2 className="text-lg font-semibold text-gray-900">Ad Revenue Breakdown</h2>
                        <p className="mt-1 text-sm text-gray-500">Comprehensive view of campaign earnings.</p>
                    </div>
                    <div className="p-4">
                        <DataTable
                            columns={COLUMNS}
                            data={paginatedAds}
                            pagination={paginationInfo}
                            page={currentPage}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function FormulaCard({ title, formula, description }) {
    return (
        <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{formula}</div>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
    );
}
