import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { errorText } from '@/lib/api';
import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * A dialog that searches as the user types and resolves to the picked result.
 * Use it for server-side lookups (products, stations); pass a local filter for static lists.
 *
 *     <SearchPicker
 *         open={picking} onOpenChange={setPicking}
 *         title="Select item" placeholder="Search products..."
 *         search={(query, signal) => products.search(query, null, signal)}
 *         getKey={(p) => p.productId}
 *         renderItem={(p) => <span>{p.productName}</span>}
 *         onSelect={addProduct}
 *     />
 */
export function SearchPicker<T>({
    open,
    onOpenChange,
    title,
    description,
    placeholder = 'Search...',
    search,
    getKey,
    renderItem,
    onSelect,
    emptyText = 'No results found.',
    isDisabled,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    placeholder?: string;
    /** Called (debounced) with the typed text, starting with '' when the dialog opens. */
    search: (query: string, signal: AbortSignal) => Promise<T[]>;
    getKey: (item: T) => string;
    renderItem: (item: T) => React.ReactNode;
    onSelect: (item: T) => void;
    emptyText?: string;
    /** Results that are listed but can't be picked (e.g. already added). */
    isDisabled?: (item: T) => boolean;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<T[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setIsSearching(true);
        const timer = window.setTimeout(
            async () => {
                try {
                    const found = await search(query.trim(), controller.signal);
                    if (controller.signal.aborted) return;
                    setResults(found);
                    setError(null);
                } catch (e) {
                    if (controller.signal.aborted) return;
                    setError(errorText(e));
                } finally {
                    if (!controller.signal.aborted) setIsSearching(false);
                }
            },
            query === '' ? 0 : 300,
        );
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
        // `search` is expected to be stable in behaviour; re-running on its identity would refetch on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, query]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-3">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="pl-9"
                    />
                    {isSearching && <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />}
                </div>
                <div className="-mx-2 min-h-32 flex-1 overflow-y-auto">
                    {error ? (
                        <p className="p-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
                    ) : results.length === 0 && !isSearching ? (
                        <p className="text-muted-foreground p-4 text-center text-sm">{emptyText}</p>
                    ) : (
                        <ul>
                            {results.map((item) => (
                                <li key={getKey(item)}>
                                    <button
                                        type="button"
                                        disabled={isDisabled?.(item)}
                                        onClick={() => {
                                            onSelect(item);
                                            onOpenChange(false);
                                        }}
                                        className="hover:bg-accent w-full rounded-md px-3 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {renderItem(item)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
