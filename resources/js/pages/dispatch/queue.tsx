import { AvailabilityBadge, DeclineNotice, DispatchStateChip, PriorityChip } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { Page } from '@/components/fuelops/page';
import { TONE_COLORS } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { ageLabel, availabilityTone, busyTicketSummary } from '@/lib/format';
import { dispatch } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type TechnicianAvailability, type Ticket } from '@/types/fuelops';
import { Link, usePage } from '@inertiajs/react';
import { MdEngineering, MdInbox, MdInsights, MdNotifications, MdPersonAddAlt1, MdShieldMoon, RefreshCw } from '@/components/icons';
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
            width="wide"
            actions={
                allowed && (
                    <>
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/notifications">
                                <MdNotifications /> Notifications
                            </Link>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/dispatch/covers">
                                <MdShieldMoon /> Leader cover
                            </Link>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/dispatch/report">
                                <MdInsights /> Dispatch report
                            </Link>
                        </Button>
                        <Button variant="secondary" size="sm" onClick={data.reload} disabled={data.isFetching}>
                            <RefreshCw className={cn(data.isFetching && 'animate-spin')} /> Refresh
                        </Button>
                    </>
                )
            }
        >
            {!allowed ? (
                <EmptyState
                    icon={MdInbox}
                    title="For Cluster Leaders"
                    description="The assignment queue is available to Cluster Leaders and to anyone covering dispatch for one."
                />
            ) : (
                <div className="space-y-4">
                    {/* The phone's TabBar: two tabs with a blue underline indicator. */}
                    <div className="bg-card shadow-card flex overflow-hidden rounded-[14px] border" role="tablist">
                        {(['queue', 'team'] as const).map((key) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => setTab(key)}
                                className={cn(
                                    'relative flex-1 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-8',
                                    tab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {key === 'queue' ? 'Queue' : 'Team'}
                                {data.data && ` (${key === 'queue' ? data.data.queue.length : data.data.team.length})`}
                                <span
                                    className={cn('absolute inset-x-3 bottom-0 h-[3px] rounded-t-full', tab === key ? 'bg-primary' : 'bg-transparent')}
                                    aria-hidden="true"
                                />
                            </button>
                        ))}
                    </div>

                    <QueryView query={data}>
                        {({ queue, team }) =>
                            tab === 'queue' ? (
                                queue.length === 0 ? (
                                    <EmptyState icon={MdInbox} title="Nothing waiting for assignment." />
                                ) : (
                                    <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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
                                <EmptyState icon={MdEngineering} title="No technicians found in this cluster." />
                            ) : (
                                <ul className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                    {team.map((technician) => (
                                        <TeamRow key={technician.userId} technician={technician} />
                                    ))}
                                </ul>
                            )
                        }
                    </QueryView>
                </div>
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

/** The phone's _QueueCard: station, ticket id, issue and age, chips, decline notice and Assign. */
function QueueCard({ ticket, showAssign, onAssign }: { ticket: Ticket; showAssign: boolean; onAssign: () => void }) {
    return (
        <div className="bg-card shadow-card hover:border-primary/40 relative rounded-[14px] border p-3.5 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <Link
                    href={`/tickets/${encodeURIComponent(ticket.ticketId)}`}
                    className="text-brand-ink text-[15px] leading-snug font-semibold after:absolute after:inset-0 dark:text-white"
                >
                    {ticket.stationName}
                </Link>
                <span className="text-muted-foreground shrink-0 pt-0.5 text-[11.5px]">{ticket.ticketId}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-[12.5px]">
                {ticket.issueType} · raised {ageLabel(ticket.reportedAt)}
            </p>
            {ticket.description && <p className="text-foreground/75 mt-1.5 line-clamp-2 text-[12.5px]">{ticket.description}</p>}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
                <PriorityChip priority={ticket.priority} />
                <DispatchStateChip state={ticket.dispatchState} />
            </div>
            {ticket.lastDecline && (
                <div className="mt-2.5">
                    <DeclineNotice decline={ticket.lastDecline} />
                </div>
            )}
            {ticket.dispatchState === 'REOPENED' && ticket.rejectionReason && (
                <p className="mt-2.5 text-[12.5px] text-red-800 dark:text-red-300">Station: {ticket.rejectionReason}</p>
            )}
            {showAssign && (
                <div className="relative z-10 mt-2.5 flex justify-end">
                    <Button size="sm" onClick={onAssign}>
                        <MdPersonAddAlt1 /> {ticket.dispatchState === 'NEW' ? 'Assign' : 'Reassign'}
                    </Button>
                </div>
            )}
        </div>
    );
}

/** The phone's Team tab row: a status-tinted round avatar, name, availability and what they hold. */
function TeamRow({ technician }: { technician: TechnicianAvailability }) {
    const lines = [
        ...(technician.clusterName ? [technician.clusterName] : []),
        ...technician.busyWith.map((busy) => `On ${busyTicketSummary(busy)}${busy.isOverride ? ' · override' : ''}`),
        ...(technician.pendingResponseCount > 0 ? [`${technician.pendingResponseCount} awaiting response`] : []),
        ...(technician.busyWith.length === 0 && technician.pendingResponseCount === 0 ? ['No open tickets'] : []),
    ];
    const color = TONE_COLORS[availabilityTone(technician.status)];
    return (
        <li className="bg-card shadow-card flex items-start gap-3 rounded-[14px] border p-3.5">
            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ color }}>
                <span className="absolute inset-0 bg-current/15 dark:bg-current/25" aria-hidden="true" />
                <MdEngineering className="relative size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold">{technician.fullName}</span>
                    <AvailabilityBadge status={technician.status} />
                </div>
                <div className="mt-0.5">
                    {lines.map((line) => (
                        <p key={line} className="text-muted-foreground text-xs leading-relaxed">
                            {line}
                        </p>
                    ))}
                </div>
            </div>
        </li>
    );
}
