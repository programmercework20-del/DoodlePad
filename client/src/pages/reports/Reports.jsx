import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchReports,
    updateReportStatus
} from '@/store/slices/reportSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PageAnimation from '@/components/common/PageAnimation';

export default function Reports() {
    const dispatch = useDispatch();
    const { reports, pagination, loading, error } = useSelector((state) => state.reports);

    const [statusFilter, setStatusFilter] = useState('pending');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        dispatch(fetchReports({ status: statusFilter, priority: priorityFilter, page }));
    }, [dispatch, statusFilter, priorityFilter, page]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await dispatch(updateReportStatus({ id, status })).unwrap();
            setConfirmDialog(null);
            // No need to manual refetch if optimistic update or re-fetch logic is not critical immediately 
            // (or if thunk updates state). My reportSlice updates state locally on fulfill.
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: 'secondary',
            reviewing: 'default',
            resolved: 'outline',
            rejected: 'destructive',
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    const getPriorityBadge = (priority) => {
        const variants = {
            low: 'outline',
            medium: 'secondary',
            high: 'destructive',
        };
        return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
    };

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports Management</h1>
                    <p className="text-gray-500 mt-1">Review and handle user reports</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <div className="flex gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        {['pending', 'reviewing', 'resolved', 'rejected'].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setStatusFilter(status); setPage(1); }}
                            >
                                {status}
                            </Button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <span className="text-sm font-medium">Priority:</span>
                        {['', 'low', 'medium', 'high'].map((priority) => (
                            <Button
                                key={priority}
                                variant={priorityFilter === priority ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setPriorityFilter(priority); setPage(1); }}
                            >
                                {priority || 'All'}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading reports: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                {!loading && reports && (
                    <>
                        <div className="bg-white rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-md">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reporter</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm">{report.reporter?.name}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline">{report.targetType}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm">{report.reason}</td>
                                            <td className="px-6 py-4">{getPriorityBadge(report.priority)}</td>
                                            <td className="px-6 py-4">{getStatusBadge(report.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {report.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() =>
                                                                    setConfirmDialog({
                                                                        title: 'Resolve Report',
                                                                        description: 'Mark this report as resolved?',
                                                                        confirmText: 'Resolve',
                                                                        onConfirm: () => handleUpdateStatus(report.id, 'resolved'),
                                                                        variant: 'default',
                                                                    })
                                                                }
                                                            >
                                                                Resolve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setConfirmDialog({
                                                                        title: 'Reject Report',
                                                                        description: 'Reject this report as invalid?',
                                                                        confirmText: 'Reject',
                                                                        onConfirm: () => handleUpdateStatus(report.id, 'rejected'),
                                                                        variant: 'destructive',
                                                                    })
                                                                }
                                                            >
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {pagination && (
                            <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-gray-500">
                                    Showing {reports.length} of {pagination.total} reports
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page + 1)}
                                        disabled={page === pagination.pages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {confirmDialog && (
                    <ConfirmDialog
                        open={!!confirmDialog}
                        onOpenChange={(open) => !open && setConfirmDialog(null)}
                        {...confirmDialog}
                    />
                )}
            </PageAnimation>
        </AdminLayout>
    );
}
