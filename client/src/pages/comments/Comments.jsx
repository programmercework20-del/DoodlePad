import { Trash2, EyeOff, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchComments,
    hideComment,
    deleteComment
} from '@/store/slices/commentSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Button as Button1 } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PageAnimation from '@/components/common/PageAnimation';
import EmptyState from '@/components/common/EmptyState';

export default function Comments() {
    const dispatch = useDispatch();
    const { comments, pagination, loading, error } = useSelector((state) => state.comments);

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
                    <>
                        {comments.length === 0 ? (
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
                            <div className="bg-white rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-md">
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
                                        {comments.map((comment) => (
                                            <tr key={comment.id} className="hover:bg-gray-50 transition-colors">
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
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {pagination && pagination.pages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between mt-6 gap-4 border-t pt-6 px-2">
                                <p className="text-sm text-gray-500">
                                    Showing {comments.length} of {pagination.total} comments (Page {page} of {pagination.pages})
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

                                        {[...Array(pagination.pages)].map((_, index) => {
                                            const pageNum = index + 1;
                                            if (
                                                pagination.pages <= 7 ||
                                                pageNum === 1 ||
                                                pageNum === pagination.pages ||
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
                                                (pageNum === page + 2 && pageNum < pagination.pages)
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
                                                disabled={page === pagination.pages}
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
