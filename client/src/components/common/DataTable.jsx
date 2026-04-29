import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button-1';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from '@/components/ui/pagination';
import { memo } from 'react';

/**
 * @param {Object}   props
 * @param {Array}    props.columns        - [{ key, label, render? }]
 * @param {Array}    props.data           - Row objects
 * @param {boolean}  [props.loading]      - Loading state
 * @param {string}   [props.rowKey]       - Field to use as row key (default: 'id')
 * @param {Object}   [props.pagination]   - { total, pages } from API
 * @param {number}   [props.page]         - Current page number
 * @param {Function} [props.onPageChange] - (pageNum) => void
 * @param {string}   [props.emptyMessage] - Fallback text when data is empty
 */
export default function DataTable({
    columns,
    data,
    loading,
    rowKey = 'id',
    pagination,
    page,
    onPageChange,
    emptyMessage = 'No data found.',
}) {
    const showPagination = pagination && data.length > 0 && pagination.pages > 1;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-md">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">{emptyMessage}</p>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((row) => (
                                <tr
                                    key={row[rowKey]}
                                    className="hover:bg-gray-50 transition-colors"
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-6 py-4 text-sm text-gray-500">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showPagination && !loading && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t pt-6 px-2">
                    <p className="text-sm text-gray-500">
                        Showing {data.length} of {pagination.total} results (Page {page} of {pagination.pages})
                    </p>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    disabled={page === 1}
                                    onClick={() => onPageChange(page - 1)}
                                    className="gap-1 px-3"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
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
                                            <Button
                                                variant={page === pageNum ? 'outline' : 'ghost'}
                                                size="icon"
                                                onClick={() => onPageChange(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
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
                                <Button
                                    variant="ghost"
                                    disabled={page === pagination.pages}
                                    onClick={() => onPageChange(page + 1)}
                                    className="gap-1 px-3"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
