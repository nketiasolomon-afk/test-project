import { DispatchStateChip, OverrideFlag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { dispatchStateLabel } from '@/lib/format';
import { dashboards, tickets } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type Ticket, type TicketSummary } from '@/types/fuelops';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight, Inbox, UserPlus, UsersRound, Wrench } from '@/components/icons';
import { useState } from 'react';

const WAITING_STATES = ['NEW', 'DECLINED', 'REOPENED'];

export default function ClusterOverviewPage() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const allowed = user.role === 'Cluster Engineer' || user.role === 'Cluster Leader';
    const canDispatch = user.isClusterLeader || user.canDispatch;
    const canReassign = user.isClusterLeader || user.canDispatch || user.role === 'Cluster Leader';

    const overview = useApiQuery(() => dashboards.cluster(), [], { enabled: allowed });
    const [assigning, setAssigning] = useState<Ticket | null>(null);
    const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);

    const openAssign = async (summary: TicketSummary) => {
        setLoadingTicketId(summary.ticketId);
        try {
            // The overview only carries a summary; the picker needs the full ticket.
            setAssigning(await tickets.get(summary.ticketId));
        } catch (e) {
            toast.error(errorText(e));
        } finally {
            setLoadingTicketId(null);
        }
    };

    return (
        <Page title="Cluster Overview" back={{ href: '/dashboard', label: 'Dashboard' }}>
            {!allowed ? (
                <EmptyState
                    icon={UsersRound}
                    title="For Cluster Engineers and Cluster Leaders"
                    description="This overview is available to cluster staff only."
                />
            ) : (
                <QueryView query={overview}>
                    {(data) => (
                        <div className="space-y-6">
                            {canDispatch && (
                                <Link
                                    href="/dispatch/queue"
                                    className="flex items-center gap-3 rounded-xl bg-[#2178bd] p-4 text-white shadow-md hover:opacity-95"
                                >
                                    <Inbox className="size-6" />
                                    <span className="flex-1">
                                        <span className="block font-semibold">Assignment Queue</span>
                                        <span className="block text-sm text-white/70">
                                            {data.outstandingTickets.filter((t) => WAITING_STATES.includes(t.dispatchState ?? '')).length} waiting for
                                            a technician
                                        </span>
                                    </span>
                                    <ChevronRight />
                                </Link>
                            )}

                            <Section title="Outstanding Tickets by Status">
                                {Object.keys(data.ticketCountsByStatus).length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No outstanding tickets.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(data.ticketCountsByStatus).map(([status, count]) => (
                                            <Pill key={status} tone="blue" className="px-3 py-1 text-sm">
                                                {status}: {count}
                                            </Pill>
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section title={`Outstanding Tickets (${data.outstandingTickets.length})`}>
                                {data.outstandingTickets.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No outstanding tickets in your cluster.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {data.outstandingTickets.map((ticket) => (
                                            <li key={ticket.ticketId} className="bg-card rounded-xl border p-3 shadow-xs">
                                                <div className="flex items-start justify-between gap-3">
                                                    <Link
                                                        href={`/tickets/${encodeURIComponent(ticket.ticketId)}`}
                                                        className="min-w-0 hover:underline"
                                                    >
                                                        <span className="block font-medium">{ticket.stationName}</span>
                                                        <span className="text-muted-foreground block text-sm">
                                                            {[
                                                                ticket.issueType,
                                                                ticket.dispatchState ? dispatchStateLabel(ticket.dispatchState) : ticket.rawStatus,
                                                                ticket.assigneeName,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </span>
                                                    </Link>
                                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                                        {ticket.isOverrideAssignment && <OverrideFlag />}
                                                        <DispatchStateChip state={ticket.dispatchState} />
                                                        <span className="text-muted-foreground text-xs">{ticket.ticketId}</span>
                                                    </div>
                                                </div>
                                                {ticket.canAssign && canReassign && (
                                                    <div className="mt-2 flex justify-end">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={loadingTicketId === ticket.ticketId}
                                                            onClick={() => openAssign(ticket)}
                                                        >
                                                            <UserPlus /> {ticket.dispatchState === 'NEW' ? 'Assign' : 'Reassign'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title={`Assets Due for Servicing (${data.assetsServicingDue.length})`}>
                                {data.assetsServicingDue.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No assets currently due for servicing.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {data.assetsServicingDue.map((asset) => (
                                            <li key={asset.id} className="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
                                                <Wrench className="size-5 shrink-0 text-orange-600" />
                                                <span>
                                                    <span className="block font-medium">
                                                        {asset.assetClass ?? ''} — {asset.assetName ?? ''}
                                                    </span>
                                                    <span className="text-muted-foreground block text-sm">
                                                        {asset.stationName ?? ''} ·{' '}
                                                        {asset.hoursSinceLastService != null ? Math.round(asset.hoursSinceLastService) : '?'} hrs
                                                        since last service
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        </div>
                    )}
                </QueryView>
            )}

            {assigning && (
                <TechnicianPickerDialog
                    ticket={assigning}
                    open={assigning !== null}
                    onOpenChange={(open) => !open && setAssigning(null)}
                    onAssigned={(updated) => {
                        toast.success(`Ticket ${assigning.ticketId} assigned to ${updated.assignee?.fullName || 'technician'}`);
                        overview.reload();
                    }}
                />
            )}
        </Page>
    );
}
