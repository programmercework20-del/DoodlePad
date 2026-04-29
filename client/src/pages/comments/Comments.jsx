import { Trash2, EyeOff, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchComments,
    hideComment,
    deleteComment,
    selectComments
} from '@/store/slices/commentSlice';

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
    active: 'default',
    hidden: 'secondary',
    deleted: 'destructive',
};

export default function Comments() {
    const dispatch = useDispatch();
    const { comments, pagination, loading, error } = useSelector(selectComments);

    const [statusFilter, setStatusFilter] = useState('active');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        dispatch(fetchComments({ status: statusFilter, page, limit: 10 }));
    }, [dispatch, statusFilter, page]);

    const handleHideComment = async (id) => {
        try {
            await dispatch(hideComment(id)).unwrap();
        } catch (err) {
            console.error('Error hiding comment:', err);
        }
    };

    const handleDeleteComment = async (id) => {
        try {
            await dispatch(deleteComment(id)).unwrap();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    const COMMENT_COLUMNS = [
        {
            key: 'author',
            label: 'Author',
            render: (comment) => (
                <div className="flex items-center gap-3">
                    <Avatar src={comment.author?.profilePhoto} name={comment.author?.name} size="h-8 w-8" />
                    <span className="text-sm font-medium">{comment.author?.name}</span>
                </div>
            )
        },
        {
            key: 'content',
            label: 'Comment',
            render: (comment) => (
                <div className="max-w-md truncate text-sm">
                    {comment.content || <span className="italic text-gray-400">Media Content</span>}
                </div>
            )
        },
        {
            key: 'post',
            label: 'On Post',
            render: (comment) => (
                <span className="text-sm text-blue-600">
                    Post #{comment.post?.id?.slice(0, 8)}...
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (comment) => (
                <Badge variant={STATUS_VARIANTS[comment.status] || 'default'}>
                    {comment.status}
                </Badge>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (comment) => (
                <div className="flex gap-2">
                    {comment.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => handleHideComment(comment.id)}>
                            <EyeOff className="h-4 w-4 mr-1" /> Hide
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDialog({
                            title: 'Delete Comment',
                            description: 'Are you sure you want to delete this comment?',
                            confirmText: 'Delete',
                            variant: 'destructive',
                            onConfirm: () => handleDeleteComment(comment.id)
                        })}
                    >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                </div>
            )
        }
    ];

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Comment Moderation</h1>
                    <p className="text-gray-500 mt-1">Manage and moderate user comments</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <div className="flex gap-2">
                        <span className="text-sm font-medium self-center">Status:</span>
                        {['active', 'hidden', 'deleted'].map((status) => (
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
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading comments: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                {!loading && comments && (
                    comments.length === 0 ? (
                        <EmptyState
                            icon={MessageSquare}
                            title="No comments found"
                            description={
                                statusFilter
                                    ? `No comments found with status "${statusFilter}"`
                                    : "No comments exist in the system."
                            }
                            actionLabel="Clear Filters"
                            onAction={() => {
                                setStatusFilter('active');
                                setPage(1);
                            }}
                        />
                    ) : (
                        <DataTable
                            columns={COMMENT_COLUMNS}
                            data={comments}
                            pagination={pagination}
                            page={page}
                            onPageChange={setPage}
                        />
                    )
                )}
            </PageAnimation>

            {confirmDialog && (
                <ConfirmDialog
                    open={!!confirmDialog}
                    onOpenChange={(open) => !open && setConfirmDialog(null)}
                    {...confirmDialog}
                />
            )}
        </AdminLayout>
    );
}

