// import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
// import { useState, useEffect } from 'react';
// import { useDispatch, useSelector } from 'react-redux';
// import { Link } from 'react-router-dom';

// import AdminLayout from '@/components/layout/AdminLayout';
// import Loader from '@/components/common/Loader';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { Button as Button1 } from '@/components/ui/button-1';
// import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
// import PageAnimation from '@/components/common/PageAnimation';
// import EmptyState from '@/components/common/EmptyState';

// import { fetchUsers } from '@/store/slices/userSlice';
// import { useDebounce } from '../../hooks/useDebounce';

// export default function Users() {
//     const dispatch = useDispatch();
//     const { users, pagination, loading, error } = useSelector((state) => state.users);

//     const [searchQuery, setSearchQuery] = useState('');
//     const [statusFilter, setStatusFilter] = useState('');
//     const [page, setPage] = useState(1);

//     const debouncedSearch = useDebounce(searchQuery, 400);

//     // Fires only after user stops typing for 400ms
//     useEffect(() => {
//         dispatch(fetchUsers({ search: debouncedSearch, status: statusFilter, page, limit: 10 }));
//     }, [dispatch, debouncedSearch, statusFilter, page]);
    
//     // Reset to page 1 when search changes
//     useEffect(() => {
//         setPage(1);
//     }, [debouncedSearch]);


//     const handleSearch = (e) => {
//         e.preventDefault();
//         setPage(1);
//         dispatch(fetchUsers({ search: searchQuery, status: statusFilter, page: 1, limit: 10 }));
//     };

//     const getStatusBadge = (status) => {
//         const variants = {
//             active: 'default',
//             warned: 'secondary',
//             blocked: 'outline',
//             banned: 'destructive',
//         };

//         return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
//     };

//     return (
//         <AdminLayout>
//             <PageAnimation className="space-y-6">
//                 <div>
//                     <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
//                     <p className="text-gray-500 mt-1">Monitor and manage all users</p>
//                 </div>

//                 <div className="bg-white rounded-lg border p-6 space-y-4">
//                     <form onSubmit={handleSearch} className="flex gap-4">
//                         <div className="flex-1 relative">
//                             <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
//                             <Input
//                                 type="text"
//                                 placeholder="Search by name, email, or username..."
//                                 value={searchQuery}
//                                 onChange={(e) => setSearchQuery(e.target.value)}
//                                 className="pl-10"
//                             />
//                         </div>
//                         <Button type="submit">Search</Button>
//                     </form>

//                     <div className="flex gap-2">
//                         <Button
//                             variant={statusFilter === '' ? 'default' : 'outline'}
//                             size="sm"
//                             onClick={() => { setStatusFilter(''); setPage(1); }}
//                         >
//                             All
//                         </Button>
//                         <Button
//                             variant={statusFilter === 'active' ? 'default' : 'outline'}
//                             size="sm"
//                             onClick={() => { setStatusFilter('active'); setPage(1); }}
//                         >
//                             Active
//                         </Button>
//                         <Button
//                             variant={statusFilter === 'warned' ? 'default' : 'outline'}
//                             size="sm"
//                             onClick={() => { setStatusFilter('warned'); setPage(1); }}
//                         >
//                             Warned
//                         </Button>
//                         <Button
//                             variant={statusFilter === 'blocked' ? 'default' : 'outline'}
//                             size="sm"
//                             onClick={() => { setStatusFilter('blocked'); setPage(1); }}
//                         >
//                             Blocked
//                         </Button>
//                         <Button
//                             variant={statusFilter === 'banned' ? 'default' : 'outline'}
//                             size="sm"
//                             onClick={() => { setStatusFilter('banned'); setPage(1); }}
//                         >
//                             Banned
//                         </Button>
//                     </div>
//                 </div>

//                 {loading && <Loader size="lg" className="py-12" />}

//                 {error && (
//                     <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
//                         Error loading users: {typeof error === 'string' ? error : 'Unknown error'}
//                     </div>
//                 )}

