import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavGroup, type NavItem, type SharedData, type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Bell,
    ClipboardCheck,
    ClipboardList,
    FolderKanban,
    Gauge,
    Inbox,
    LayoutGrid,
    MapPin,
    PackagePlus,
    ShieldCheck,
    Star,
    Store,
    Ticket,
    TriangleAlert,
    UserRound,
    Users,
    UsersRound,
    Video,
    Warehouse,
} from 'lucide-react';
import AppLogo from './app-logo';

/**
 * The modules a user sees. Cluster-level modules are absent for a Technician, not
 * merely disabled; the ERP enforces the same rules on every request either way.
 */
function navGroupsFor(user: User): NavGroup[] {
    const work: NavItem[] = [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
        { title: 'Tickets', url: '/tickets', icon: Ticket },
        { title: 'My Projects', url: '/projects', icon: FolderKanban },
        { title: 'Special Assignments', url: '/special-assignments', icon: Star },
        { title: 'Compliance', url: '/compliance', icon: ShieldCheck },
    ];
    if (user.role === 'Station Leader') {
        work.push({ title: 'Report Issue', url: '/tickets/create', icon: TriangleAlert });
    }

    const stock: NavItem[] = [
        { title: 'CCTV Requisition', url: '/requisitions', icon: Video },
        { title: 'Inventory Request', url: '/inventory/requests', icon: PackagePlus },
        { title: 'Inventory', url: '/inventory', icon: Warehouse },
    ];

    const cluster: NavItem[] = [];
    if (user.isClusterLeader || user.canDispatch) {
        // Someone covering for a leader gets the queue only.
        cluster.push({ title: 'Assignment Queue', url: '/dispatch/queue', icon: Inbox });
    }
    if (user.isClusterLeader) {
        cluster.push(
            { title: 'Team Requests', url: '/cluster/team-requests', icon: ClipboardCheck },
            { title: 'Mini Store', url: '/cluster/mini-store', icon: Store },
            { title: 'Cluster Job Cards', url: '/cluster/job-cards', icon: ClipboardList },
        );
    }
    if (user.role === 'Cluster Engineer' || user.role === 'Cluster Leader') {
        cluster.push({ title: 'Cluster Overview', url: '/cluster/overview', icon: UsersRound });
    }
    if (user.role === 'Operations Admin') {
        cluster.push({ title: 'Operations Overview', url: '/operations/overview', icon: Gauge });
    }
    if (user.isClusterLeader || user.role === 'Cluster Engineer' || user.role === 'Operations Admin') {
        cluster.push({ title: 'Technicians', url: '/technicians', icon: Users });
    }

    const personal: NavItem[] = [
        { title: 'My Reports', url: '/reports', icon: BarChart3 },
        { title: 'My Location', url: '/location', icon: MapPin },
        { title: 'Notifications', url: '/notifications', icon: Bell },
        { title: 'Profile', url: '/profile', icon: UserRound },
    ];

    return [
        { title: 'Work', items: work },
        { title: 'Stock', items: stock },
        ...(cluster.length > 0 ? [{ title: 'Cluster', items: cluster }] : []),
        { title: 'Me', items: personal },
    ];
}

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={navGroupsFor(auth.user)} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
