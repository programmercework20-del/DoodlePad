import { Radio, StopCircle, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchLiveSessions,
    endLiveSession,
    blockHost
} from '@/store/slices/liveSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Button as Button1 } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PageAnimation from '@/components/common/PageAnimation';
import EmptyState from '@/components/common/EmptyState';

export default function LiveSessions() {
    const dispatch = useDispatch();
    const { liveSessions, pagination, loading, error } = useSelector((state) => state.live);

    const [statusFilter, setStatusFilter] = useState('live');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        dispatch(fetchLiveSessions({ status: statusFilter, page, limit: 10 }));
    }, [dispatch, statusFilter, page]);

    const handleEndSession = async (id) => {
        try {
            await dispatch(endLiveSession({ id, reason: 'Terminated by admin' })).unwrap();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error ending session:', err);
        }
    };

    const handleBlockHost = async (id) => {
        try {
            await dispatch(blockHost(id)).unwrap();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error blocking host:', err);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            live: 'destructive',
            ended: 'secondary',
            terminated: 'outline',
        };
        return (
            <Badge variant={variants[status] || 'default'} className={status === 'live' ? 'animate-pulse' : ''}>
                {status === 'live' && <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5" />}
                {status}
            </Badge>
        );
    };

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Live Sessions</h1>
                    <p className="text-gray-500 mt-1">Monitor and control live broadcasts</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <div className="flex gap-2">
                        <span className="text-sm font-medium self-center">Status:</span>
                        {['live', 'ended', 'terminated'].map((status) => (
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
                        Error loading sessions: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                {!loading && liveSessions && (
                    <>
                        {liveSessions.length === 0 ? (
                            <EmptyState
                                icon={Radio}
                                title="No active streams"
                                description={
                                    statusFilter
                                        ? `No sessions found with status "${statusFilter}"`
                                        : "No live sessions active at the moment."
                                }
                                actionLabel={
                                    statusFilter !== 'live' ? "View Live Sessions" : undefined
                                }
                                onAction={() => {
                                    setStatusFilter('live');
                                    setPage(1);
                                }}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {liveSessions.map((session) => (
                                    <div key={session.id} className="bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                                        <div className="bg-gray-900 h-48 relative flex items-center justify-center">
                                            <div className="text-white text-center">
                                                <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm text-gray-400">Live Preview Unavailable</p>
                                            </div>
                                            <div className="absolute top-3 right-3">
                                                {getStatusBadge(session.status)}
                                            </div>
                                            <div className="absolute bottom-3 left-3 bg-black/50 px-2 py-1 rounded text-white text-xs">
                                                {session.viewerCount} Viewers
                                            </div>
                                        </div>

                                        <div className="p-4 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                                                    {session.host?.profilePhoto ? (
                                                        <img src={session.host.profilePhoto} alt={session.host.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                                                            {session.host?.name?.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{session.title || 'Untitled Stream'}</p>
                                                    <p className="text-sm text-gray-500">Host: {session.host?.name}</p>
                                                </div>
                                            </div>

                                            {session.status === 'live' && (
                                                <div className="flex gap-2 pt-2 border-t">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => setConfirmDialog({
                                                            title: 'End Live Session',
                                                            description: 'Are you sure you want to forcibly end this live session?',
                                                            confirmText: 'End Session',
                                                            variant: 'destructive',
                                                            onConfirm: () => handleEndSession(session.id)
                                                        })}
                                                    >
                                                        <StopCircle className="h-4 w-4 mr-2" />
                                                        End Stream
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setConfirmDialog({
                                                            title: 'Block Host',
                                                            description: 'Block this user from going live in the future? This will also end the current stream.',
                                                            confirmText: 'Block Host',
                                                            variant: 'destructive',
                                                            onConfirm: () => handleBlockHost(session.id)
                                                        })}
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {pagination && pagination.pages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between mt-8 gap-4 border-t pt-6 px-2">
                                <p className="text-sm text-gray-500">
                                    Showing {liveSessions.length} of {pagination.total} sessions (Page {page} of {pagination.pages})
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
