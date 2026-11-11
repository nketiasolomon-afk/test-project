import { IconTile } from '@/components/fuelops/icon-tile';
import { ModuleTile } from '@/components/fuelops/module-tile';
import { Page, Section } from '@/components/fuelops/page';
import { EmptyState } from '@/components/fuelops/states';
import {
    Assignment,
    BadgeCheck,
    CheckCircle2,
    CirclePlusFilled,
    CircleX,
    Engineering,
    Gauge,
    Hourglass,
    Inbox,
    Info,
    Lock,
    OilBarrel,
    Package,
    PendingActions,
    Repeat,
    ShieldAlert,
    TriangleAlert,
    Fuel,
    type IconType,
} from '@/components/icons';
import { NotificationBell } from '@/components/notification-bell';
import { useApiQuery } from '@/hooks/use-api-query';
import { DISPATCH_HELD_STATES, timeAgo } from '@/lib/format';
import { dashboards } from '@/lib/fuelops-api';
import { moduleGroupsFor } from '@/lib/navigation';
import { type SharedData, type User } from '@/types';
import { usePage } from '@inertiajs/react';

const WAITING_STATES = ['NEW', 'DECLINED', 'REOPENED'];

/** Icon and accent for a recent-activity entry, as the phone app colours them. */
function activityVisual(type: string): [IconType, string] {
    switch (type) {
        case 'reported':
            return [CirclePlusFilled, '#0F766E'];
        case 'started':
        case 'progress':
            return [PendingActions, '#2178BD'];
        case 'resolved':
            return [CheckCircle2, '#059669'];
        case 'station-approved':
        case 'validated':
        case 'part-approved':
        case 'part-issued':
            return [BadgeCheck, '#059669'];
        case 'station-rejected':
            return [CircleX, '#DC2626'];
        case 'escalated':
            return [ShieldAlert, '#DC2626'];
        case 'force-closed':
            return [Lock, '#6D28D9'];
        case 'reassigned':
            return [Repeat, '#2178BD'];
        case 'part-requested':
            return [Package, '#B45309'];
        default:
            return [Info, '#757575'];
    }
}

type StatsAudience = 'technician' | 'cluster' | 'operations';

function statsAudience(user: User): StatsAudience {
    if (user.role === 'Operations Admin') return 'operations';
    if (user.isClusterLeader || user.role === 'Cluster Leader' || user.role === 'Cluster Engineer') return 'cluster';
    return 'technician';
}

