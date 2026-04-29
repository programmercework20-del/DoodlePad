import { Wallet } from 'lucide-react';
import { useState, useMemo } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { useFetch } from '@/hooks/useFetch';
import { paymentService } from '@/services/payment.service';
import DataTable from '@/components/common/DataTable';

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString()}`;

export default function Payments() {
    const [page, setPage] = useState(1);
    const { data, loading, error } = useFetch(() => paymentService.getAllPayments({ page, limit: 10 }), [page]);

    const COLUMNS = useMemo(() => [
        {
            key: 'ad',
            label: 'Ad',
            render: (row) => (
                <div>
                    <div className="font-medium text-gray-900">{row.ad?.title || 'Deleted Ad'}</div>
                    <div className="text-sm text-gray-500">{row.ad?.type || '-'}</div>
                </div>
            )
        },
        {
            key: 'transactionId',
            label: 'Transaction',
            render: (row) => <span className="text-sm font-mono text-gray-600">{row.transactionId}</span>
        },
        {
            key: 'amount',
            label: 'Amount',
            render: (row) => <span className="font-semibold text-gray-900">{formatCurrency(row.amount)}</span>
        },
        {
            key: 'paymentStatus',
            label: 'Status',
            render: (row) => (
                <Badge variant={row.paymentStatus === 'success' ? 'default' : 'secondary'}>
                    {row.paymentStatus}
                </Badge>
            )
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (row) => <span className="text-gray-500">{new Date(row.createdAt).toLocaleString()}</span>
        }
    ], []);

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

                    {error && (
                        <div className="bg-destructive/10 text-destructive p-4 mx-6 mt-4 rounded-lg">
                            Error loading payments: {typeof error === 'string' ? error : 'Unknown error'}
                        </div>
                    )}

                    <div className="p-4">
                        <DataTable
                            columns={COLUMNS}
                            data={data?.payments || []}
                            loading={loading}
                            pagination={data?.pagination}
                            page={page}
                            onPageChange={setPage}
                            emptyMessage="Simulate a payment from the Ads page to populate transaction history."
                        />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
