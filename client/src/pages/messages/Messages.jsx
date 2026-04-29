import { AlertCircle, Trash2, Flag, Lock } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchMessages,
    flagMessage,
    deleteMessage,
    selectMessages
} from '@/store/slices/messageSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageAnimation from '@/components/common/PageAnimation';
import DataTable from '@/components/common/DataTable';

export default function Messages() {
    const dispatch = useDispatch();
    const { messages, pagination, loading, error } = useSelector(selectMessages);
    const [page, setPage] = useState(1);

    useEffect(() => {
        dispatch(fetchMessages({ page, limit: 10 }));
    }, [dispatch, page]);

    const handleFlagMessage = async (id) => {
        try {
            await dispatch(flagMessage(id)).unwrap();
        } catch (err) {
            console.error('Error flagging message:', err);
        }
    };

    const handleDeleteMessage = async (id) => {
        try {
            await dispatch(deleteMessage(id)).unwrap();
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    const COLUMNS = useMemo(() => [
        {
            key: 'sender',
            label: 'Sender',
            render: (row) => (
                <div>
                    <p className="font-medium text-sm text-gray-900">{row.sender?.name}</p>
                    <p className="text-xs text-gray-500">To: {row.receiver?.name || 'Unknown'}</p>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (row) => (
                <div className="flex gap-2">
                    <Badge variant="outline">{row.type}</Badge>
                    {row.hasMedia && <Badge variant="secondary">Media</Badge>}
                </div>
            )
        },
        {
            key: 'issues',
            label: 'Issues',
            render: (row) => (
                <div className="flex items-center text-red-600 font-medium">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {row.reportCount} Reports
                </div>
            )
        },
        {
            key: 'createdAt',
            label: 'Date',
            render: (row) => new Date(row.createdAt).toLocaleDateString()
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleFlagMessage(row.id)}>
                        <Flag className="h-4 w-4 mr-1" /> Flag
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteMessage(row.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                </div>
            )
        }
    ], []);

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Message Monitoring</h1>
                    <p className="text-gray-500 mt-1">Review reported messages (Privacy Focused)</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900">Privacy Notice</h4>
                        <p className="text-sm text-blue-800">
                            For privacy compliance, message content is not fully visible unless explicitly reported.
                            Only metadata and flagged content types are shown below.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading messages: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                <DataTable
                    columns={COLUMNS}
                    data={messages || []}
                    loading={loading}
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                    emptyMessage="There are no reported messages to review at this time."
                />
            </PageAnimation>
        </AdminLayout>
    );
}
