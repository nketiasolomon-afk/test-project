import { DeclineDialog } from '@/components/dispatch/decline-dialog';
import { DispatchStateChip, OverrideFlag, PriorityChip, TicketTypeTag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/fuelops/states';
import { StatCard } from '@/components/fuelops/stat-card';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDate, isCctvRelated, needsAcceptDecision, timeAgo, type Tone } from '@/lib/format';
import { dispatch, requisitions, tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type CctvRequisition, type Ticket } from '@/types/fuelops';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronRight,
    Clock,
    FolderKanban,
    Gauge,
    Hash,
    HeartPulse,
    LoaderCircle,
    Play,
    RefreshCw,
    Rocket,
    Search,
    SearchX,
    Star,
    TriangleAlert,
    UserPlus,
    UsersRound,
    Video,
    Wrench,
} from '@/components/icons';
import { useMemo, useState } from 'react';

type View = 'mine' | 'cluster' | 'all';
type Category = 'all' | 'operations' | 'cctv';

const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'assigned', label: 'Ready' },
    { key: 'done', label: 'Done' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'rejected', label: 'Rejected' },
];

/** The list's own status vocabulary (shorter than the ticket detail's). */
function listStatus(status: string): { label: string; tone: Tone } {
    switch (status) {
        case 'assigned':
            return { label: 'Ready', tone: 'amber' };
        case 'in_progress':
            return { label: 'In Progress', tone: 'orange' };
        case 'done':
            return { label: 'Done', tone: 'green' };
        case 'confirmed':
            return { label: 'Confirmed', tone: 'blue' };
        case 'rejected':
            return { label: 'Rejected', tone: 'red' };
        default:
            return { label: status, tone: 'slate' };
    }
}

/** Assigning/reassigning is a Cluster Leader action, plus a Technician with an active leader cover. */
function canReassign(user: User): boolean {
    return user.isClusterLeader || user.canDispatch || user.role === 'Cluster Leader';
}

/**
 * Field staff (technicians, engineers, leaders) get "Assigned to me" / "Cluster" / "All Tickets";
 * everyone else (e.g. Station Leaders) sees just the cluster/station list.
 */
function isFieldStaff(user: User): boolean {
    return canReassign(user) || user.role === 'Cluster Technician' || user.role === 'Cluster Engineer';
}

interface Lists {
    cluster: Ticket[];
    mine: Ticket[];
    all: Ticket[];
    requisitions: CctvRequisition[];
    /** Why the dispatch half of "Assigned to me" is missing, if it failed to load. */
    mineError: string | null;
}

async function loadLists(fieldStaff: boolean): Promise<Lists> {
    const assigned = await tickets.assigned();
    let mine: Ticket[] = [];
    let mineError: string | null = null;
    if (fieldStaff) {
        try {
            mine = await dispatch.myAssignments();
        } catch (e) {
            // Only loses the dispatch half of "Assigned to me", so keep the rest and say so.
            mineError = `Couldn't load your dispatch assignments. ${errorText(e)}`;
        }
    }
    const queue = fieldStaff ? await dispatch.queue().catch(() => [] as Ticket[]) : [];
    const myRequisitions = await requisitions.mine().catch(() => [] as CctvRequisition[]);

    const seen = new Set<string>();
    return {
        cluster: assigned,
        // Tickets outside the dispatch flow (Compliance/IT routing) that this user can work on stay under "Assigned to me" too.
        mine: [...mine, ...assigned.filter((t) => !t.isDispatchManaged && needsAcceptDecision(t))],
        all: [...queue, ...assigned, ...mine].filter((t) => !seen.has(t.ticketId) && !!seen.add(t.ticketId)),
        requisitions: myRequisitions,
        mineError,
    };
}