function roleLabel(user: User): string {
    if (user.isClusterLeader) return 'Cluster Leader';
    return user.role || 'Technician';
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const audience = statsAudience(user);

    const overview = useApiQuery(() => dashboards.home());
    const cluster = useApiQuery(() => dashboards.cluster(), [], { enabled: audience === 'cluster' });
    const operations = useApiQuery(() => dashboards.operations(), [], { enabled: audience === 'operations' });

    const stats: { label: string; value?: number; icon: IconType; loading: boolean }[] =
        audience === 'cluster'
            ? [
                  {
                      label: 'Unassigned',
                      value: cluster.data?.outstandingTickets.filter((t) => WAITING_STATES.includes(t.dispatchState ?? '')).length,
                      icon: Inbox,
                      loading: cluster.isLoading,
                  },
                  {
                      label: 'In Progress',
                      value: cluster.data?.outstandingTickets.filter((t) => DISPATCH_HELD_STATES.includes(t.dispatchState ?? '')).length,
                      icon: Engineering,
                      loading: cluster.isLoading,
                  },
                  { label: 'Outstanding', value: cluster.data?.outstandingTickets.length, icon: Hourglass, loading: cluster.isLoading },
              ]
            : audience === 'operations'
              ? [
                    { label: 'Outstanding', value: operations.data?.totalOutstanding, icon: Gauge, loading: operations.isLoading },
                    { label: 'Escalated', value: operations.data?.escalatedTickets, icon: TriangleAlert, loading: operations.isLoading },
                    { label: 'Nozzles Down', value: operations.data?.nozzlesNotWorking, icon: Fuel, loading: operations.isLoading },
                ]
              : [
                    { label: 'Active', value: overview.data?.activeIssues, icon: Assignment, loading: overview.isLoading },
                    { label: 'Pending', value: overview.data?.pendingIssues, icon: PendingActions, loading: overview.isLoading },
                    { label: 'Done', value: overview.data?.completedIssues, icon: CheckCircle2, loading: overview.isLoading },
                ];

    // Quick Access mirrors the phone's Home: the modules without a bottom tab, grouped like the side menu.
    const tabUrls = ['/dashboard', '/location', '/profile', '/notifications'];
    const groups = moduleGroupsFor(user)
        .map((group) => ({ ...group, items: group.items.filter((item) => !tabUrls.includes(item.url)) }))
        .filter((group) => group.items.length > 0);
    const clusterGroup = groups.find((group) => group.title === 'Cluster');
    const quickAccess = groups.filter((group) => group !== clusterGroup).flatMap((group) => group.items);

    const subtitle = audience === 'cluster' ? 'Cluster Leader Dashboard' : audience === 'operations' ? 'Operations Dashboard' : 'Technician Dashboard';

    return (
        <Page title="Star Technician" description={subtitle} brand hideBell documentTitle="Home">
            {/* Welcome card */}
            <div className="relative overflow-hidden rounded-3xl bg-[var(--brand-blue)] p-6 text-white shadow-[0_10px_24px_rgb(33_120_189/0.3)]">
                <div
                    className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgb(255 255 255 / 0.08), transparent 70%)' }}
                    aria-hidden="true"
                />
                <div className="relative flex items-center gap-3.5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-[15px] border border-white/22 bg-white/14">
                        <OilBarrel className="text-brand-yellow size-[25px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/70">Welcome back!</p>
                        <p className="truncate text-lg leading-tight font-bold tracking-[-0.2px]">{user.fullName || user.username}</p>
                        <p className="truncate text-xs text-white/70">{roleLabel(user)}</p>
                    </div>
                    <NotificationBell shape="tile" />
                </div>
                <div className="relative mt-5 mb-[18px] h-px bg-white/12" />
                <div className="relative grid grid-cols-3 text-center">
                    {stats.map((stat) => (
                        <div key={stat.label} className="flex flex-col items-center">
                            <span className="flex size-10 items-center justify-center rounded-xl border border-white/16 bg-white/12">
                                <stat.icon className="size-5" />
                            </span>
                            <span className="mt-2 text-xl leading-tight font-bold">{stat.loading ? '-' : (stat.value ?? 0)}</span>
                            <span className="mt-0.5 text-xs text-white/70">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Section title="Quick Access">
                <div className="grid gap-3 lg:grid-cols-2">
                    {quickAccess.map((module) => (
                        <ModuleTile key={module.url} title={module.title} subtitle={module.subtitle} href={module.url} icon={module.icon} accent={module.accent} />
                    ))}
                </div>
            </Section>

            {clusterGroup && (
                <Section title="Cluster">
                    <div className="grid gap-3 lg:grid-cols-2">
                        {clusterGroup.items.map((module) => (
                            <ModuleTile key={module.url} title={module.title} subtitle={module.subtitle} href={module.url} icon={module.icon} accent={module.accent} />
                        ))}
                    </div>
                </Section>
            )}

            <Section title="Recent Activity">
                {overview.isLoading ? (
                    <div className="space-y-2.5">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="bg-card relative h-[70px] overflow-hidden rounded-[14px] border">
                                <span className="animate-shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/6" />
                            </div>
                        ))}
                    </div>
                ) : (overview.data?.recentActivity ?? []).length === 0 ? (
                    <EmptyState title="No recent activity yet" description={overview.error ?? 'Your latest ticket updates will show here.'} className="py-6" />
                ) : (
                    <ul className="space-y-2.5">
                        {overview.data!.recentActivity.slice(0, 6).map((activity, index) => {
                            const [Icon, color] = activityVisual(activity.type);
                            return (
                                <li key={index} className="bg-card shadow-card flex overflow-hidden rounded-[14px] border">
                                    <span className="w-[3px] shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                                    <span className="flex min-w-0 flex-1 items-center gap-3.5 p-3.5">
                                        <IconTile icon={Icon} color={color} className="size-[42px] [&>svg]:size-[22px]" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{activity.title}</span>
                                            <span className="text-muted-foreground block truncate text-xs">{activity.subtitle}</span>
                                        </span>
                                        <span className="text-muted-foreground/80 shrink-0 text-[11px]">{timeAgo(activity.occurredAt)}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>
        </Page>
    );
}
