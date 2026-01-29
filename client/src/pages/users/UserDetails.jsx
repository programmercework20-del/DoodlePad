import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchUserById,
    warnUser,
    blockUser,
    unblockUser,
    banUser
} from '@/store/slices/userSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, Ban, XCircle, CheckCircle } from 'lucide-react';
import PageAnimation from '@/components/common/PageAnimation';

export default function UserDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Redux State
    const { currentUser: user, stats, loading, error } = useSelector((state) => state.users);

    const [confirmDialog, setConfirmDialog] = useState(null);

    // Fetch user on mount
    useEffect(() => {
        if (id) {
            dispatch(fetchUserById(id));
        }
    }, [dispatch, id]);

    const handleAction = async (action, confirmConfig) => {
        setConfirmDialog(confirmConfig);
    };

    const executeAction = async (actionFn) => {
        try {
            await dispatch(actionFn).unwrap();
            // Refetch can be skipped if Redux state is updated optimistically, 
            // but for safety we can refetch or just rely on state update from thunk
            // dispatch(fetchUserById(id)); 
            // The thunks inside userSlice already return updated status, 
            // and the reducer updates currentUser, so no refetch needed!
        } catch (err) {
            console.error('Action failed:', err);
        }
    };

    if (loading && !user) {
        return (
            <AdminLayout>
                <Loader size="lg" className="h-full" />
            </AdminLayout>
        );
    }

    if (error || !user) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-full">
                    <p className="text-destructive">Error loading user details: {typeof error === 'string' ? error : 'Not found'}</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
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
                    <Card className="lg:col-span-2 shadow-sm">
                        <CardHeader>
                            <CardTitle>User Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <div className="flex items-center justify-center rounded-full bg-gray-200 overflow-hidden text-gray-700 w-full h-full">
                                        {user.profilePhoto ? (
                                            <img
                                                className='rounded-full h-full w-full object-cover'
                                                src={user.profilePhoto}
                                                alt="User Profile"
                                            />
                                        ) : (
                                            <span className="text-xl font-bold uppercase">
                                                {user.name?.charAt(0)}
                                            </span>
                                        )}
                                    </div>
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

                    <Card className="shadow-sm">
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

                <Card className="shadow-sm">
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
                                        onConfirm: () => executeAction(() => warnUser({ id, reason: 'Admin warning' })),
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
                                        onConfirm: () => executeAction(() => blockUser({ id, reason: 'Admin block' })),
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
                                        onConfirm: () => executeAction(() => banUser({ id, reason: 'Admin ban' })),
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
                                        onConfirm: () => executeAction(() => unblockUser(id)),
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
