import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { userService } from '@/services/user.service';
import Loader from '@/components/common/Loader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, Ban, XCircle, CheckCircle } from 'lucide-react';

export default function UserDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [confirmDialog, setConfirmDialog] = useState(null);

    const { data, loading, error, refetch } = useFetch(
        () => userService.getUserById(id),
        [id]
    );

    const handleAction = async (action, confirmConfig) => {
        setConfirmDialog(confirmConfig);
    };

    const executeAction = async (actionFn) => {
        try {
            await actionFn();
            refetch();
        } catch (err) {
            console.error('Action failed:', err);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <Loader size="lg" className="h-full" />
            </AdminLayout>
        );
    }

    if (error || !data?.user) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-full">
                    <p className="text-destructive">Error loading user details</p>
                </div>
            </AdminLayout>
        );
    }

    const user = data.user;
    const stats = data.stats;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate('/users')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
                        <p className="text-gray-500 mt-1">View and manage user account</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>User Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-2xl font-bold">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{user.name}</h2>
                                    <p className="text-gray-500">@{user.username}</p>
                                    <Badge className="mt-2">{user.status}</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div>
                                    <p className="text-sm text-gray-500">Email</p>
                                    <p className="font-medium">{user.email}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Gender</p>
                                    <p className="font-medium capitalize">{user.gender || 'Not specified'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Warning Count</p>
                                    <p className="font-medium">{user.warningCount}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Report Count</p>
                                    <p className="font-medium">{user.reportCount}</p>
                                </div>
                            </div>

                            {user.bio && (
                                <div className="pt-4">
                                    <p className="text-sm text-gray-500">Bio</p>
                                    <p className="mt-1">{user.bio}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Total Posts</span>
                                <span className="font-semibold">{stats?.postsCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Total Comments</span>
                                <span className="font-semibold">{stats?.commentsCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Reports Against</span>
                                <span className="font-semibold text-red-600">{stats?.reportsCount || 0}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Moderation Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        {user.status !== 'warned' && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    handleAction('warn', {
                                        title: 'Warn User',
                                        description: 'This will send a warning to the user.',
                                        confirmText: 'Warn',
                                        onConfirm: () => executeAction(() => userService.warnUser(id, 'Admin warning')),
                                        variant: 'default',
                                    })
                                }
                            >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Warn User
                            </Button>
                        )}

                        {user.status !== 'blocked' && user.status !== 'banned' && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    handleAction('block', {
                                        title: 'Block User',
                                        description: 'This will temporarily block the user from accessing the platform.',
                                        confirmText: 'Block',
                                        onConfirm: () => executeAction(() => userService.blockUser(id, 'Admin block')),
                                        variant: 'destructive',
                                    })
                                }
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Block User
                            </Button>
                        )}

                        {user.status !== 'banned' && (
                            <Button
                                variant="destructive"
                                onClick={() =>
                                    handleAction('ban', {
                                        title: 'Ban User Permanently',
                                        description: 'This will permanently ban the user. This action is severe.',
                                        confirmText: 'Ban Permanently',
                                        onConfirm: () => executeAction(() => userService.banUser(id, 'Admin ban')),
                                        variant: 'destructive',
                                    })
                                }
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Ban User
                            </Button>
                        )}

                        {(user.status === 'blocked' || user.status === 'warned') && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    handleAction('unblock', {
                                        title: 'Unblock User',
                                        description: 'This will restore the user\'s access.',
                                        confirmText: 'Unblock',
                                        onConfirm: () => executeAction(() => userService.unblockUser(id)),
                                        variant: 'default',
                                    })
                                }
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Unblock User
                            </Button>
                        )}
                    </CardContent>
                </Card>
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
