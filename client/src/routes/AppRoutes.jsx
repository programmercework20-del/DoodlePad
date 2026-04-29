// import { Routes, Route, Navigate } from 'react-router-dom';
// import { lazy, Suspense } from 'react';
// import { useSelector } from 'react-redux';
// import { verifyAuth, selectAuth } from '@/store/slices/authSlice';
// import Loader from '@/components/common/Loader';

// const Login = lazy(() => import('@/pages/auth/Login'));
// const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
// const Users = lazy(() => import('@/pages/users/Users'));
// const UserDetails = lazy(() => import('@/pages/users/UserDetails'));
// const Posts = lazy(() => import('@/pages/posts/Posts'));
// const Comments = lazy(() => import('@/pages/comments/Comments'));
// const Reports = lazy(() => import('@/pages/reports/Reports'));
// const LiveSessions = lazy(() => import('@/pages/live/LiveSessions'));
// const Messages = lazy(() => import('@/pages/messages/Messages'));
// const AdsList = lazy(() => import('@/pages/ads/AdsList'));
// const AdForm = lazy(() => import('@/pages/ads/AdForm'));
// const Payments = lazy(() => import('@/pages/payments/Payments'));
// const RevenueDashboard = lazy(() => import('@/pages/revenue/RevenueDashboard'));

// const PageLoader = () => (
//     <div className="min-h-screen flex items-center justify-center">
//         <Loader size="lg" />
//     </div>
// );

// function ProtectedRoute({ children }) {
//     const { isAuthenticated, loading } = useSelector(selectAuth);

//     if (loading) return <PageLoader />;
//     if (!isAuthenticated) return <Navigate to="/login" replace />;

//     return children;
// }

// export default function AppRoutes() {
//     return (
//         <Suspense fallback={<PageLoader />}>
//             <Routes>
//                 <Route path="/login" element={<Login />} />

                
//                 <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
//                 <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
//                 <Route path="/users/:id" element={<ProtectedRoute><UserDetails /></ProtectedRoute>} />
//                 <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
//                 <Route path="/comments" element={<ProtectedRoute><Comments /></ProtectedRoute>} />
//                 <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
//                 <Route path="/live" element={<ProtectedRoute><LiveSessions /></ProtectedRoute>} />
//                 <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
//                 <Route path="/ads" element={<ProtectedRoute><AdsList /></ProtectedRoute>} />
//                 <Route path="/ads/create" element={<ProtectedRoute><AdForm /></ProtectedRoute>} />
//                 <Route path="/ads/:id/edit" element={<ProtectedRoute><AdForm /></ProtectedRoute>} />
//                 <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
//                 <Route path="/revenue" element={<ProtectedRoute><RevenueDashboard /></ProtectedRoute>} />

//                 <Route path="/" element={<Navigate to="/dashboard" replace />} />
//                 <Route path="*" element={<Navigate to="/dashboard" replace />} />
//             </Routes>
//         </Suspense>
//     );
// }



import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '@/store/slices/authSlice';
import Loader from '@/components/common/Loader';

// 🔥 Reusable import functions (important for prefetch)
const LoginPage = () => import('@/pages/auth/Login');
const DashboardPage = () => import('@/pages/dashboard/Dashboard');
const UsersPage = () => import('@/pages/users/Users');
const UserDetailsPage = () => import('@/pages/users/UserDetails');
const PostsPage = () => import('@/pages/posts/Posts');
const CommentsPage = () => import('@/pages/comments/Comments');
const ReportsPage = () => import('@/pages/reports/Reports');
const LivePage = () => import('@/pages/live/LiveSessions');
const MessagesPage = () => import('@/pages/messages/Messages');
const AdsPage = () => import('@/pages/ads/AdsList');
const AdFormPage = () => import('@/pages/ads/AdForm');
const PaymentsPage = () => import('@/pages/payments/Payments');
const RevenuePage = () => import('@/pages/revenue/RevenueDashboard');

// 🔥 Lazy load
const Login = lazy(LoginPage);
const Dashboard = lazy(DashboardPage);
const Users = lazy(UsersPage);
const UserDetails = lazy(UserDetailsPage);
const Posts = lazy(PostsPage);
const Comments = lazy(CommentsPage);
const Reports = lazy(ReportsPage);
const LiveSessions = lazy(LivePage);
const Messages = lazy(MessagesPage);
const AdsList = lazy(AdsPage);
const AdForm = lazy(AdFormPage);
const Payments = lazy(PaymentsPage);
const RevenueDashboard = lazy(RevenuePage);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader size="lg" />
  </div>
);

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector(selectAuth);

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  );
}