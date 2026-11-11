import { Bell, BellRing } from '@/components/icons';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

/**
 * The glass bell used on blue surfaces (the header and the Home welcome card), with
 * a red unread badge, as on the phone app.
 */
export function NotificationBell({ shape = 'circle', className }: { shape?: 'circle' | 'tile'; className?: string }) {
    const unreadCount = useUnreadNotifications();

    return (
        <Link
            href={route('notifications.index')}
            className={cn(
                'relative flex size-10 shrink-0 items-center justify-center text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
                shape === 'circle' ? 'rounded-full bg-white/16' : 'rounded-xl border border-white/22 bg-white/14',
                className,
            )}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            title="Notifications"
        >
            {unreadCount > 0 ? <BellRing className="size-[21px]" /> : <Bell className="size-[21px]" />}
            {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--header)] bg-red-600 px-1 text-[10.5px] leading-none font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
