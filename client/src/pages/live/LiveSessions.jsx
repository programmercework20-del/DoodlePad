import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { liveService } from '@/services/live.service';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Radio, StopCircle, Ban } from 'lucide-react';

export default function LiveSessions() {
    const [statusFilter, setStatusFilter] = useState('live');
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const { data, loading, refetch } = useFetch(
        () => liveService.getAllLiveSessions({ status: statusFilter, page }),
        [statusFilter, page]
    );

    const handleEndSession = async (id) => {
        try {
            await liveService.endLiveSession(id, 'Terminated by admin');
            refetch();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error ending session:', err);
        }
    };

    const handleBlockHost = async (id) => {
        try {
            await liveService.blockHost(id);
            refetch();
            setConfirmDialog(null);
        } catch (err) {
            console.error('Error blocking host:', err);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            live: 'destructive', // Red for live
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
            <div className="space-y-6">
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
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {!loading && data?.liveSessions && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {data.liveSessions.map((session) => (
                                <div key={session.id} className="bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-gray-900 h-48 relative flex items-center justify-center">
                                        {/* Placeholder for video thumbnail since we don't have real streaming */}
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

                            {data.liveSessions.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-500">
                                    No live sessions found with status "{statusFilter}"
                                </div>
                            )}
                        </div>

                        {data.pagination && (
                            <div className="flex items-center justify-between mt-6">
                                <p className="text-sm text-gray-500">
                                    Showing {data.liveSessions.length} of {data.pagination.total} sessions
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
