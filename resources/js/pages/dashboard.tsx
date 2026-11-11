import { Page, Section } from '@/components/fuelops/page';
import { EmptyState } from '@/components/fuelops/states';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/use-api-query';
import { timeAgo } from '@/lib/format';
import { dashboards } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    ClipboardList,
    Inbox,
    Info,
    Lock,
    type LucideIcon,
    Package,
    PackagePlus,
    CirclePlus,
    Hourglass,
    Repeat,
    ShieldAlert,
    Store,
    Ticket,
    Video,
    Warehouse,
    BadgeCheck,
} from 'lucide-react';

interface Module {
    title: string;
    subtitle: string;
    href: string;
    icon: LucideIcon;
    accent: string;
}

function activityVisual(type: string): [LucideIcon, string] {
    switch (type) {
        case 'reported':
            return [CirclePlus, 'text-teal-700'];
        case 'started':
        case 'progress':
            return [Hourglass, 'text-primary'];
        case 'resolved':
            return [CircleCheck, 'text-emerald-600'];
        case 'station-approved':
        case 'validated':
        case 'part-approved':
        case 'part-issued':
            return [BadgeCheck, 'text-emerald-600'];
        case 'station-rejected':
            return [CircleX, 'text-red-600'];
        case 'escalated':
            return [ShieldAlert, 'text-red-600'];
        case 'force-closed':
            return [Lock, 'text-violet-700'];
        case 'reassigned':
            return [Repeat, 'text-primary'];
        case 'part-requested':
            return [Package, 'text-amber-700'];
        default:
            return [Info, 'text-muted-foreground'];
    }
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const overview = useApiQuery(() => dashboards.home());

    const modules: Module[] = [
        { title: 'Tickets', subtitle: 'View & manage your tickets', href: '/tickets', icon: Ticket, accent: 'text-primary' },
        { title: 'CCTV Requisition', subtitle: 'Request CCTV and network equipment for a job', href: '/requisitions', icon: Video, accent: 'text-rose-700' },
        { title: 'Inventory Request', subtitle: 'Request general stock from the warehouse', href: '/inventory/requests', icon: PackagePlus, accent: 'text-amber-700' },
        { title: 'Inventory', subtitle: 'Stock on hand & usage by technician', href: '/inventory', icon: Warehouse, accent: 'text-teal-700' },
        { title: 'My Reports', subtitle: 'Your activity, job cards & usage', href: '/reports', icon: BarChart3, accent: 'text-violet-700' },
    ];
    // Cluster-level modules are absent for a Technician, not merely disabled. Someone covering
    // for a leader (canDispatch) gets only the queue.
    if (!user.isClusterLeader && user.canDispatch) {
        modules.push({ title: 'Assignment Queue', subtitle: "You're covering dispatch for a Cluster Leader", href: '/dispatch/queue', icon: Inbox, accent: 'text-lime-700' });
    }
    if (user.isClusterLeader) {
        modules.push(
            { title: 'Assignment Queue', subtitle: 'Assign new, declined & reopened tickets', href: '/dispatch/queue', icon: Inbox, accent: 'text-lime-700' },
            { title: 'Team Requests', subtitle: "Approve & issue your cluster's stock requests", href: '/cluster/team-requests', icon: ClipboardCheck, accent: 'text-emerald-600' },
            { title: 'Mini Store', subtitle: 'Cluster stock & restock requests', href: '/cluster/mini-store', icon: Store, accent: 'text-orange-700' },
            { title: 'Cluster Job Cards', subtitle: 'Work submitted across your team', href: '/cluster/job-cards', icon: ClipboardList, accent: 'text-sky-700' },
        );
    }

    const stats: [string, number | undefined][] = [
        ['Active', overview.data?.activeIssues],
        ['Pending', overview.data?.pendingIssues],
        ['Done', overview.data?.completedIssues],
    ];

    return (
        <Page title="Star Technician" description={user.isClusterLeader ? 'Cluster Leader Dashboard' : 'Technician Dashboard'}>
            <div className="relative overflow-hidden rounded-2xl bg-[#2178bd] p-6 text-white shadow-lg">
                <div className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-white/10 blur-2xl" />
                <p className="text-sm text-white/70">Welcome back!</p>
                <p className="text-lg font-bold">{user.fullName || user.username}</p>
                <p className="text-sm text-white/80">{user.isClusterLeader ? 'Cluster Leader' : 'Technician'}</p>
                <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/15 pt-4 text-center">
                    {stats.map(([label, value]) => (
                        <div key={label}>
                            <p className="text-2xl font-bold">{overview.isLoading ? '-' : (value ?? 0)}</p>
                            <p className="text-xs text-white/70">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <Section title="Quick Access">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {modules.map((module) => (
                        <Link
                            key={module.title}
                            href={module.href}
                            prefetch
                            className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-4 shadow-xs transition-colors"
                        >
                            <span className={cn('bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg', module.accent)}>
                                <module.icon className="size-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block font-semibold">{module.title}</span>
                                <span className="text-muted-foreground block text-xs">{module.subtitle}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            </Section>

            <Section title="Recent Activity">
                {overview.isLoading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-16 rounded-xl" />
                        ))}
                    </div>
                ) : (overview.data?.recentActivity ?? []).length === 0 ? (
                    <EmptyState title="No recent activity yet." description={overview.error ?? undefined} />
                ) : (
                    <ul className="space-y-2">
                        {overview.data!.recentActivity.slice(0, 6).map((activity, index) => {
                            const [Icon, color] = activityVisual(activity.type);
                            return (
                                <li key={index} className="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
                                    <span className={cn('bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg', color)}>
                                        <Icon className="size-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold">{activity.title}</span>
                                        <span className="text-muted-foreground block truncate text-xs">{activity.subtitle}</span>
                                    </span>
                                    <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(activity.occurredAt)}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>
        </Page>
    );
}
