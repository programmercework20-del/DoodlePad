import { AlertCircle, Trash2, Flag, Lock, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchMessages,
    flagMessage,
    deleteMessage
} from '@/store/slices/messageSlice';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Button as Button1 } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import PageAnimation from '@/components/common/PageAnimation';
import EmptyState from '@/components/common/EmptyState';

export default function Messages() {
    const dispatch = useDispatch();
    const { messages, pagination, loading, error } = useSelector((state) => state.messages);

    const [page, setPage] = useState(1);

    useEffect(() => {
        dispatch(fetchMessages({ page, limit: 10 }));
    }, [dispatch, page]);

    const handleFlagMessage = async (id) => {
        try {
            await dispatch(flagMessage(id)).unwrap();
        } catch (err) {
            console.error('Error flagging message:', err);
        }
    };

    const handleDeleteMessage = async (id) => {
        try {
            await dispatch(deleteMessage(id)).unwrap();
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    return (
        <AdminLayout>
            <PageAnimation className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Message Monitoring</h1>
                    <p className="text-gray-500 mt-1">Review reported messages (Privacy Focused)</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900">Privacy Notice</h4>
                        <p className="text-sm text-blue-800">
                            For privacy compliance, message content is not fully visible unless explicitly reported.
                            Only metadata and flagged content types are shown below.
                        </p>
                    </div>
                </div>

                {loading && <Loader size="lg" className="py-12" />}

                {!loading && messages && (
                    <>
                        {messages.length === 0 ? (
                            <EmptyState
                                icon={Mail}
                                title="No flagged messages"
                                description="There are no reported messages to review at this time."
                            />
                        ) : (
                            <div className="bg-white rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-md">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {messages.map((message) => (
                                            <tr key={message.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-sm">{message.sender?.name}</p>
                                                        <p className="text-xs text-gray-500">To: {message.receiver?.name || 'Unknown'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline">{message.type}</Badge>
                                                    {message.hasMedia && <Badge variant="secondary" className="ml-2">Media</Badge>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center text-red-600 text-sm">
                                                        <AlertCircle className="h-4 w-4 mr-1" />
                                                        {message.reportCount} Reports
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(message.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleFlagMessage(message.id)}>
                                                            <Flag className="h-4 w-4 mr-1" /> Flag
                                                        </Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteMessage(message.id)}>
                                                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {pagination && pagination.pages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between mt-6 gap-4 border-t pt-6 px-2">
                                <p className="text-sm text-gray-500">
                                    Showing {messages.length} of {pagination.total} messages (Page {page} of {pagination.pages})
                                </p>
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <Button1
                                                variant="ghost"
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                                className="gap-1 px-3"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Previous
                                            </Button1>
                                        </PaginationItem>

                                        {[...Array(pagination.pages)].map((_, index) => {
                                            const pageNum = index + 1;
                                            if (
                                                pagination.pages <= 7 ||
                                                pageNum === 1 ||
                                                pageNum === pagination.pages ||
                                                (pageNum >= page - 1 && pageNum <= page + 1)
                                            ) {
                                                return (
                                                    <PaginationItem key={pageNum}>
                                                        <Button1
                                                            variant={page === pageNum ? "outline" : "ghost"}
                                                            size="icon"
                                                            onClick={() => setPage(pageNum)}
                                                        >
                                                            {pageNum}
                                                        </Button1>
                                                    </PaginationItem>
                                                );
                                            } else if (
                                                (pageNum === page - 2 && pageNum > 1) ||
                                                (pageNum === page + 2 && pageNum < pagination.pages)
                                            ) {
                                                return (
                                                    <PaginationItem key={pageNum}>
                                                        <PaginationEllipsis />
                                                    </PaginationItem>
                                                );
                                            }
                                            return null;
                                        })}

                                        <PaginationItem>
                                            <Button1
                                                variant="ghost"
                                                disabled={page === pagination.pages}
                                                onClick={() => setPage(page + 1)}
                                                className="gap-1 px-3"
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" />
                                            </Button1>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        )}
                    </>
                )}
            </PageAnimation>
        </AdminLayout>
    );
}
