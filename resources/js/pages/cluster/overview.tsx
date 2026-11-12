import { DispatchStateChip, OverrideFlag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Page, Section } from '@/components/fuelops/page';
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
import { LoaderCircle, MdBuildCircleOutline, MdChevronRight, MdGroups2, MdInbox, MdPersonAddAlt1 } from '@/components/icons';
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
        <Page title="Cluster Overview" back={{ href: '/dashboard', label: 'Dashboard' }} width="wide">
            {!allowed ? (
                <EmptyState
                    icon={MdGroups2}
                    title="For Cluster Engineers and Cluster Leaders"
                    description="This overview is available to cluster staff only."
                />
            ) : (
                <QueryView query={overview}>
                    {(data) => (
                        <div className="space-y-7">
                            {canDispatch && (
                                <Link
                                    href="/dispatch/queue"
                                    className="bg-primary shadow-card flex items-center gap-3.5 rounded-[18px] p-4 text-white transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:max-w-xl"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-white/18">
                                        <MdInbox className="size-6" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15.5px] font-bold">Assignment Queue</span>
                                        <span className="block text-[12.5px] text-white/75">
                                            {data.outstandingTickets.filter((t) => WAITING_STATES.includes(t.dispatchState ?? '')).length} waiting for
                                            a technician
                                        </span>
                                    </span>
                                    <MdChevronRight className="size-6 shrink-0" />
                                </Link>
                            )}

                            <Section title="Outstanding Tickets by Status">
                                {Object.keys(data.ticketCountsByStatus).length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No outstanding tickets.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(data.ticketCountsByStatus).map(([status, count]) => (
                                            <span
                                                key={status}
                                                className="bg-card shadow-card inline-flex items-center gap-2 rounded-[10px] border py-1.5 pr-1.5 pl-3 text-[13px] font-medium"
                                            >
                                                {status}
                                                <span className="bg-primary/12 text-primary dark:bg-primary/25 min-w-7 rounded-md px-1.5 py-0.5 text-center text-xs font-bold dark:text-[#64B5F6]">
                                                    {count}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section title={`Outstanding Tickets (${data.outstandingTickets.length})`}>
                                {data.outstandingTickets.length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No outstanding tickets in your cluster.</p>
                                ) : (
                                    <ul className="grid items-start gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
                                        {data.outstandingTickets.map((ticket) => (
                                            <li
                                                key={ticket.ticketId}
                                                className="bg-card shadow-card hover:border-primary/40 relative rounded-[14px] border p-3.5 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <Link
                                                        href={`/tickets/${encodeURIComponent(ticket.ticketId)}`}
                                                        className="min-w-0 after:absolute after:inset-0"
                                                    >
                                                        <span className="text-brand-ink block text-[15px] leading-snug font-semibold dark:text-white">
                                                            {ticket.stationName}
                                                        </span>
                                                        <span className="text-muted-foreground mt-0.5 block text-[12.5px]">
                                                            {[
                                                                ticket.issueType,
                                                                ticket.dispatchState ? dispatchStateLabel(ticket.dispatchState) : ticket.rawStatus,
                                                                ticket.assigneeName,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </span>
                                                    </Link>
                                                    <span className="text-muted-foreground shrink-0 pt-0.5 text-[11px]">{ticket.ticketId}</span>
                                                </div>
                                                {(ticket.dispatchState || ticket.isOverrideAssignment || (ticket.canAssign && canReassign)) && (
                                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                                        <DispatchStateChip state={ticket.dispatchState} />
                                                        {ticket.isOverrideAssignment && <OverrideFlag />}
                                                        {ticket.canAssign && canReassign && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="relative z-10 ml-auto"
                                                                disabled={loadingTicketId === ticket.ticketId}
                                                                onClick={() => openAssign(ticket)}
                                                            >
                                                                {loadingTicketId === ticket.ticketId ? (
                                                                    <LoaderCircle className="animate-spin" />
                                                                ) : (
                                                                    <MdPersonAddAlt1 />
                                                                )}
                                                                {ticket.dispatchState === 'NEW' ? 'Assign' : 'Reassign'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title={`Assets Due for Servicing (${data.assetsServicingDue.length})`}>
                                {data.assetsServicingDue.length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No assets currently due for servicing.</p>
                                ) : (
                                    <ul className="grid items-start gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                                        {data.assetsServicingDue.map((asset) => (
                                            <li key={asset.id} className="bg-card shadow-card flex items-center gap-3 rounded-[14px] border p-3.5">
                                                <IconTile icon={MdBuildCircleOutline} color="#FF9800" />
                                                <span className="min-w-0">
                                                    <span className="block text-[14.5px] leading-snug font-semibold">
                                                        {asset.assetClass ?? ''} — {asset.assetName ?? ''}
                                                    </span>
                                                    <span className="text-muted-foreground mt-0.5 block text-[12.5px]">
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
