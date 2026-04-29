import { Search, FileText } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { postService } from '@/services/post.service';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/common/EmptyState';
import DataTable from '@/components/common/DataTable';
import Avatar from '@/components/common/Avatar';

const STATUS_VARIANTS = {
    active: 'default',
    hidden: 'secondary',
    deleted: 'destructive',
    sensitive: 'outline',
};

export default function Posts() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, loading, error, refetch } = useFetch(
        () => postService.getAllPosts({ search: searchQuery, type: typeFilter, status: statusFilter, page, limit: 10 }),
        [searchQuery, typeFilter, statusFilter, page]
    );

    const POST_COLUMNS = [
        {
            key: 'author',
            label: 'Author',
            render: (post) => (
                <div className="flex items-center gap-3">
                    <Avatar src={post.author?.profilePhoto} name={post.author?.name} size="h-8 w-8" />
                    <span className="text-sm font-medium">{post.author?.name}</span>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (post) => <Badge variant="outline">{post.type}</Badge>
        },
        {
            key: 'caption',
            label: 'Caption',
            render: (post) => (
                <div className="max-w-xs truncate text-sm">
                    {post.caption || <span className="text-gray-400 italic">No caption</span>}
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (post) => (
                <Badge variant={STATUS_VARIANTS[post.status] || 'default'}>
                    {post.status}
                </Badge>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (post) => (
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
            )
        }
    ];

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
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
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                className="pl-10"
                            />
                        </div>
                    </form>

                    <div className="flex flex-wrap gap-4">
                        <div className="space-y-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</span>
                            <div className="flex flex-wrap gap-2">
                                {['', 'image', 'video', 'audio', 'text', 'doodle', 'live'].map((type) => (
                                    <Button
                                        key={type}
                                        variant={typeFilter === type ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => { setTypeFilter(type); setPage(1); }}
                                    >
                                        {type || 'All'}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span>
                            <div className="flex flex-wrap gap-2">
                                {['', 'active', 'hidden', 'deleted', 'sensitive'].map((status) => (
                                    <Button
                                        key={status}
                                        variant={statusFilter === status ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => { setStatusFilter(status); setPage(1); }}
                                    >
                                        {status || 'All'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                        Error loading posts: {typeof error === 'string' ? error : 'Unknown error'}
                    </div>
                )}

                {loading && <Loader size="lg" className="py-12" />}

                {!loading && data?.posts && (
                    data.posts.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="No posts found"
                            description={
                                searchQuery || typeFilter || statusFilter
                                    ? "No posts match your current search filters."
                                    : "No posts found."
                            }
                            actionLabel={(searchQuery || typeFilter || statusFilter) ? "Clear Filters" : undefined}
                            onAction={() => {
                                setSearchQuery('');
                                setTypeFilter('');
                                setStatusFilter('');
                                setPage(1);
                            }}
                        />
                    ) : (
                        <DataTable
                            columns={POST_COLUMNS}
                            data={data.posts}
                            pagination={data.pagination}
                            page={page}
                            onPageChange={setPage}
                        />
                    )
                )}
            </div>
        </AdminLayout>
    );
}

