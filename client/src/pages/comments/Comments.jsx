import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { commentService } from '@/services/comment.service';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Trash2, EyeOff } from 'lucide-react';

export default function Comments() {
    const [statusFilter, setStatusFilter] = useState('active');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const { data, loading, refetch } = useFetch(
        () => commentService.getAllComments({ status: statusFilter, page }),
        [statusFilter, page]
    );

    const handleHideComment = async (id) => {
        try {
            await commentService.hideComment(id);
            refetch();
        } catch (err) {
            console.error('Error hiding comment:', err);
        }
    };

    const handleDeleteComment = async (id) => {
        try {
            await commentService.deleteComment(id);
            refetch();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: 'default',
            hidden: 'secondary',
            deleted: 'destructive',
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
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
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {!loading && data?.comments && (
                    <>
                        <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">On Post</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.comments.map((comment) => (
                                        <tr key={comment.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {comment.author?.profilePhoto && (
                                                        <img src={comment.author.profilePhoto} alt="" className="w-6 h-6 rounded-full" />
                                                    )}
                                                    <span className="text-sm font-medium">{comment.author?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm max-w-md truncate">
                                                {comment.content || <span className="italic text-gray-400">Media Content</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-blue-600 max-w-xs truncate">
                                                Post #{comment.post?.id?.slice(0, 8)}...
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(comment.status)}</td>
                                            <td className="px-6 py-4">
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
                                            </td>
                                        </tr>
                                    ))}
                                    {data.comments.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                No comments found with status "{statusFilter}"
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {data.pagination && (
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {data.comments.length} of {data.pagination.total} comments
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
                                        disabled={page === data.pagination.pages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

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
