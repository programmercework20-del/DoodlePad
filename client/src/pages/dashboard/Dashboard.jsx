import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useFetch } from '@/hooks/useFetch';
import { analyticsService } from '@/services/analytics.service';
import AdminLayout from '@/components/layout/AdminLayout';
import StatCard from '@/components/cards/StatCard';
import Loader from '@/components/common/Loader';
import { Users, FileText, Flag, Radio } from 'lucide-react';
import gsap from 'gsap';

export default function Dashboard() {
    const { isAuthenticated, loading: authLoading } = useSelector((state) => state.auth);
    const navigate = useNavigate();

    const { data: stats, loading, error } = useFetch(
        () => analyticsService.getDashboardStats(),
        []
    );

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    useEffect(() => {
        if (stats) {
            gsap.from('.stat-card', {
                y: 40,
                opacity: 0,
                stagger: 0.1,
                duration: 0.6,
                ease: 'power3.out',
            });
        }
    }, [stats]);

    if (authLoading || loading) {
        return (
            <AdminLayout>
                <Loader size="lg" className="h-full" />
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-full">
                    <p className="text-destructive">Error loading dashboard data</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">Monitor and manage your platform</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        className="stat-card"
                        title="Total Users"
                        value={stats?.users?.total?.toLocaleString() || '0'}
                        icon={Users}
                        trend="up"
                        trendValue={`+${stats?.users?.newToday || 0} today`}
                    />
                    <StatCard
                        className="stat-card"
                        title="Total Posts"
                        value={stats?.posts?.total?.toLocaleString() || '0'}
                        icon={FileText}
                    />
                    <StatCard
                        className="stat-card"
                        title="Pending Reports"
                        value={stats?.reports?.pending?.toLocaleString() || '0'}
                        icon={Flag}
                        trend="up"
                        trendValue={`${stats?.reports?.highPriority || 0} high priority`}
                    />
                    <StatCard
                        className="stat-card"
                        title="Active Lives"
                        value={stats?.live?.active?.toLocaleString() || '0'}
                        icon={Radio}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">User Status</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Active Users</span>
                                <span className="font-semibold">{stats?.users?.active || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Warned Users</span>
                                <span className="font-semibold text-yellow-600">{stats?.users?.warned || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Blocked Users</span>
                                <span className="font-semibold text-orange-600">{stats?.users?.blocked || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Banned Users</span>
                                <span className="font-semibold text-red-600">{stats?.users?.banned || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">Content Overview</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Active Posts</span>
                                <span className="font-semibold">{stats?.posts?.active || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Hidden Posts</span>
                                <span className="font-semibold text-orange-600">{stats?.posts?.hidden || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Deleted Posts</span>
                                <span className="font-semibold text-red-600">{stats?.posts?.deleted || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total Lives</span>
                                <span className="font-semibold">{stats?.live?.total || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
