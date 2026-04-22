import { Receipt, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import EmptyState from '@/components/common/EmptyState';
import Loader from '@/components/common/Loader';
import { Badge } from '@/components/ui/badge';
import { Button as Button1 } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import { useFetch } from '@/hooks/useFetch';
import { paymentService } from '@/services/payment.service';

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString()}`;

export default function Payments() {
    const [page, setPage] = useState(1);
    const { data, loading } = useFetch(() => paymentService.getAllPayments({ page, limit: 10 }), [page]);

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Mock Payments</h1>
                    <p className="mt-1 text-gray-500">
                        Review simulated transactions before swapping in a real gateway like Razorpay.
                    </p>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                    <div className="border-b bg-[linear-gradient(135deg,#111827,#1d4ed8)] px-6 py-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-white/10 p-3">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">Transactions</h2>
                                <p className="mt-1 text-sm text-blue-100">
                                    Every mock payment creates a reusable audit trail for future payment integrations.
                                </p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <Loader size="lg" className="py-16" />
                    ) : data?.payments?.length ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px]">
                                    <thead className="bg-gray-50">
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="px-6 py-4">Ad</th>
                                            <th className="px-6 py-4">Transaction</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50/70">
                                                <td className="px-6 py-5">
                                                    <div className="font-medium text-gray-900">{payment.ad?.title || 'Deleted Ad'}</div>
                                                    <div className="text-sm text-gray-500">{payment.ad?.type || '-'}</div>
                                                </td>
                                                <td className="px-6 py-5 text-sm text-gray-700">{payment.transactionId}</td>
                                                <td className="px-6 py-5 text-sm font-semibold text-gray-900">
                                                    {formatCurrency(payment.amount)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <Badge variant={payment.paymentStatus === 'success' ? 'default' : 'secondary'}>
                                                        {payment.paymentStatus}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-5 text-sm text-gray-500">
                                                    {new Date(payment.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {data.pagination && data.pagination.pages > 1 && (
                                <div className="flex flex-col md:flex-row items-center justify-between border-t px-6 py-4 gap-4 bg-gray-50/30">
                                    <p className="text-sm text-gray-500">
                                        Showing {data.payments.length} of {data.pagination.total} transactions (Page {page} of {data.pagination.pages})
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

                                            {[...Array(data.pagination.pages)].map((_, index) => {
                                                const pageNum = index + 1;
                                                if (
                                                    data.pagination.pages <= 7 ||
                                                    pageNum === 1 ||
                                                    pageNum === data.pagination.pages ||
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
                                                    (pageNum === page + 2 && pageNum < data.pagination.pages)
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
                                                    disabled={page === data.pagination.pages}
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
                    ) : (
                        <div className="p-6">
                            <EmptyState
                                icon={Receipt}
                                title="No payments yet"
                                description="Simulate a payment from the Ads page to populate transaction history."
                            />
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
