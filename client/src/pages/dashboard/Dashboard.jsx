import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchDashboardStats, selectAnalyticsState } from '@/store/slices/analyticsSlice';
import { selectAuth } from '@/store/slices/authSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import StatCard from '@/components/cards/StatCard';
import Loader from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import PageAnimation from '@/components/common/PageAnimation';

import { Users, FileText, Flag, Radio, RefreshCcw } from 'lucide-react';
import gsap from 'gsap';

const formatNumber = (num) => Number(num || 0).toLocaleString();

export default function Dashboard() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isAuthenticated, loading: authLoading } = useSelector(selectAuth);
    const { stats, loading: statsLoading, error } = useSelector(selectAnalyticsState);

    const hasAnimated = useRef(false);

    /* 🔐 Auth Guard */
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login', { replace: true });
        }
    }, [authLoading, isAuthenticated, navigate]);

    /* 📩 Fetch Data */
    useEffect(() => {
        if (isAuthenticated) {
            dispatch(fetchDashboardStats());
        }
    }, [dispatch, isAuthenticated]);

    /* 🎬 GSAP Animation — runs only once on first data load */
    useEffect(() => {
        if (!stats || hasAnimated.current) return;

        const ctx = gsap.context(() => {
            gsap.from('.stat-card', {
                y: 30,
                opacity: 0,
                stagger: 0.12,
                duration: 0.6,
                ease: 'power3.out',
            });
        });

        hasAnimated.current = true;

        return () => ctx.revert();
    }, [stats]);

    const isLoading = authLoading || (statsLoading && !stats);

    if (isLoading) {
        return (
            <AdminLayout>
                <Loader size="lg" className="h-full" />
            </AdminLayout>
        );
    }

    if (error && !stats) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <p className="text-destructive font-medium">
                        Failed to load dashboard data: {typeof error === 'string' ? error : 'Unknown error'}
                    </p>
                    <Button variant="outline" onClick={() => dispatch(fetchDashboardStats())}>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-500 mt-1">Monitor and manage your platform</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => dispatch(fetchDashboardStats())}>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        className="stat-card"
                        title="Total Users"
                        value={formatNumber(stats?.users?.total)}
                        icon={Users}
                        trend="up"
                        trendValue={`+${stats?.users?.newToday || 0} today`}
                    />
                    <StatCard
                        className="stat-card"
                        title="Total Posts"
                        value={formatNumber(stats?.posts?.total)}
                        icon={FileText}
                    />
                    <StatCard
                        className="stat-card"
                        title="Pending Reports"
                        value={formatNumber(stats?.reports?.pending)}
                        icon={Flag}
                        trend="up"
                        trendValue={`${stats?.reports?.highPriority || 0} high priority`}
                    />
                    <StatCard
                        className="stat-card"
                        title="Active Lives"
                        value={formatNumber(stats?.live?.active)}
                        icon={Radio}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">User Status</h3>
                        <div className="space-y-3">
                            <StatusRow label="Active Users" value={stats?.users?.active} />
                            <StatusRow label="Warned Users" value={stats?.users?.warned} color="text-yellow-600" />
                            <StatusRow label="Blocked Users" value={stats?.users?.blocked} color="text-orange-600" />
                            <StatusRow label="Banned Users" value={stats?.users?.banned} color="text-red-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">Content Overview</h3>
                        <div className="space-y-3">
                            <StatusRow label="Active Posts" value={stats?.posts?.active} />
                            <StatusRow label="Hidden Posts" value={stats?.posts?.hidden} color="text-orange-600" />
                            <StatusRow label="Deleted Posts" value={stats?.posts?.deleted} color="text-red-600" />
                            <StatusRow label="Total Lives" value={stats?.live?.total} />
                        </div>
                    </div>
                </div>
            </PageAnimation>
        </AdminLayout>
    );
}

function StatusRow({ label, value, color = '' }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{label}</span>
            <span className={`font-semibold ${color}`}>
                {Number(value || 0).toLocaleString()}
            </span>
        </div>
    );
}