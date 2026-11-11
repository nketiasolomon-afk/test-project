import { errorText } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiQuery<T> {
    /** The last successfully loaded value; kept while a reload is in flight. */
    data: T | undefined;
    /** A message fit to show, when the last load failed. */
    error: string | null;
    /** True until the first load settles. */
    isLoading: boolean;
    /** True while any load (first or reload) is in flight. */
    isFetching: boolean;
    reload: () => Promise<void>;
    /** Replaces the loaded value, e.g. with the record an action returned. */
    setData: (updater: T | ((current: T | undefined) => T | undefined)) => void;
}

/**
 * Loads data when the page mounts and whenever `deps` change.
 *
 *     const tickets = useApiQuery(() => fuelops.tickets.assigned());
 *     const report = useApiQuery(() => fuelops.reports.myJobCards({ from, to }), [from, to]);
 *
 * Pass `enabled: false` to hold the load back (e.g. until a role check passes).
 */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = [], options: { enabled?: boolean } = {}): ApiQuery<T> {
    const enabled = options.enabled ?? true;
    const [data, setData] = useState<T | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [isFetching, setIsFetching] = useState(enabled);

    // Always call the latest fetcher, and ignore answers from loads that were superseded.
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const latestLoad = useRef(0);

    const load = useCallback(async () => {
        const loadId = ++latestLoad.current;
        setIsFetching(true);
        try {
            const result = await fetcherRef.current();
            if (loadId !== latestLoad.current) return;
            setData(result);
            setError(null);
        } catch (e) {
            if (loadId !== latestLoad.current) return;
            setError(errorText(e));
        } finally {
            if (loadId === latestLoad.current) {
                setIsLoading(false);
                setIsFetching(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false);
            setIsFetching(false);
            return;
        }
        load();
        return () => {
            latestLoad.current++;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, load, ...deps]);

    return { data, error, isLoading, isFetching, reload: load, setData };
}
