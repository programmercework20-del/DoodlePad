import { Button } from '@/components/ui/button';

export default function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            {Icon && (
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-gray-400" />
                </div>
            )}

            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
                {description}
            </p>

            {actionLabel && (
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={onAction}
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
