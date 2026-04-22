import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { verifyAuth } from '@/store/slices/authSlice';
import Loader from '@/components/common/Loader';

import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/dashboard/Dashboard';
import Users from '@/pages/users/Users';
import UserDetails from '@/pages/users/UserDetails';
import Posts from '@/pages/posts/Posts';
import Comments from '@/pages/comments/Comments';
import Reports from '@/pages/reports/Reports';
import LiveSessions from '@/pages/live/LiveSessions';
import Messages from '@/pages/messages/Messages';
import AdsList from '@/pages/ads/AdsList';
import AdForm from '@/pages/ads/AdForm';
import Payments from '@/pages/payments/Payments';
import RevenueDashboard from '@/pages/revenue/RevenueDashboard';

function ProtectedRoute({ children }) {
    const dispatch = useDispatch();
    const { isAuthenticated, loading } = useSelector((state) => state.auth);

    useEffect(() => {
        dispatch(verifyAuth());
    }, [dispatch]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader size="lg" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><UserDetails /></ProtectedRoute>} />
            <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
            <Route path="/comments" element={<ProtectedRoute><Comments /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><LiveSessions /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/ads" element={<ProtectedRoute><AdsList /></ProtectedRoute>} />
            <Route path="/ads/create" element={<ProtectedRoute><AdForm /></ProtectedRoute>} />
            <Route path="/ads/:id/edit" element={<ProtectedRoute><AdForm /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute><RevenueDashboard /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