export default function TicketsIndex() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const fieldStaff = isFieldStaff(user);

    const lists = useApiQuery(async () => {
        const result = await loadLists(fieldStaff);
        if (result.mineError) toast.error(result.mineError);
        return result;
    }, [fieldStaff]);

    const [view, setView] = useState<View>(fieldStaff ? 'mine' : 'cluster');
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState<Category>('all');
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<Set<string>>(new Set());
    const [declining, setDeclining] = useState<Ticket | null>(null);
    const [rejecting, setRejecting] = useState<Ticket | null>(null);
    const [reassigning, setReassigning] = useState<Ticket | null>(null);

    const source = lists.data ? lists.data[view] : [];
    const query = search.trim().toLowerCase();
    const matchesCategory = (t: Ticket) => (category === 'cctv' ? isCctvRelated(t) : category === 'operations' ? !isCctvRelated(t) : true);
    const showCctv = category !== 'operations';

    const filtered = useMemo(
        () =>
            source.filter((t) => {
                if (!matchesCategory(t)) return false;
                if (status !== 'all' && t.status !== status) return false;
                if (query === '') return true;
                return [t.stationName, t.issueType, t.clusterName, t.description].some((field) => (field ?? '').toLowerCase().includes(query));
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [source, status, category, query],
    );

    const filteredRequisitions = useMemo(() => {
        if (!showCctv || !lists.data) return [];
        return lists.data.requisitions.filter(
            (r) => query === '' || [r.reqNo, r.jobRef, r.notes, r.technicianName].some((field) => (field ?? '').toLowerCase().includes(query)),
        );
    }, [lists.data, showCctv, query]);

    const resetFilters = () => {
        setSearch('');
        setStatus('all');
        setCategory('all');
    };

    /** Runs a per-ticket action with its card's spinner, then reloads: every dispatch action can move the ticket between lists. */
    const runTicketAction = async (ticket: Ticket, action: () => Promise<void>) => {
        if (processing.has(ticket.ticketId)) return;
        setProcessing((current) => new Set(current).add(ticket.ticketId));
        try {
            await action();
        } catch (e) {
            toast.error(errorText(e));
        } finally {
            setProcessing((current) => {
                const next = new Set(current);
                next.delete(ticket.ticketId);
                return next;
            });
        }
        await lists.reload();
    };

    const accept = (ticket: Ticket) =>
        runTicketAction(ticket, async () => {
            await dispatch.accept(ticket);
            toast.success(
                ticket.isDispatchManaged ? 'Accepted. Tap Start Work when you arrive on site.' : 'Ticket accepted. You can now submit your job card.',
            );
        });

    const start = (ticket: Ticket) =>
        runTicketAction(ticket, async () => {
            await dispatch.start(ticket);
            toast.success('Work started. Submit your job card when you are done.');
        });

    const mineCount = lists.data?.mine.length ?? 0;
    const pendingCount = lists.data?.mine.filter(needsAcceptDecision).length ?? 0;
    const totalSource = source.filter(matchesCategory).length + (showCctv ? (lists.data?.requisitions.length ?? 0) : 0);
    const totalFiltered = filtered.length + filteredRequisitions.length;

    return (
        <Page
            title="My Assignments"
            description={
                lists.isLoading
                    ? undefined
                    : fieldStaff
                      ? `${mineCount} assigned to me${pendingCount > 0 ? ` · ${pendingCount} awaiting your response` : ''}`
                      : `${source.length} total`
            }
            width="wide"
            actions={
                <Button variant="outline" size="sm" onClick={() => lists.reload()} disabled={lists.isFetching}>
                    <RefreshCw className={cn(lists.isFetching && 'animate-spin')} /> Refresh
                </Button>
            }
        >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <StatCard icon={Rocket} label="My Assignment" value={source.length} accent="text-amber-600" onClick={resetFilters} />
                <StatCard icon={FolderKanban} label="My Projects" accent="text-green-600" onClick={() => router.visit(route('projects.index'))} />
                <StatCard icon={Star} label="Special Assignments" accent="text-blue-600" onClick={() => router.visit(route('special-assignments.index'))} />
                <StatCard icon={HeartPulse} label="Compliance" accent="text-purple-700" onClick={() => router.visit(route('compliance.index'))} />
                {user.role === 'Station Leader' && (
                    <StatCard icon={TriangleAlert} label="Report Issue" accent="text-red-600" onClick={() => router.visit(route('tickets.create'))} />
                )}
                {(user.role === 'Cluster Engineer' || user.role === 'Cluster Leader') && (
                    <StatCard icon={UsersRound} label="Cluster Overview" accent="text-teal-700" onClick={() => router.visit(route('cluster.overview'))} />
                )}
                {user.role === 'Operations Admin' && (
                    <StatCard icon={Gauge} label="Operations Overview" accent="text-indigo-700" onClick={() => router.visit(route('operations.overview'))} />
                )}
            </div>

            {fieldStaff && (
                <div className="bg-muted inline-flex w-full rounded-lg p-1 sm:w-auto" role="tablist">
                    {(
                        [
                            ['mine', `Assigned to me (${mineCount})`],
                            ['cluster', 'Cluster'],
                            ['all', 'All Tickets'],
                        ] as [View, string][]
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={view === key}
                            onClick={() => setView(key)}
                            className={cn(
                                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                                view === key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by station, issue, or location..."
                        aria-label="Search tickets"
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {STATUS_FILTERS.map((filter) => (
                        <button
                            key={filter.key}
                            onClick={() => setStatus(filter.key)}
                            className={cn(
                                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                                status === filter.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                    <select
                        aria-label="Filter by category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        className="border-input bg-background h-8 rounded-full border px-3 text-sm"
                    >
                        <option value="all">All categories</option>
                        <option value="operations">Operations</option>
                        <option value="cctv">CCTV</option>
                    </select>
                </div>
            </div>

            {lists.isLoading ? (
                <LoadingState rows={5} />
            ) : lists.data === undefined ? (
                <ErrorState message={lists.error ?? 'Connection Error'} onRetry={lists.reload} />
            ) : totalSource === 0 ? (
                <EmptyState
                    title="No assignments yet"
                    description="Your assignments will appear here"
                    action={
                        <Button variant="outline" size="sm" onClick={() => lists.reload()}>
                            <RefreshCw /> Refresh
                        </Button>
                    }
                />
            ) : totalFiltered === 0 ? (
                <EmptyState
                    icon={SearchX}
                    title="No matching assignments"
                    description={query !== '' ? 'Try a different search term' : 'Try a different filter'}
                    action={
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                            Clear Filters
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    <p className="text-primary text-xs font-semibold">
                        {totalFiltered === totalSource ? `${totalFiltered} assignment${totalFiltered === 1 ? '' : 's'}` : `${totalFiltered} of ${totalSource}`}
                    </p>
                    {filtered.length > 0 && (
                        <section className="space-y-3">
                            {filteredRequisitions.length > 0 && <h2 className="text-muted-foreground text-sm font-semibold">Operations</h2>}
                            <div className="grid gap-3 lg:grid-cols-2">
                                {filtered.map((ticket) => (
                                    <AssignmentCard
                                        key={ticket.ticketId}
                                        ticket={ticket}
                                        isProcessing={processing.has(ticket.ticketId)}
                                        onAccept={() => accept(ticket)}
                                        onReject={() => (ticket.isDispatchManaged ? setDeclining(ticket) : setRejecting(ticket))}
                                        onReassign={canReassign(user) ? () => setReassigning(ticket) : undefined}
                                        onStart={() => start(ticket)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                    {filteredRequisitions.length > 0 && (
                        <section className="space-y-3">
                            {filtered.length > 0 && <h2 className="text-muted-foreground text-sm font-semibold">CCTV Requisitions</h2>}
                            <div className="grid gap-3 lg:grid-cols-2">
                                {filteredRequisitions.map((requisition) => (
                                    <RequisitionCard key={requisition.requisitionId ?? requisition.reqNo} requisition={requisition} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {declining && (
                <DeclineDialog
                    ticket={declining}
                    open
                    onOpenChange={(open) => !open && setDeclining(null)}
                    onDeclined={() => {
                        toast.success('Declined. Your Cluster Leader will reassign it.');
                        lists.reload();
                    }}
                />
            )}
            <ReasonDialog
                open={rejecting !== null}
                onOpenChange={(open) => !open && setRejecting(null)}
                title="Reject Assignment"
                description="Your Cluster Leader will be notified to re-assign this ticket to another technician. Let them know why you can't take it (optional):"
                placeholder="Reason (optional)"
                required={false}
                confirmLabel="Reject"
                destructive
                onConfirm={async (reason) => {
                    if (!rejecting) return;
                    await tickets.reject(rejecting.ticketId, reason || null);
                    toast.success('Ticket rejected. The Cluster Leader has been notified to re-assign it.');
                    lists.reload();
                }}
            />
            {reassigning && (
                <TechnicianPickerDialog
                    ticket={reassigning}
                    open
                    onOpenChange={(open) => !open && setReassigning(null)}
                    onAssigned={(updated) => {
                        toast.success(`Ticket ${reassigning.ticketId} re-assigned to ${updated.assignee?.fullName ?? 'technician'}.`);
                        lists.reload();
                    }}
                />
            )}
        </Page>
    );
}

function AssignmentCard({
    ticket,
    isProcessing,
    onAccept,
    onReject,
    onReassign,
    onStart,
}: {
    ticket: Ticket;
    isProcessing: boolean;
    onAccept: () => void;
    onReject: () => void;
    onReassign?: () => void;
    onStart: () => void;
}) {
    const isCctv = isCctvRelated(ticket);
    const statusInfo = listStatus(ticket.status);

    return (
        <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
            <Link href={route('tickets.show', ticket.ticketId)} className="hover:bg-accent/50 block space-y-2 p-4 transition-colors">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{ticket.stationName || 'Unknown station'}</p>
                        <p className="text-muted-foreground truncate text-xs">{ticket.clusterName}</p>
                    </div>
                    {ticket.isDispatchManaged ? <DispatchStateChip state={ticket.dispatchState} /> : <Pill tone={statusInfo.tone}>{statusInfo.label}</Pill>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <TicketTypeTag type={isCctv ? 'cctv' : 'operations'} />
                    {ticket.isDispatchManaged && (
                        <>
                            <PriorityChip priority={ticket.priority} />
                            {/* Overrides are flagged in the technician's queue. */}
                            {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                            {!ticket.isMine && (
                                <span className="text-muted-foreground text-xs">
                                    {ticket.assignee ? `With ${ticket.assignee.fullName} · view only` : 'View only'}
                                </span>
                            )}
                        </>
                    )}
                </div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                    {isCctv ? <Video className="size-3.5" /> : <Wrench className="size-3.5" />}
                    {ticket.issueType}
                </p>
                {ticket.description && <p className="text-muted-foreground line-clamp-2 text-sm">{ticket.description}</p>}
                <div className="text-muted-foreground flex items-center gap-3 border-t pt-2 text-xs">
                    <span className="flex items-center gap-1">
                        <Hash className="size-3" />
                        {ticket.ticketId}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeAgo(ticket.reportedAt)}
                    </span>
                    <ChevronRight className="ml-auto size-4" />
                </div>
            </Link>
            {(needsAcceptDecision(ticket) || ticket.canStart) && (
                <div className="flex flex-wrap gap-2 border-t p-3">
                    {needsAcceptDecision(ticket) && (
                        <>
                            {onReassign && (
                                <Button size="sm" variant="outline" disabled={isProcessing} onClick={onReassign}>
                                    <UserPlus /> Re-assign
                                </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-destructive" disabled={isProcessing} onClick={onReject}>
                                {ticket.isDispatchManaged ? 'Decline' : 'Reject'}
                            </Button>
                            <Button size="sm" className="flex-1" disabled={isProcessing} onClick={onAccept}>
                                {isProcessing && <LoaderCircle className="animate-spin" />}
                                Accept
                            </Button>
                        </>
                    )}
                    {ticket.canStart && (
                        <Button size="sm" className="w-full bg-orange-600 text-white hover:bg-orange-600/90" disabled={isProcessing} onClick={onStart}>
                            {isProcessing ? <LoaderCircle className="animate-spin" /> : <Play />}
                            Start Work
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function RequisitionCard({ requisition }: { requisition: CctvRequisition }) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{requisition.reqNo}</p>
                <Pill tone={requisitionTone(requisition.status)}>{requisition.status}</Pill>
            </div>
            <TicketTypeTag type="cctv-requisition" />
            <p className="text-muted-foreground text-sm">
                {requisition.items.length} item{requisition.items.length === 1 ? '' : 's'} · {requisition.priority} priority
                {requisition.jobRef ? ` · ${requisition.jobRef}` : ''}
            </p>
            <p className="text-muted-foreground text-xs">{formatDate(requisition.createdAt ?? requisition.dateOfRequest, requisition.dateOfRequest)}</p>
        </>
    );
    const className = 'bg-card block space-y-2 rounded-xl border p-4 shadow-xs';
    return requisition.requisitionId ? (
        <Link href={route('requisitions.show', requisition.requisitionId)} className={cn(className, 'hover:bg-accent/50 transition-colors')}>
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    );
}

function requisitionTone(status: string): Tone {
    const s = status.toLowerCase();
    if (['approved', 'issued', 'completed'].includes(s)) return 'green';
    if (['pending', 'in_review'].includes(s)) return 'orange';
    if (['rejected', 'cancelled'].includes(s)) return 'red';
    return 'blue';
}