//                 {!loading && users && (
//                     <>
//                         {users.length === 0 ? (
//                             <EmptyState
//                                 icon={Search}
//                                 title="No users found"
//                                 description={
//                                     searchQuery || statusFilter
//                                         ? "No users match your current search filters. Try adjusting them."
//                                         : "No users exist in the system."
//                                 }
//                                 actionLabel={
//                                     (searchQuery || statusFilter) ? "Clear Filters" : undefined
//                                 }
//                                 onAction={() => {
//                                     setSearchQuery('');
//                                     setStatusFilter('');
//                                     setPage(1);
//                                 }}
//                             />
//                         ) : (
//                             <div className="bg-white rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-md">
//                                 <table className="w-full">
//                                     <thead className="bg-gray-50 border-b">
//                                         <tr>
//                                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
//                                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
//                                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
//                                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
//                                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
//                                         </tr>
//                                     </thead>
//                                     <tbody className="divide-y">
//                                         {users.map((user) => (
//                                             <tr key={user.id} className="hover:bg-gray-50 transition-colors">
//                                                 <td className="px-6 py-4">
//                                                     <div className="flex items-center">
//                                                         <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
//                                                             <div className="flex items-center justify-center rounded-full bg-gray-200 overflow-hidden text-gray-700 w-full h-full">
//                                                                 {user.profilePhoto ? (
//                                                                     <img
//                                                                         className='w-full h-full object-cover rounded-full'
//                                                                         src={user.profilePhoto}
//                                                                         alt="User Profile"
//                                                                     />
//                                                                 ) : (
//                                                                     <span className="text-sm font-bold uppercase">
//                                                                         {user.name?.charAt(0)}
//                                                                     </span>
//                                                                 )}
//                                                             </div>
//                                                         </div>
//                                                         <div className="ml-3">
//                                                             <p className="font-medium">{user.name}</p>
//                                                             <p className="text-sm text-gray-500">@{user.username}</p>
//                                                         </div>
//                                                     </div>
//                                                 </td>
//                                                 <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
//                                                 <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
//                                                 <td className="px-6 py-4 text-sm text-gray-500">{user.warningCount}</td>
//                                                 <td className="px-6 py-4">
//                                                     <Link to={`/users/${user.id}`}>
//                                                         <Button size="sm" variant="outline">
//                                                             View Details
//                                                         </Button>
//                                                     </Link>
//                                                 </td>
//                                             </tr>
//                                         ))}
//                                     </tbody>
//                                 </table>
//                             </div>
//                         )}

//                         {pagination && users.length > 0 && pagination.pages > 1 && (
//                             <div className="flex flex-col md:flex-row items-center justify-between mt-6 gap-4 border-t pt-6 px-2">
//                                 <p className="text-sm text-gray-500">
//                                     Showing {users.length} of {pagination.total} users (Page {page} of {pagination.pages})
//                                 </p>
//                                 <Pagination>
//                                     <PaginationContent>
//                                         <PaginationItem>
//                                             <Button1
//                                                 variant="ghost"
//                                                 disabled={page === 1}
//                                                 onClick={() => setPage(page - 1)}
//                                                 className="gap-1 px-3"
//                                             >
//                                                 <ChevronLeft className="h-4 w-4" />
//                                                 Previous
//                                             </Button1>
//                                         </PaginationItem>

//                                         {[...Array(pagination.pages)].map((_, index) => {
//                                             const pageNum = index + 1;
//                                             if (
//                                                 pagination.pages <= 7 ||
//                                                 pageNum === 1 ||
//                                                 pageNum === pagination.pages ||
//                                                 (pageNum >= page - 1 && pageNum <= page + 1)
//                                             ) {
//                                                 return (
//                                                     <PaginationItem key={pageNum}>
//                                                         <Button1
//                                                             variant={page === pageNum ? "outline" : "ghost"}
//                                                             size="icon"
//                                                             onClick={() => setPage(pageNum)}
//                                                         >
//                                                             {pageNum}
//                                                         </Button1>
//                                                     </PaginationItem>
//                                                 );
//                                             } else if (
//                                                 (pageNum === page - 2 && pageNum > 1) ||
//                                                 (pageNum === page + 2 && pageNum < pagination.pages)
//                                             ) {
//                                                 return (
//                                                     <PaginationItem key={pageNum}>
//                                                         <PaginationEllipsis />
//                                                     </PaginationItem>
//                                                 );
//                                             }
//                                             return null;
//                                         })}

