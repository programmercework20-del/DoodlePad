import { BarChart3, ChevronLeft, ChevronRight, Eye, IndianRupee, MousePointerClick, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import EmptyState from '@/components/common/EmptyState';
import StatCard from '@/components/cards/StatCard';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button-1';
import { useFetch } from '@/hooks/useFetch';
import { revenueService } from '@/services/revenue.service';

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function RevenueDashboard() {
    const { data, loading } = useFetch(() => revenueService.getOverview(), []);
    const [currentPage, setCurrentPage] = useState(1);

    const totalAds = data?.ads?.length || 0;
    const totalPages = Math.ceil(totalAds / ITEMS_PER_PAGE);

    // Get current items
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentAds = data?.ads?.slice(indexOfFirstItem, indexOfLastItem) || [];

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

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

                {loading ? (
                    <Loader size="lg" className="py-16" />
                ) : !data ? (
                    <EmptyState
                        icon={BarChart3}
                        title="Revenue data unavailable"
                        description="Create ads and track activity to build your analytics view."
                    />
                ) : (
                    <>
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                            <StatCard title="Total Revenue" value={formatCurrency(data.totalRevenue)} icon={IndianRupee} />
                            <StatCard title="Paid Budget" value={formatCurrency(data.totalPaid)} icon={TrendingUp} />
                            <StatCard title="Total Clicks" value={formatNumber(data.totalClicks)} icon={MousePointerClick} />
                            <StatCard title="Total Impressions" value={formatNumber(data.totalImpressions)} icon={Eye} />
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
                            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                                <div className="border-b px-6 py-5">
                                    <h2 className="text-lg font-semibold text-gray-900">Top Performing Ads</h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Ranked by total combined CPC and CPM revenue.
                                    </p>
                                </div>

                                {data.topPerformingAds?.length ? (
                                    <div className="divide-y">
                                        {data.topPerformingAds.map((ad, index) => (
                                            <div key={ad.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                                                            {index + 1}
                                                        </span>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{ad.title}</div>
                                                            <div className="text-sm text-gray-500">
                                                                {formatNumber(ad.clicks)} clicks and {formatNumber(ad.impressions)} impressions
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-gray-900">{formatCurrency(ad.totalRevenue)}</div>
                                                    <Badge variant="outline">{ad.type}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6">
                                        <EmptyState
                                            icon={TrendingUp}
                                            title="No performance data yet"
                                            description="Once views and clicks start coming in, your top ads will appear here."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                                <div className="border-b px-6 py-5">
                                    <h2 className="text-lg font-semibold text-gray-900">Revenue Formula</h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        The dashboard uses your requested blended mock logic.
                                    </p>
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
                                        description="CTR helps compare engagement quality across campaigns."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                            <div className="border-b px-6 py-5">
                                <h2 className="text-lg font-semibold text-gray-900">Ad Revenue Breakdown</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    A quick view across every campaign in the system.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px]">
                                    <thead className="bg-gray-50">
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="px-6 py-4">Ad</th>
                                            <th className="px-6 py-4">Clicks</th>
                                            <th className="px-6 py-4">Impressions</th>
                                            <th className="px-6 py-4">CTR</th>
                                            <th className="px-6 py-4">CPC</th>
                                            <th className="px-6 py-4">CPM</th>
                                            <th className="px-6 py-4">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                         {currentAds.map((ad) => (
                                             <tr key={ad.id} className="hover:bg-gray-50/70">
                                                 <td className="px-6 py-5">
                                                     <div className="font-medium text-gray-900">{ad.title}</div>
                                                     <div className="text-sm text-gray-500">{ad.status}</div>
                                                 </td>
                                                 <td className="px-6 py-5 text-sm text-gray-700">{formatNumber(ad.clicks)}</td>
                                                 <td className="px-6 py-5 text-sm text-gray-700">{formatNumber(ad.impressions)}</td>
                                                 <td className="px-6 py-5 text-sm text-gray-700">{Number(ad.ctr).toFixed(2)}%</td>
                                                 <td className="px-6 py-5 text-sm text-gray-700">{formatCurrency(ad.cpcRevenue)}</td>
                                                 <td className="px-6 py-5 text-sm text-gray-700">{formatCurrency(ad.cpmRevenue)}</td>
                                                 <td className="px-6 py-5 text-sm font-semibold text-gray-900">
                                                     {formatCurrency(ad.totalRevenue)}
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>

                             {totalPages > 1 && (
                                 <div className="border-t px-6 py-4">
                                     <Pagination>
                                         <PaginationContent>
                                             <PaginationItem>
                                                 <Button
                                                     variant="ghost"
                                                     disabled={currentPage === 1}
                                                     onClick={() => handlePageChange(currentPage - 1)}
                                                     className="gap-1"
                                                 >
                                                     <ChevronLeft className="h-4 w-4" />
                                                     Previous
                                                 </Button>
                                             </PaginationItem>

                                             {[...Array(totalPages)].map((_, index) => {
                                                 const page = index + 1;
                                                 // Simple logic to show numbers, could be improved with ellipses for many pages
                                                 if (
                                                     totalPages <= 7 ||
                                                     page === 1 ||
                                                     page === totalPages ||
                                                     (page >= currentPage - 1 && page <= currentPage + 1)
                                                 ) {
                                                     return (
                                                         <PaginationItem key={page}>
                                                             <Button
                                                                 variant={currentPage === page ? "outline" : "ghost"}
                                                                 size="icon"
                                                                 onClick={() => handlePageChange(page)}
                                                             >
                                                                 {page}
                                                             </Button>
                                                         </PaginationItem>
                                                     );
                                                 } else if (
                                                     (page === currentPage - 2 && page > 1) ||
                                                     (page === currentPage + 2 && page < totalPages)
                                                 ) {
                                                     return (
                                                         <PaginationItem key={page}>
                                                             <PaginationEllipsis />
                                                         </PaginationItem>
                                                     );
                                                 }
                                                 return null;
                                             })}

                                             <PaginationItem>
                                                 <Button
                                                     variant="ghost"
                                                     disabled={currentPage === totalPages}
                                                     onClick={() => handlePageChange(currentPage + 1)}
                                                     className="gap-1"
                                                 >
                                                     Next
                                                     <ChevronRight className="h-4 w-4" />
                                                 </Button>
                                             </PaginationItem>
                                         </PaginationContent>
                                     </Pagination>
                                 </div>
                             )}
                         </div>
                    </>
                )}
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
