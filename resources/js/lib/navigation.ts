import {
    BarChart3,
    Bell,
    ClipboardCheck,
    FolderKanban,
    Gauge,
    HardHat,
    Home,
    Inbox,
    MapPin,
    Package,
    ShieldCheck,
    Star,
    Store,
    Summarize,
    Ticket,
    TriangleAlert,
    UserRound,
    UsersRound,
    Warehouse,
    CirclePlus,
    CirclePlusFilled,
    type IconType,
} from '@/components/icons';
import { type User } from '@/types';

export interface AppModule {
    title: string;
    /** One line shown under the title on the Home screen's Quick Access cards. */
    subtitle: string;
    url: string;
    icon: IconType;
    /** The module's accent colour, as in the mobile app's Quick Access tiles. */
    accent: string;
}

export interface ModuleGroup {
    title: string;
    items: AppModule[];
}

const BLUE = '#2178BD';

/**
 * Every module a user can open, grouped as the desktop side menu shows them.
 * Cluster-level modules are absent for a Technician, not merely disabled; the ERP
 * enforces the same rules on every request either way.
 */
export function moduleGroupsFor(user: User): ModuleGroup[] {
    const work: AppModule[] = [
        { title: 'Home', subtitle: 'Your dashboard', url: '/dashboard', icon: Home, accent: BLUE },
        { title: 'Tickets', subtitle: 'View & manage your tickets', url: '/tickets', icon: Ticket, accent: BLUE },
        { title: 'My Projects', subtitle: 'Projects you are working on', url: '/projects', icon: FolderKanban, accent: '#43A047' },
        { title: 'Special Assignments', subtitle: 'One-off jobs assigned to you', url: '/special-assignments', icon: Star, accent: '#1E88E5' },
        { title: 'Compliance', subtitle: 'Station compliance checks', url: '/compliance', icon: ShieldCheck, accent: '#0F766E' },
    ];
    if (user.role === 'Station Leader') {
        work.push({ title: 'Report Issue', subtitle: 'Raise a new issue at your station', url: '/tickets/create', icon: TriangleAlert, accent: '#DC2626' });
    }

    const stock: AppModule[] = [
        { title: 'CCTV Requisition', subtitle: 'Request CCTV and network equipment for a job', url: '/requisitions', icon: CirclePlus, accent: '#BE123C' },
        { title: 'Inventory Request', subtitle: 'Request general stock from the warehouse', url: '/inventory/requests', icon: Package, accent: '#B45309' },
        { title: 'Inventory', subtitle: 'Stock on hand & usage by technician', url: '/inventory', icon: Warehouse, accent: '#0F766E' },
    ];

    const cluster: AppModule[] = [];
    if (user.isClusterLeader || user.canDispatch) {
        cluster.push({
            title: 'Assignment Queue',
            subtitle: user.isClusterLeader ? 'Assign new, declined & reopened tickets' : "You're covering dispatch for a Cluster Leader",
            url: '/dispatch/queue',
            icon: Inbox,
            accent: '#4D7C0F',
        });
    }
    if (user.isClusterLeader) {
        cluster.push(
            { title: 'Team Requests', subtitle: "Approve & issue your cluster's stock requests", url: '/cluster/team-requests', icon: ClipboardCheck, accent: '#059669' },
            { title: 'Mini Store', subtitle: 'Cluster stock & restock requests', url: '/cluster/mini-store', icon: Store, accent: '#C2410C' },
            { title: 'Cluster Job Cards', subtitle: 'Work submitted across your team', url: '/cluster/job-cards', icon: Summarize, accent: '#0369A1' },
        );
    }
    if (user.role === 'Cluster Engineer' || user.role === 'Cluster Leader') {
        cluster.push({ title: 'Cluster Overview', subtitle: 'Workload & performance across the cluster', url: '/cluster/overview', icon: UsersRound, accent: '#1F4788' });
    }
    if (user.role === 'Operations Admin') {
        cluster.push({ title: 'Operations Overview', subtitle: 'Operations across every cluster', url: '/operations/overview', icon: Gauge, accent: '#1F4788' });
    }
    if (user.isClusterLeader || user.role === 'Cluster Engineer' || user.role === 'Operations Admin') {
        cluster.push({
            title: 'Technicians',
            subtitle: 'Distance covered, issues resolved & parts consumed',
            url: '/technicians',
            icon: HardHat,
            accent: '#0E7490',
        });
    }

    const personal: AppModule[] = [
        { title: 'My Reports', subtitle: 'Your activity, job cards & usage', url: '/reports', icon: BarChart3, accent: '#6D28D9' },
        { title: 'My Location', subtitle: 'Track & log your location', url: '/location', icon: MapPin, accent: '#B45309' },
        { title: 'Notifications', subtitle: 'Updates on your work', url: '/notifications', icon: Bell, accent: BLUE },
        { title: 'Profile', subtitle: 'Your profile & settings', url: '/profile', icon: UserRound, accent: '#6D28D9' },
    ];

    return [
        { title: 'Work', items: work },
        { title: 'Stock', items: stock },
        ...(cluster.length > 0 ? [{ title: 'Cluster', items: cluster }] : []),
        { title: 'Me', items: personal },
    ];
}

/** The mobile bottom tab bar, as on the phone app. */
export const BOTTOM_TABS: { title: string; url: string; icon: IconType; activeIcon?: IconType; matches: string[] }[] = [
    { title: 'Home', url: '/dashboard', icon: Home, matches: ['/dashboard'] },
    { title: 'Tickets', url: '/tickets', icon: Ticket, matches: ['/tickets', '/projects', '/special-assignments'] },
    { title: 'Requisition', url: '/requisitions', icon: CirclePlus, activeIcon: CirclePlusFilled, matches: ['/requisitions'] },
    { title: 'My Location', url: '/location', icon: MapPin, matches: ['/location'] },
    { title: 'Profile', url: '/profile', icon: UserRound, matches: ['/profile', '/settings'] },
];

/** The URL among `urls` that is the longest prefix of `path`, so /inventory/requests doesn't also light up /inventory. */
export function longestMatch(urls: string[], path: string): string | null {
    let best: string | null = null;
    for (const url of urls) {
        const matches = path === url || path.startsWith(`${url}/`);
        if (matches && (best === null || url.length > best.length)) best = url;
    }
    return best;
}

export function currentPath(url: string): string {
    return url.split(/[?#]/)[0];
}
