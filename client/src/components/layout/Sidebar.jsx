// import { Link, useLocation, useNavigate } from 'react-router-dom';
// import { useDispatch } from 'react-redux';
// import { logoutAdmin } from '@/store/slices/authSlice';
// import {
//     LayoutDashboard,
//     Users,
//     FileText,
//     MessageSquare,
//     Flag,
//     Radio,
//     Mail,
//     LogOut,
//     Megaphone,
//     PlusCircle,
//     Wallet,
//     BarChart3,
// } from 'lucide-react';

// const menuItems = [
//     { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
//     { name: 'Users', path: '/users', icon: Users },
//     { name: 'Posts', path: '/posts', icon: FileText },
//     { name: 'Comments', path: '/comments', icon: MessageSquare },
//     { name: 'Reports', path: '/reports', icon: Flag },
//     // { name: 'Live Sessions', path: '/live', icon: Radio },
//     { name: 'Messages', path: '/messages', icon: Mail },
// ];

// const advertisementItems = [
//     { name: 'All Ads', path: '/ads', icon: Megaphone },
//     { name: 'Create Ad', path: '/ads/create', icon: PlusCircle },
//     { name: 'Payments', path: '/payments', icon: Wallet },
//     { name: 'Revenue Dashboard', path: '/revenue', icon: BarChart3 },
// ];

// export default function Sidebar() {
//     const location = useLocation();
//     const navigate = useNavigate();
//     const dispatch = useDispatch();

//     const handleLogout = async () => {
//         await dispatch(logoutAdmin());
//         navigate('/login');
//     };

//     return (
//         <aside className="w-64 bg-black text-white flex flex-col h-screen">
//             <div className="p-6">
//                 <h1 className="text-2xl font-bold">Admin Panel</h1>
//             </div>

//             <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-thin 
// scrollbar-thumb-gray-700 
// scrollbar-track-gray-900">
//                 {menuItems.map((item) => {
//                     const Icon = item.icon;
//                     const isActive = location.pathname === item.path;

//                     return (
//                         <Link
//                             key={item.path}
//                             to={item.path}
//                             className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
//                                 ? 'bg-white text-black'
//                                 : 'text-gray-300 hover:bg-gray-800 hover:text-white'
//                                 }`}
//                         >
//                             <Icon className="h-5 w-5" />
//                             <span className="font-medium">{item.name}</span>
//                         </Link>
//                     );
//                 })}

//                 <div className="pt-4">
//                     <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
//                         Advertisement
//                     </p>
//                     <div className="space-y-2">
//                         {advertisementItems.map((item) => {
//                             const Icon = item.icon;
//                             const isActive = location.pathname === item.path
//                                 || (item.path === '/ads' && location.pathname.startsWith('/ads/'));

//                             return (
//                                 <Link
//                                     key={item.path}
//                                     to={item.path}
//                                     className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
//                                         ? 'bg-white text-black'
//                                         : 'text-gray-300 hover:bg-gray-800 hover:text-white'
//                                         }`}
//                                 >
//                                     <Icon className="h-5 w-5" />
//                                     <span className="font-medium">{item.name}</span>
//                                 </Link>
//                             );
//                         })}
//                     </div>
//                 </div>
//             </nav>

//             <div className="p-4">
//                 <button
//                     onClick={handleLogout}
//                     className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-300 hover:bg-red-800 hover:text-white transition-colors"
//                 >
//                     <LogOut className="h-5 w-5" />
//                     <span className="font-medium">Logout</span>
//                 </button>
//             </div>
//         </aside>
//     );
// }




import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logoutAdmin } from '@/store/slices/authSlice';
import { prefetchRoutes } from '@/routes/prefetchRoutes'; // 🔥 NEW

import {
    LayoutDashboard,
    Users,
    FileText,
    MessageSquare,
    Flag,
    Mail,
    LogOut,
    Megaphone,
    PlusCircle,
    Wallet,
    BarChart3,
} from 'lucide-react';

// 🔥 Menu config (with prefetch mapping)
const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, prefetch: prefetchRoutes.dashboard },
    { name: 'Users', path: '/users', icon: Users, prefetch: prefetchRoutes.users },
    { name: 'Posts', path: '/posts', icon: FileText, prefetch: prefetchRoutes.posts },
    { name: 'Comments', path: '/comments', icon: MessageSquare, prefetch: prefetchRoutes.comments },
    { name: 'Reports', path: '/reports', icon: Flag, prefetch: prefetchRoutes.reports },
    { name: 'Messages', path: '/messages', icon: Mail, prefetch: prefetchRoutes.messages },
];

const advertisementItems = [
    { name: 'All Ads', path: '/ads', icon: Megaphone, prefetch: prefetchRoutes.ads },
    { name: 'Create Ad', path: '/ads/create', icon: PlusCircle, prefetch: prefetchRoutes.adForm },
    { name: 'Payments', path: '/payments', icon: Wallet, prefetch: prefetchRoutes.payments },
    { name: 'Revenue Dashboard', path: '/revenue', icon: BarChart3, prefetch: prefetchRoutes.revenue },
];

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleLogout = async () => {
        await dispatch(logoutAdmin());
        navigate('/login');
    };

    return (
        <aside className="w-64 bg-black text-white flex flex-col h-screen">
            {/* Header */}
            <div className="p-6">
                <h1 className="text-2xl font-bold">Admin Panel</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-thin 
            scrollbar-thumb-gray-700 scrollbar-track-gray-900">

                {/* Main Menu */}
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onMouseEnter={item.prefetch} // 🔥 PREFETCH HERE
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                                isActive
                                    ? 'bg-white text-black'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}

                {/* Advertisement Section */}
                <div className="pt-4">
                    <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                        Advertisement
                    </p>

                    <div className="space-y-2">
                        {advertisementItems.map((item) => {
                            const Icon = item.icon;

                            const isActive =
                                location.pathname === item.path ||
                                (item.path === '/ads' && location.pathname.startsWith('/ads/'));

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onMouseEnter={item.prefetch} // 🔥 PREFETCH HERE
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                                        isActive
                                            ? 'bg-white text-black'
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Logout */}
            <div className="p-4">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-300 hover:bg-red-800 hover:text-white transition-all duration-200"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
}