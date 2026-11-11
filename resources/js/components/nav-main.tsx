import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavGroup } from '@/types';
import { Link, usePage } from '@inertiajs/react';

/** The item whose URL is the longest prefix of the current path, so /inventory/requests doesn't also light up /inventory. */
function activeUrl(groups: NavGroup[], path: string): string | null {
    let best: string | null = null;
    for (const item of groups.flatMap((group) => group.items)) {
        const matches = path === item.url || path.startsWith(`${item.url}/`);
        if (matches && (best === null || item.url.length > best.length)) best = item.url;
    }
    return best;
}

export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const page = usePage();
    const active = activeUrl(groups, page.url.split(/[?#]/)[0]);

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.title} className="px-2 py-0">
                    <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => (
                            <SidebarMenuItem key={item.url}>
                                <SidebarMenuButton asChild isActive={item.url === active} tooltip={item.title}>
                                    <Link href={item.url} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    );
}
