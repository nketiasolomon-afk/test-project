import { BOTTOM_TABS, currentPath, longestMatch } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';

/** The phone app's bottom tab bar, shown below the desktop breakpoint. */
export function BottomNav() {
    const page = usePage();
    const active = longestMatch(
        BOTTOM_TABS.flatMap((tab) => tab.matches),
        currentPath(page.url),
    );

    return (
        <nav aria-label="Tabs" className="bg-nav fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] lg:hidden">
            <ul className="mx-auto grid max-w-xl grid-cols-5">
                {BOTTOM_TABS.map((tab) => {
                    const isActive = active !== null && tab.matches.includes(active);
                    const Icon = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;
                    return (
                        <li key={tab.url}>
                            <Link
                                href={tab.url}
                                prefetch
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex flex-col items-center gap-1 px-0.5 py-2 text-[11px] sm:text-xs',
                                    isActive ? 'text-primary font-semibold' : 'text-nav-foreground font-medium',
                                )}
                            >
                                <span className={cn('flex items-center justify-center rounded-xl p-1.5 transition-colors sm:p-2', isActive ? 'bg-primary/12' : 'bg-gray-500/8')}>
                                    <Icon className="size-[26px] sm:size-7" />
                                </span>
                                <span className="max-w-full truncate">{tab.title}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
