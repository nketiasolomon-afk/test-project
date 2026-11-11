import { IconTile } from '@/components/fuelops/icon-tile';
import { CloudOff, Inbox, type IconType, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { type ApiQuery } from '@/hooks/use-api-query';
import { cn } from '@/lib/utils';

/** Placeholder cards with the phone's shimmer sweep, shown while a list loads. */
export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
    return (
        <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="bg-card relative flex h-[92px] flex-col justify-between overflow-hidden rounded-2xl p-3.5">
                    <span className="h-3.5 w-36 rounded bg-[#edeef1] dark:bg-[#2a2a2a]" />
                    <span className="h-2.5 w-full rounded bg-[#edeef1] dark:bg-[#2a2a2a]" />
                    <span className="animate-shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/6" />
                </div>
            ))}
        </div>
    );
}

/** The phone's error state: a red cloud tile, a bold title, a hint and a Retry button. */
export function ErrorState({
    message,
    title = "Couldn't load this page",
    onRetry,
    className,
}: {
    message: string;
    title?: string;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)} role="alert">
            <IconTile icon={CloudOff} color="#ef4444" size="xl" className="mb-2 size-20 rounded-[20px] [&>svg]:size-[38px]" />
            <p className="text-lg font-bold">{title}</p>
            <p className="text-muted-foreground max-w-md text-[13.5px] whitespace-pre-line">{message}</p>
            {onRetry && (
                <Button onClick={onRetry} className="mt-3">
                    <RefreshCw /> Retry
                </Button>
            )}
        </div>
    );
}

/** The phone's empty state: a soft blue tile with the icon, a bold title and a grey hint. */
export function EmptyState({
    icon = Inbox,
    title,
    description,
    action,
    className,
}: {
    icon?: IconType;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
            <IconTile icon={icon} size="xl" className="text-primary/60 mb-3" />
            <p className="text-[19px] font-bold">{title}</p>
            {description && <p className="text-muted-foreground max-w-md text-[13.5px] leading-relaxed">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
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
        return <ErrorState message={query.error ?? 'Check your connection and try again.'} onRetry={query.reload} />;
    }
    const emptyView = empty?.(query.data);
    return (
        <>
            {/* A failed reload keeps what was loaded before on screen, under the error. */}
            {query.error && <ErrorState message={query.error} onRetry={query.reload} className="mb-4 py-4" />}
            {emptyView || children(query.data)}
        </>
    );
}
