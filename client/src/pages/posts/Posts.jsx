import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { postService } from '@/services/post.service';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function Posts() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, loading, refetch } = useFetch(
        () => postService.getAllPosts({ search: searchQuery, type: typeFilter, status: statusFilter, page }),
        [searchQuery, typeFilter, statusFilter, page]
    );

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        refetch();
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: 'default',
            hidden: 'secondary',
            deleted: 'destructive',
            sensitive: 'outline',
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    const getTypeBadge = (type) => {
        return <Badge variant="outline">{type}</Badge>;
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Post Management</h1>
                    <p className="text-gray-500 mt-1">Moderate and manage all posts</p>
                </div>

                <div className="bg-white rounded-lg border p-6 space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search posts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button type="submit">Search</Button>
                    </form>

                    <div className="flex gap-2">
                        <div className="space-x-2">
                            <span className="text-sm font-medium">Type:</span>
                            {['', 'image', 'video', 'audio', 'text', 'doodle', 'live'].map((type) => (
                                <Button
                                    key={type}
                                    variant={typeFilter === type ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTypeFilter(type)}
                                >
                                    {type || 'All'}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        {['', 'active', 'hidden', 'deleted', 'sensitive'].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status || 'All'}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {!loading && data?.posts && (
                    <>
                        <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caption</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.posts.map((post) => (
                                        <tr key={post.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm">{post.author?.name}</td>
                                            <td className="px-6 py-4">{getTypeBadge(post.type)}</td>
                                            <td className="px-6 py-4 text-sm max-w-xs truncate">{post.caption || '-'}</td>
                                            <td className="px-6 py-4">{getStatusBadge(post.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {post.status === 'active' && (
                                                        <Button size="sm" variant="outline" onClick={() => postService.hidePost(post.id).then(refetch)}>
                                                            Hide
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="destructive" onClick={() => postService.deletePost(post.id).then(refetch)}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {data.pagination && (
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {data.posts.length} of {data.pagination.total} posts
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
