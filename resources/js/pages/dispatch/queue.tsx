import { AvailabilityBadge, DeclineNotice, DispatchStateChip, PriorityChip } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { Page } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { ageLabel, busyTicketSummary } from '@/lib/format';
import { dispatch } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type TechnicianAvailability, type Ticket } from '@/types/fuelops';
import { Link, usePage } from '@inertiajs/react';
import { Bell, ChartLine, HardHat, Inbox, RefreshCw, ShieldHalf, UserPlus } from 'lucide-react';
import { useState } from 'react';

/** Assigning/reassigning is a Cluster Leader action, plus a Technician with an active leader cover. */
function canReassign(user: User): boolean {
    return user.isClusterLeader || user.canDispatch || user.role === 'Cluster Leader';
}

export default function AssignmentQueue() {
    const { auth } = usePage<SharedData>().props;
    const allowed = canReassign(auth.user);
    const [tab, setTab] = useState<'queue' | 'team'>('queue');
    const [assigning, setAssigning] = useState<Ticket | null>(null);

    const data = useApiQuery(
        async () => {
            const [queue, team] = await Promise.all([dispatch.queue(), dispatch.roster()]);
            return { queue, team };
        },
        [],
        { enabled: allowed },
    );

    const description = data.data
        ? `${data.data.queue.length} waiting · ${data.data.team.filter((t) => t.status === 'available').length} available`
        : 'Assign new, declined & reopened tickets';

    return (
        <Page
            title="Assignment Queue"
            description={description}
            back={{ href: '/dashboard', label: 'Dashboard' }}
            actions={
                allowed && (
                    <>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/notifications">
                                <Bell /> Notifications
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/dispatch/covers">
                                <ShieldHalf /> Leader cover
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/dispatch/report">
                                <ChartLine /> Dispatch report
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={data.reload} disabled={data.isFetching}>
                            <RefreshCw className={cn(data.isFetching && 'animate-spin')} /> Refresh
                        </Button>
                    </>
                )
            }
        >
            {!allowed ? (
                <EmptyState
                    icon={Inbox}
                    title="For Cluster Leaders"
                    description="The assignment queue is available to Cluster Leaders and to anyone covering dispatch for one."
                />
            ) : (
                <>
                    <div className="flex gap-1 border-b" role="tablist">
                        {(['queue', 'team'] as const).map((key) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => setTab(key)}
                                className={cn(
                                    '-mb-px border-b-2 px-4 py-2 text-sm font-semibold',
                                    tab === key ? 'border-primary text-primary' : 'text-muted-foreground border-transparent',
                                )}
                            >
                                {key === 'queue' ? 'Queue' : 'Team'}
                                {data.data && ` (${key === 'queue' ? data.data.queue.length : data.data.team.length})`}
                            </button>
                        ))}
                    </div>

                    <QueryView query={data}>
                        {({ queue, team }) =>
                            tab === 'queue' ? (
                                queue.length === 0 ? (
                                    <EmptyState icon={Inbox} title="Nothing waiting for assignment." />
                                ) : (
                                    <div className="space-y-3">
                                        {queue.map((ticket) => (
                                            <QueueCard
                                                key={ticket.ticketId}
                                                ticket={ticket}
                                                showAssign={ticket.canAssign}
                                                onAssign={() => setAssigning(ticket)}
                                            />
                                        ))}
                                    </div>
                                )
                            ) : team.length === 0 ? (
                                <EmptyState icon={HardHat} title="No technicians found in this cluster." />
                            ) : (
                                <ul className="space-y-2">
                                    {team.map((technician) => (
                                        <TeamRow key={technician.userId} technician={technician} />
                                    ))}
                                </ul>
                            )
                        }
                    </QueryView>
                </>
            )}

            {assigning && (
                <TechnicianPickerDialog
                    ticket={assigning}
                    open={assigning !== null}
                    onOpenChange={(open) => !open && setAssigning(null)}
                    onAssigned={(updated) => {
                        toast.success(`${assigning.ticketId} assigned to ${updated.assignee?.fullName || 'technician'}`);
                        data.reload();
                    }}
                />
            )}
        </Page>
    );
}

function QueueCard({ ticket, showAssign, onAssign }: { ticket: Ticket; showAssign: boolean; onAssign: () => void }) {
    return (
        <div className="bg-card hover:bg-accent/40 relative rounded-xl border p-4 shadow-xs transition-colors">
            <div className="flex items-start justify-between gap-3">
                <Link href={`/tickets/${encodeURIComponent(ticket.ticketId)}`} className="font-semibold after:absolute after:inset-0">
                    {ticket.stationName}
                </Link>
                <span className="text-muted-foreground shrink-0 text-xs">{ticket.ticketId}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
                {ticket.issueType} · raised {ageLabel(ticket.reportedAt)}
            </p>
            {ticket.description && <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">{ticket.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
                <PriorityChip priority={ticket.priority} />
                <DispatchStateChip state={ticket.dispatchState} />
            </div>
            {ticket.lastDecline && (
                <div className="mt-3">
                    <DeclineNotice decline={ticket.lastDecline} />
                </div>
            )}
            {ticket.dispatchState === 'REOPENED' && ticket.rejectionReason && (
                <p className="mt-3 text-sm text-red-800 dark:text-red-300">Station: {ticket.rejectionReason}</p>
            )}
            {showAssign && (
                <div className="relative z-10 mt-3 flex justify-end">
                    <Button size="sm" onClick={onAssign}>
                        <UserPlus /> {ticket.dispatchState === 'NEW' ? 'Assign' : 'Reassign'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function TeamRow({ technician }: { technician: TechnicianAvailability }) {
    const lines = [
        ...(technician.clusterName ? [technician.clusterName] : []),
        ...technician.busyWith.map((busy) => `On ${busyTicketSummary(busy)}${busy.isOverride ? ' · override' : ''}`),
        ...(technician.pendingResponseCount > 0 ? [`${technician.pendingResponseCount} awaiting response`] : []),
        ...(technician.busyWith.length === 0 && technician.pendingResponseCount === 0 ? ['No open tickets'] : []),
    ];
    return (
        <li className="bg-card flex items-start gap-3 rounded-xl border p-3 shadow-xs">
            <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                <HardHat className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{technician.fullName}</span>
                    <AvailabilityBadge status={technician.status} />
                </div>
                {lines.map((line) => (
                    <p key={line} className="text-muted-foreground text-xs">
                        {line}
                    </p>
                ))}
            </div>
        </li>
    );
}
