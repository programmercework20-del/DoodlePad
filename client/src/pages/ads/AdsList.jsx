import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BarChart3,
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
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { adService } from '@/services/ad.service';
import { paymentService } from '@/services/payment.service';
import DataTable from '@/components/common/DataTable';
import Avatar from '@/components/common/Avatar';

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString()}`;
const formatNumber = (value) => Number(value || 0).toLocaleString();

const STATUS_VARIANTS = {
    active: 'default',
    inactive: 'secondary',
    draft: 'outline',
    pending_payment: 'destructive',
};

export default function AdsList() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState('');
    const [pendingAction, setPendingAction] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const { data, loading, error, refetch } = useFetch(
        () => adService.getAllAds({
            search: debouncedSearchQuery,
            status: statusFilter,
            type: typeFilter,
            page,
            limit: 10,
        }),
        [debouncedSearchQuery, statusFilter, typeFilter, page]
    );

    const runAction = useCallback(async (actionKey, handler) => {
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
    }, [refetch]);

    const handleDelete = useCallback(async (id) => {
        if (!window.confirm('Delete this ad permanently?')) {
            return;
        }
        await runAction(`delete-${id}`, () => adService.deleteAd(id));
    }, [runAction]);

    const handleToggle = useCallback(async (id) => {
        await runAction(`toggle-${id}`, () => adService.toggleAdStatus(id));
    }, [runAction]);

    const handlePayment = useCallback(async (ad) => {
        await runAction(`pay-${ad.id}`, () => paymentService.simulatePayment({ adId: ad.id, amount: ad.budget }));
    }, [runAction]);

    const handleTrackView = useCallback(async (id) => {
        await runAction(`view-${id}`, () => adService.trackView(id));
    }, [runAction]);

    const handleTrackClick = useCallback(async (id) => {
        await runAction(`click-${id}`, () => adService.trackClick(id));
    }, [runAction]);

    const adColumns = useMemo(() => [
        {
            key: 'campaign',
            label: 'Campaign',
            render: (ad) => (
                <div className="flex items-start gap-4">
                    <Avatar 
                        src={ad.imageUrl} 
                        name={ad.title} 
                        size="h-16 w-16" 
                        className="rounded-2xl ring-1 ring-gray-200"
                    />
                    <div className="max-w-xs space-y-1">
                        <div className="font-semibold text-gray-900">{ad.title}</div>
                        <p className="text-sm text-gray-500 line-clamp-2">{ad.description}</p>
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
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (ad) => <Badge variant="outline">{ad.type}</Badge>
        },
        {
            key: 'status',
            label: 'Status',
            render: (ad) => (
                <Badge variant={STATUS_VARIANTS[ad.status] || 'outline'}>
                    {ad.status.replace('_', ' ')}
                </Badge>
            )
        },
        {
            key: 'budget',
            label: 'Budget',
            render: (ad) => <span className="font-medium">{formatCurrency(ad.budget)}</span>
        },
        {
            key: 'stats',
            label: 'Engagement',
            render: (ad) => (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Views:</span>
                        <span className="font-medium">{formatNumber(ad.impressions)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Clicks:</span>
                        <span className="font-medium">{formatNumber(ad.clicks)}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'revenue',
            label: 'Revenue',
            render: (ad) => (
                <div>
                    <div className="font-semibold text-gray-900">
                        {formatCurrency(ad.revenue?.totalRevenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                        CTR {Number(ad.revenue?.ctr || 0).toFixed(2)}%
                    </div>
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (ad) => (
                <div className="flex flex-wrap gap-2 max-w-[200px]">
                    <Button asChild size="sm" variant="outline">
                        <Link to={`/ads/${ad.id}/edit`}>
                            <Pencil className="mr-1 h-4 w-4" /> Edit
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
                        <Eye className="mr-1 h-4 w-4" /> +View
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingAction === `click-${ad.id}`}
                        onClick={() => handleTrackClick(ad.id)}
                    >
                        <MousePointerClick className="mr-1 h-4 w-4" /> +Click
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
            )
        }
    ], [handleDelete, handlePayment, handleToggle, handleTrackClick, handleTrackView, pendingAction]);

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
                                <Wallet className="mr-2 h-4 w-4" /> Payments
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link to="/revenue">
                                <BarChart3 className="mr-2 h-4 w-4" /> Revenue
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link to="/ads/create">
                                <Plus className="mr-2 h-4 w-4" /> Create Ad
                            </Link>
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading ads: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="p-6 border-b bg-gray-50/50">
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
                        <DataTable
                            columns={adColumns}
                            data={data.ads}
                            pagination={data.pagination}
                            page={page}
                            onPageChange={setPage}
                        />
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

