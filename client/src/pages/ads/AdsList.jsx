import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Eye,
    Megaphone,
    MousePointerClick,
    Pencil,
    Plus,
    Search,
    Wallet,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import EmptyState from '@/components/common/EmptyState';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Button as Button1 } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { useFetch } from '@/hooks/useFetch';
import { adService } from '@/services/ad.service';
import { paymentService } from '@/services/payment.service';

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString()}`;
const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function AdsList() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState('');
    const [pendingAction, setPendingAction] = useState('');

    const { data, loading, refetch } = useFetch(
        () => adService.getAllAds({
            search: searchQuery,
            status: statusFilter,
            type: typeFilter,
            page,
            limit: 10,
        }),
        [searchQuery, statusFilter, typeFilter, page]
    );

    const runAction = async (actionKey, handler) => {
        try {
            setActionError('');
            setPendingAction(actionKey);
            await handler();
            await refetch();
        } catch (error) {
            setActionError(error.response?.data?.message || 'Unable to complete that action.');
        } finally {
            setPendingAction('');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this ad permanently?')) {
            return;
        }
        await runAction(`delete-${id}`, () => adService.deleteAd(id));
    };

    const handleToggle = async (id) => {
        await runAction(`toggle-${id}`, () => adService.toggleAdStatus(id));
    };

    const handlePayment = async (ad) => {
        await runAction(`pay-${ad.id}`, () => paymentService.simulatePayment({ adId: ad.id, amount: ad.budget }));
    };

    const handleTrackView = async (id) => {
        await runAction(`view-${id}`, () => adService.trackView(id));
    };

    const handleTrackClick = async (id) => {
        await runAction(`click-${id}`, () => adService.trackClick(id));
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Advertisement</h1>
                        <p className="mt-1 text-gray-500">
                            Manage ad inventory, trigger mock payments, and test engagement tracking.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link to="/payments">
                                <Wallet className="mr-2 h-4 w-4" />
                                Payments
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link to="/revenue">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Revenue
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link to="/ads/create">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Ad
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                    <div className="border-b bg-[linear-gradient(135deg,#eff6ff,#ffffff,#f8fafc)] px-6 py-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr),auto,auto]">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search by title or description"
                                    className="pl-10"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value);
                                    setPage(1);
                                }}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending_payment">Pending Payment</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="draft">Draft</option>
                            </select>

                            <select
                                value={typeFilter}
                                onChange={(event) => {
                                    setTypeFilter(event.target.value);
                                    setPage(1);
                                }}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">All Types</option>
                                <option value="banner">Banner</option>
                                <option value="feed">Feed</option>
                                <option value="popup">Popup</option>
                            </select>
                        </div>
                    </div>

                    {actionError && (
                        <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {actionError}
                        </div>
                    )}

                    {loading ? (
                        <Loader size="lg" className="py-16" />
                    ) : data?.ads?.length ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1080px]">
                                    <thead className="bg-gray-50">
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="px-6 py-4">Campaign</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Budget</th>
                                            <th className="px-6 py-4">Impressions</th>
                                            <th className="px-6 py-4">Clicks</th>
                                            <th className="px-6 py-4">Revenue</th>
                                            <th className="px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.ads.map((ad) => (
                                            <tr key={ad.id} className="align-top hover:bg-gray-50/70">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-start gap-4">
                                                        <img
                                                            src={ad.imageUrl}
                                                            alt={ad.title}
                                                            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200"
                                                        />
                                                        <div className="max-w-xs space-y-1">
                                                            <div className="font-semibold text-gray-900">{ad.title}</div>
                                                            <p className="text-sm text-gray-500">{ad.description}</p>
                                                            <a
                                                                href={ad.redirectUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs text-blue-600 hover:underline"
                                                            >
                                                                {ad.redirectUrl}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <Badge variant="outline">{ad.type}</Badge>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <StatusBadge status={ad.status} />
                                                </td>
                                                <td className="px-6 py-5 text-sm font-medium text-gray-900">
                                                    {formatCurrency(ad.budget)}
                                                </td>
                                                <td className="px-6 py-5 text-sm text-gray-700">
                                                    {formatNumber(ad.impressions)}
                                                </td>
                                                <td className="px-6 py-5 text-sm text-gray-700">
                                                    {formatNumber(ad.clicks)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {formatCurrency(ad.revenue?.totalRevenue)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        CTR {Number(ad.revenue?.ctr || 0).toFixed(2)}%
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button asChild size="sm" variant="outline">
                                                            <Link to={`/ads/${ad.id}/edit`}>
                                                                <Pencil className="mr-1 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={pendingAction === `toggle-${ad.id}`}
                                                            onClick={() => handleToggle(ad.id)}
                                                        >
                                                            {ad.status === 'active' ? 'Deactivate' : 'Activate'}
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={pendingAction === `pay-${ad.id}`}
                                                            onClick={() => handlePayment(ad)}
                                                        >
                                                            Pay
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            disabled={pendingAction === `view-${ad.id}`}
                                                            onClick={() => handleTrackView(ad.id)}
                                                        >
                                                            <Eye className="mr-1 h-4 w-4" />
                                                            +View
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            disabled={pendingAction === `click-${ad.id}`}
                                                            onClick={() => handleTrackClick(ad.id)}
                                                        >
                                                            <MousePointerClick className="mr-1 h-4 w-4" />
                                                            +Click
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={pendingAction === `delete-${ad.id}`}
                                                            onClick={() => handleDelete(ad.id)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {data.pagination && data.pagination.pages > 1 && (
                                <div className="flex flex-col md:flex-row items-center justify-between border-t px-6 py-4 gap-4">
                                    <p className="text-sm text-gray-500">
                                        Showing {data.ads.length} of {data.pagination.total} ads (Page {page} of {data.pagination.pages})
                                    </p>

                                    <Pagination>
                                        <PaginationContent>
                                            <PaginationItem>
                                                <Button1
                                                    variant="ghost"
                                                    disabled={page === 1}
                                                    onClick={() => setPage(page - 1)}
                                                    className="gap-1 px-3"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                    Previous
                                                </Button1>
                                            </PaginationItem>

                                            {[...Array(data.pagination.pages)].map((_, index) => {
                                                const pageNum = index + 1;
                                                if (
                                                    data.pagination.pages <= 7 ||
                                                    pageNum === 1 ||
                                                    pageNum === data.pagination.pages ||
                                                    (pageNum >= page - 1 && pageNum <= page + 1)
                                                ) {
                                                    return (
                                                        <PaginationItem key={pageNum}>
                                                            <Button1
                                                                variant={page === pageNum ? "outline" : "ghost"}
                                                                size="icon"
                                                                onClick={() => setPage(pageNum)}
                                                            >
                                                                {pageNum}
                                                            </Button1>
                                                        </PaginationItem>
                                                    );
                                                } else if (
                                                    (pageNum === page - 2 && pageNum > 1) ||
                                                    (pageNum === page + 2 && pageNum < data.pagination.pages)
                                                ) {
                                                    return (
                                                        <PaginationItem key={pageNum}>
                                                            <PaginationEllipsis />
                                                        </PaginationItem>
                                                    );
                                                }
                                                return null;
                                            })}

                                            <PaginationItem>
                                                <Button1
                                                    variant="ghost"
                                                    disabled={page === data.pagination.pages}
                                                    onClick={() => setPage(page + 1)}
                                                    className="gap-1 px-3"
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button1>
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>
                                </div>
                             )}
                        </>
                    ) : (
                        <div className="p-6">
                            <EmptyState
                                icon={Megaphone}
                                title="No ads found"
                                description="Create your first campaign or adjust the current filters."
                                actionLabel="Create Ad"
                                onAction={() => navigate('/ads/create')}
                            />
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusBadge({ status }) {
    const variants = {
        active: 'default',
        inactive: 'secondary',
        draft: 'outline',
        pending_payment: 'destructive',
    };

    return (
        <Badge variant={variants[status] || 'outline'}>
            {status.replace('_', ' ')}
        </Badge>
    );
}