//                                         <PaginationItem>
//                                             <Button1
//                                                 variant="ghost"
//                                                 disabled={page === pagination.pages}
//                                                 onClick={() => setPage(page + 1)}
//                                                 className="gap-1 px-3"
//                                             >
//                                                 Next
//                                                 <ChevronRight className="h-4 w-4" />
//                                             </Button1>
//                                         </PaginationItem>
//                                     </PaginationContent>
//                                 </Pagination>
//                             </div>
//                         )}
//                     </>
//                 )}
//             </PageAnimation>
//         </AdminLayout>
//     );
// }



import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import DataTable from '@/components/common/DataTable';
import EmptyState from '@/components/common/EmptyState';
import PageAnimation from '@/components/common/PageAnimation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchUsers } from '@/store/slices/userSlice';
import { useDebounce } from '@/hooks/useDebounce';
import Avatar from '../../components/common/Avatar';
import { selectUsersState } from '../../store/slices/userSlice';

const STATUS_VARIANTS = {
    active: 'default',
    warned: 'secondary',
    blocked: 'outline',
    banned: 'destructive',
};

// Column definitions live here, not scattered in JSX
const USER_COLUMNS = [
    // {
    //     key: 'name',
    //     label: 'User',
    //     render: (user) => (
    //         <div className="flex items-center">
    //             <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-700">
    //                 {user.profilePhoto ? (
    //                     <img
    //                         className="w-full h-full object-cover rounded-full"
    //                         src={user.profilePhoto}
    //                         alt="User Profile"
    //                     />
    //                 ) : (
    //                     <span className="text-sm font-bold uppercase">
    //                         {user.name?.charAt(0)}
    //                     </span>
    //                 )}
    //             </div>
    //             <div className="ml-3">
    //                 <p className="font-medium text-gray-900">{user.name}</p>
    //                 <p className="text-sm text-gray-500">@{user.username}</p>
    //             </div>
    //         </div>
    //     ),
    // },
    {
    key: 'name',
    label: 'User',
    render: (user) => (
        <div className="flex items-center">
            <Avatar src={user.profilePhoto} name={user.name} />
            <div className="ml-3">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">@{user.username}</p>
            </div>
        </div>
    ),
},
    { key: 'email', label: 'Email' },
    {
        key: 'status',
        label: 'Status',
        render: (user) => (
            <Badge variant={STATUS_VARIANTS[user.status] || 'default'}>
                {user.status}
            </Badge>
        ),
    },
    { key: 'warningCount', label: 'Warnings' },
    {
        key: 'actions',
        label: 'Actions',
        render: (user) => (
            <Link to={`/users/${user.id}`}>
                <Button size="sm" variant="outline">View Details</Button>
            </Link>
        ),
    },
];

const STATUS_FILTERS = ['', 'active', 'warned', 'blocked', 'banned'];
const STATUS_LABELS = { '': 'All', active: 'Active', warned: 'Warned', blocked: 'Blocked', banned: 'Banned' };

export default function Users() {
    const dispatch = useDispatch();
    const { users, pagination, loading, error } = useSelector(selectUsersState);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const debouncedSearch = useDebounce(searchQuery, 400);

    useEffect(() => {
        dispatch(fetchUsers({ search: debouncedSearch, status: statusFilter, page, limit: 10 }));
    }, [dispatch, debouncedSearch, statusFilter, page]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPage(1);
    };

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500 mt-1">Monitor and manage all users</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by name, email, or username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div className="flex gap-2">
                        {STATUS_FILTERS.map((s) => (
                            <Button
                                key={s || 'all'}
                                variant={statusFilter === s ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                            >
                                {STATUS_LABELS[s]}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading users: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                {!loading && users && (
                    users.length === 0 ? (
                        <EmptyState
                            icon={Search}
                            title="No users found"
                            description={
                                searchQuery || statusFilter
                                    ? 'No users match your current filters. Try adjusting them.'
                                    : 'No users exist in the system.'
                            }
                            actionLabel={(searchQuery || statusFilter) ? 'Clear Filters' : undefined}
                            onAction={clearFilters}
                        />
                    ) : (
                        <DataTable
                            columns={USER_COLUMNS}
                            data={users}
                            pagination={pagination}
                            page={page}
                            onPageChange={setPage}
                        />
                    )
                )}
            </PageAnimation>
        </AdminLayout>
    );
}