import { BrandTitle } from '@/components/brand/brand-title';
import { LogoBadge } from '@/components/brand/logo-badge';
import { ChevronsUpDown } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { currentPath, longestMatch, moduleGroupsFor } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';

/** The white desktop side menu: logo, grouped modules with a light-blue active pill, and the user card. */
export function AppSidebar() {
    const page = usePage<SharedData>();
    const user = page.props.auth.user;
    const groups = moduleGroupsFor(user);
    const active = longestMatch(
        groups.flatMap((group) => group.items.map((item) => item.url)),
        currentPath(page.url),
    );

    return (
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r lg:flex">
            <Link href="/dashboard" className="flex items-center gap-3 px-5 pt-6 pb-5">
                <LogoBadge size={44} variant="solid" />
                <span className="min-w-0">
                    <BrandTitle animate={false} className="text-brand-ink text-[15px] dark:text-white" />
                    <span className="text-muted-foreground block text-xs">StarOil FuelOps</span>
                </span>
            </Link>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
                {groups.map((group) => (
                    <div key={group.title}>
                        <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">{group.title}</p>
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = item.url === active;
                                return (
                                    <li key={item.url}>
                                        <Link
                                            href={item.url}
                                            prefetch
                                            aria-current={isActive ? 'page' : undefined}
                                            className={cn(
                                                'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                                    : 'hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <item.icon className="size-[22px]" />
                                            <span className="truncate">{item.title}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="border-sidebar-border border-t p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger className="hover:bg-muted data-[state=open]:bg-muted flex w-full items-center gap-2 rounded-xl p-2 text-left">
                        <UserInfo user={user} showRole />
                        <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl" align="end" side="top">
                        <UserMenuContent user={user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
