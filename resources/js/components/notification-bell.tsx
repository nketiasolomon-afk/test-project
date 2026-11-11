import { notifications } from '@/lib/fuelops-api';
import { Link, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

/**
 * The header's link to the notifications inbox, with the unread count. The web has no
 * push channel, so the count is polled while the tab is visible.
 */
export function NotificationBell() {
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
        // Reloaded on navigation: opening items or "Mark all read" changes the count.
    }, [url]);

    return (
        <Link
            href={route('notifications.index')}
            className="hover:bg-accent relative rounded-md p-2"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            title="Notifications"
        >
            <Bell className="size-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
