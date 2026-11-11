import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type ApiQuery } from '@/hooks/use-api-query';
import { cn } from '@/lib/utils';
import { AlertTriangle, Inbox, type LucideIcon, RefreshCw } from 'lucide-react';

/** Placeholder rows shown while a list loads. */
export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
    return (
        <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
        </div>
    );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center', className)}>
            <AlertTriangle className="text-destructive size-8" />
            <p className="text-muted-foreground max-w-md text-sm whitespace-pre-line">{message}</p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw /> Retry
                </Button>
            )}
        </div>
    );
}

export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center', className)}>
            <Icon className="text-muted-foreground/60 size-10" />
            <p className="font-medium">{title}</p>
            {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

/**
 * Renders a query's loading and error states, and its data once loaded:
 *
 *     <QueryView query={tickets} empty={(list) => list.length === 0 && <EmptyState title="No tickets" />}>
 *         {(list) => list.map(...)}
 *     </QueryView>
 */
export function QueryView<T>({
    query,
    children,
    empty,
    loadingRows,
}: {
    query: ApiQuery<T>;
    children: (data: T) => React.ReactNode;
    /** Return an element to show in place of the content when the data is empty. */
    empty?: (data: T) => React.ReactNode | false | null;
    loadingRows?: number;
}) {
    if (query.isLoading) return <LoadingState rows={loadingRows} />;
    if (query.data === undefined) {
        return <ErrorState message={query.error ?? 'Something went wrong. Please try again.'} onRetry={query.reload} />;
    }
    const emptyView = empty?.(query.data);
    return (
        <>
            {/* A failed reload keeps what was loaded before on screen, under the error. */}
            {query.error && <ErrorState message={query.error} onRetry={query.reload} className="mb-4 p-4" />}
            {emptyView || children(query.data)}
        </>
    );
}
