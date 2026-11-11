import { notifications } from '@/lib/fuelops-api';
import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

/**
 * The signed-in user's unread notification count. The web has no push channel, so
 * the count is polled while the tab is visible, and reloaded on navigation because
 * opening items or "Mark all read" changes it.
 */
export function useUnreadNotifications(): number {
    const [unreadCount, setUnreadCount] = useState(0);
    const { url } = usePage();

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const result = await notifications.list(true);
                if (!cancelled) setUnreadCount(result.unreadCount);
            } catch {
                // Keep the last known count; the bell still opens the list.
            }
        };

        load();
        const timer = window.setInterval(load, POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', load);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', load);
        };
    }, [url]);

    return unreadCount;
}
