import { Flag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchReports,
    updateReportStatus,
    selectReports
} from '@/store/slices/reportSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PageAnimation from '@/components/common/PageAnimation';
import EmptyState from '@/components/common/EmptyState';
import DataTable from '@/components/common/DataTable';
import Avatar from '@/components/common/Avatar';

const STATUS_VARIANTS = {
    pending: 'secondary',
    reviewing: 'default',
    resolved: 'outline',
    rejected: 'destructive',
};

const PRIORITY_VARIANTS = {
    low: 'outline',
    medium: 'secondary',
    high: 'destructive',
};

export default function Reports() {
    const dispatch = useDispatch();
    const { reports, pagination, loading, error } = useSelector(selectReports);

    const [statusFilter, setStatusFilter] = useState('pending');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        dispatch(fetchReports({ status: statusFilter, priority: priorityFilter, page, limit: 10 }));
    }, [dispatch, statusFilter, priorityFilter, page]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await dispatch(updateReportStatus({ id, status })).unwrap();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const REPORT_COLUMNS = [
        {
            key: 'reporter',
            label: 'Reporter',
            render: (report) => (
                <div className="flex items-center gap-3">
                    <Avatar src={report.reporter?.profilePhoto} name={report.reporter?.name} size="h-8 w-8" />
                    <span className="text-sm font-medium">{report.reporter?.name}</span>
                </div>
            )
        },
        {
            key: 'targetType',
            label: 'Type',
            render: (report) => <Badge variant="outline">{report.targetType}</Badge>
        },
        {
            key: 'reason',
            label: 'Reason',
            render: (report) => <span className="text-sm">{report.reason}</span>
        },
        {
            key: 'priority',
            label: 'Priority',
            render: (report) => (
                <Badge variant={PRIORITY_VARIANTS[report.priority] || 'default'}>
                    {report.priority}
                </Badge>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (report) => (
                <Badge variant={STATUS_VARIANTS[report.status] || 'default'}>
                    {report.status}
                </Badge>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (report) => (
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
            )
        }
    ];

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
                    reports.length === 0 ? (
                        <EmptyState
                            icon={Flag}
                            title="No reports found"
                            description={
                                statusFilter || priorityFilter
                                    ? "No reports match your current filters."
                                    : "No reports found."
                            }
                            actionLabel={
                                (statusFilter !== 'pending' || priorityFilter) ? "Reset Filters" : undefined
                            }
                            onAction={() => {
                                setStatusFilter('pending');
                                setPriorityFilter('');
                                setPage(1);
                            }}
                        />
                    ) : (
                        <DataTable
                            columns={REPORT_COLUMNS}
                            data={reports}
                            pagination={pagination}
                            page={page}
                            onPageChange={setPage}
                        />
                    )
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

