import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { userService } from '@/services/user.service';
import Loader from '@/components/common/Loader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Users() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, loading, error, refetch } = useFetch(
        () => userService.getAllUsers({ search: searchQuery, status: statusFilter, page }),
        [searchQuery, statusFilter, page]
    );

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        refetch();
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: 'default',
            warned: 'secondary',
            blocked: 'outline',
            banned: 'destructive',
        };

        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500 mt-1">Monitor and manage all users</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-4">
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
                        <Button type="submit">Search</Button>
                    </form>

                    <div className="flex gap-2">
                        <Button
                            variant={statusFilter === '' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('')}
                        >
                            All
                        </Button>
                        <Button
                            variant={statusFilter === 'active' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('active')}
                        >
                            Active
                        </Button>
                        <Button
                            variant={statusFilter === 'warned' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('warned')}
                        >
                            Warned
                        </Button>
                        <Button
                            variant={statusFilter === 'blocked' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('blocked')}
                        >
                            Blocked
                        </Button>
                        <Button
                            variant={statusFilter === 'banned' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('banned')}
                        >
                            Banned
                        </Button>
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading users
                    </div>
                )}

                {!loading && data?.users && (
                    <>
                        <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <span className="text-sm font-medium">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="font-medium">{user.name}</p>
                                                        <p className="text-sm text-gray-500">@{user.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{user.warningCount}</td>
                                            <td className="px-6 py-4">
                                                <Link to={`/users/${user.id}`}>
                                                    <Button size="sm" variant="outline">
                                                        View Details
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {data.pagination && (
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {data.users.length} of {data.pagination.total} users
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
        </AdminLayout>
    );
}
