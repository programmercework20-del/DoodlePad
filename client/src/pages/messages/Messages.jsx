import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useFetch } from '@/hooks/useFetch';
import { messageService } from '@/services/message.service';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Flag, Lock } from 'lucide-react';

export default function Messages() {
    const [page, setPage] = useState(1);

    const { data, loading, refetch } = useFetch(
        () => messageService.getReportedMessages({ page }),
        [page]
    );

    const handleFlagMessage = async (id) => {
        try {
            await messageService.flagMessage(id);
            refetch();
        } catch (err) {
            console.error('Error flagging message:', err);
        }
    };

    const handleDeleteMessage = async (id) => {
        try {
            await messageService.deleteMessage(id);
            refetch();
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
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

                {!loading && data?.messages && (
                    <>
                        <div className="bg-white rounded-lg border overflow-hidden">
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
                                    {data.messages.map((message) => (
                                        <tr key={message.id} className="hover:bg-gray-50">
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
                                    {data.messages.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                No reported messages found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {data.pagination && (
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {data.messages.length} of {data.pagination.total} messages
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
