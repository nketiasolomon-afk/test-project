import { DeclineDialog } from '@/components/dispatch/decline-dialog';
import { DispatchStateChip, OverrideFlag, PriorityChip, TicketTypeTag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { ReasonDialog } from '@/components/fuelops/dialogs';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { Pill, TONE_COLORS } from '@/components/fuelops/pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import {
    type IconType,
    LoaderCircle,
    MdAssignmentInd,
    MdAssignmentIndOutline,
    MdAssignmentOutline,
    MdBuild,
    MdCheckCircleOutline,
    MdChevronRight,
    MdClose,
    MdConfirmationNumberOutline,
    MdDashboard,
    MdErrorOutline,
    MdExpandMore,
    MdFilterAltOff,
    MdFlagOutline,
    MdFolderSpecial,
    MdGroups2,
    MdHealthAndSafety,
    MdInventory2Outline,
    MdListAlt,
    MdLocalGasStation,
    MdPersonAddAlt1,
    MdPlayArrow,
    MdRefresh,
    MdReportProblem,
    MdRocketLaunch,
    MdRocketLaunchOutline,
    MdSchedule,
    MdSearch,
    MdSearchOff,
    MdStars,
    MdVerifiedOutline,
    MdVideocam,
    MdVideocamOutline,
    MdVisibility,
    RefreshCw,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { dispatchStateTone, formatDate, isCctvRelated, needsAcceptDecision, timeAgo, type Tone } from '@/lib/format';
import { dispatch, requisitions, tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type CctvRequisition, type Ticket } from '@/types/fuelops';
import { Link, router, usePage } from '@inertiajs/react';
import { forwardRef, useMemo, useState } from 'react';

type View = 'mine' | 'cluster' | 'all';
type Category = 'all' | 'operations' | 'cctv';

const STATUS_FILTERS: { key: string; label: string; icon: IconType }[] = [
    { key: 'all', label: 'All', icon: MdAssignmentOutline },
    { key: 'assigned', label: 'Ready', icon: MdRocketLaunchOutline },
    { key: 'done', label: 'Done', icon: MdCheckCircleOutline },
    { key: 'confirmed', label: 'Confirmed', icon: MdVerifiedOutline },
    { key: 'rejected', label: 'Rejected', icon: MdErrorOutline },
];

const CATEGORY_OPTIONS: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'operations', label: 'Operations' },
    { key: 'cctv', label: 'CCTV' },
];

/** The phone's two-tone blue (primary buttons, station tiles) and the CCTV purple. */
const BLUE_GRADIENT = 'bg-gradient-to-br from-[#1F4788] to-[#2A5DB0]';
const PURPLE_GRADIENT = 'bg-gradient-to-br from-[#6D28D9] to-[#A855F7]';

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

/** The phone's mid-tone accent per ticket status, used for the card's left strip. */
function statusAccent(status: string): string {
    switch (status) {
        case 'assigned':
            return '#FDCD21';
        case 'in_progress':
            return '#FFA726';
        case 'done':
            return '#66BB6A';
        case 'confirmed':
            return '#2196F3';
        case 'rejected':
            return '#E53935';
        default:
            return '#9E9E9E';
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
    const categoryTickets = source.filter(matchesCategory);
    const requisitionCount = lists.data?.requisitions.length ?? 0;
    const totalSource = categoryTickets.length + (showCctv ? requisitionCount : 0);
    const totalFiltered = filtered.length + filteredRequisitions.length;

    const summaryCards: SummaryCardProps[] = [
        { icon: MdRocketLaunch, label: 'My Assignment', value: source.length, color: '#FDCD21', onClick: resetFilters },
        { icon: MdFolderSpecial, label: 'My Projects', color: '#66BB6A', onClick: () => router.visit(route('projects.index')) },
        { icon: MdStars, label: 'Special Assignments', color: '#2196F3', onClick: () => router.visit(route('special-assignments.index')) },
        { icon: MdHealthAndSafety, label: 'Compliance', color: '#8E24AA', onClick: () => router.visit(route('compliance.index')) },
    ];
    if (user.role === 'Station Leader') {
        summaryCards.push({ icon: MdReportProblem, label: 'Report Issue', color: '#E53935', onClick: () => router.visit(route('tickets.create')) });
    }
    if (user.role === 'Cluster Engineer' || user.role === 'Cluster Leader') {
        summaryCards.push({ icon: MdGroups2, label: 'Cluster Overview', color: '#00897B', onClick: () => router.visit(route('cluster.overview')) });
    }
    if (user.role === 'Operations Admin') {
        summaryCards.push({ icon: MdDashboard, label: 'Operations Overview', color: '#3949AB', onClick: () => router.visit(route('operations.overview')) });
    }

    const refreshButton = (className?: string) => (
        <Button variant="secondary" size="sm" className={className} onClick={() => lists.reload()} disabled={lists.isFetching}>
            <RefreshCw className={cn(lists.isFetching && 'animate-spin')} /> Refresh
        </Button>
    );

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
        >
            <div className="space-y-3 sm:space-y-4">
                {/* Summary cards: three across a phone with the rest scrolling, as on the app; one row on desktop. */}
                <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:gap-3 md:overflow-visible md:px-0 md:pb-0">
                    {summaryCards.map((card) => (
                        <SummaryCard key={card.label} {...card} />
                    ))}
                </div>

                {fieldStaff && (
                    <div className="bg-card flex w-full overflow-hidden rounded-full border md:w-fit" role="tablist">
                        {(
                            [
                                ['mine', `Assigned to me (${mineCount})`, MdAssignmentInd],
                                ['cluster', 'Cluster', MdVisibility],
                                ['all', 'All Tickets', MdListAlt],
                            ] as [View, string, IconType][]
                        ).map(([key, label, Icon], index) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={view === key}
                                onClick={() => setView(key)}
                                className={cn(
                                    'flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold transition-colors md:flex-none md:px-5',
                                    index > 0 && 'border-l',
                                    view === key
                                        ? 'bg-primary/12 text-primary dark:bg-primary/25 dark:text-[#8cc4ee]'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                )}
                            >
                                <Icon className="hidden size-[18px] shrink-0 min-[420px]:block" />
                                <span className="truncate">{label}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                    <div className="relative lg:w-[400px] lg:shrink-0">
                        <MdSearch className="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3.5 size-[22px] -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by station, issue, or location..."
                            aria-label="Search tickets"
                            className="bg-card shadow-card placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary dark:border-border h-12 w-full rounded-[14px] border border-transparent pr-12 pl-12 text-[15px] outline-hidden focus-visible:ring-1"
                        />
                        {search !== '' && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="bg-muted hover:bg-accent absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg"
                            >
                                <MdClose className="size-[18px]" />
                            </button>
                        )}
                    </div>

                    {/* Status chips: one scrolling row on a phone; the first chip opens the category menu. */}
                    <div className="-mx-4 flex min-w-0 gap-2.5 overflow-x-auto px-4 py-1 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-1 lg:flex-wrap lg:overflow-visible lg:px-0">
                        {STATUS_FILTERS.filter((filter) => category !== 'cctv' || filter.key === 'all').map((filter) => {
                            const isAll = filter.key === 'all';
                            const selected = status === filter.key;
                            const label = isAll ? (category === 'operations' ? 'Operations' : category === 'cctv' ? 'CCTV' : 'All') : filter.label;
                            const icon = isAll ? (category === 'operations' ? MdBuild : category === 'cctv' ? MdVideocam : MdAssignmentOutline) : filter.icon;
                            const count = isAll
                                ? categoryTickets.length + (category === 'operations' ? 0 : requisitionCount)
                                : categoryTickets.filter((t) => t.status === filter.key).length;

                            if (!isAll) {
                                return (
                                    <FilterChip
                                        key={filter.key}
                                        icon={icon}
                                        label={label}
                                        count={count}
                                        selected={selected}
                                        onClick={() => setStatus(filter.key)}
                                    />
                                );
                            }
                            return (
                                <DropdownMenu key={filter.key}>
                                    <DropdownMenuTrigger asChild>
                                        <FilterChip icon={icon} label={label} count={count} selected={selected} withMenu title="Filter by category" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="min-w-40">
                                        {CATEGORY_OPTIONS.map((option) => (
                                            <DropdownMenuItem
                                                key={option.key}
                                                onSelect={() => {
                                                    setStatus('all');
                                                    setCategory(option.key);
                                                }}
                                                className={cn(category === option.key && 'text-primary font-semibold')}
                                            >
                                                {option.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })}
                    </div>

                    {refreshButton('hidden shrink-0 lg:inline-flex')}
                </div>
            </div>

            <div className="-mx-4 -mt-3 h-px bg-black/[0.06] sm:-mx-5 lg:mx-0 dark:bg-white/[0.06]" />

            {lists.isLoading ? (
                <LoadingState rows={5} />
            ) : lists.data === undefined ? (
                <ErrorState message={lists.error ?? 'Connection Error'} onRetry={lists.reload} />
            ) : totalSource === 0 ? (
                <EmptyState
                    icon={MdAssignmentIndOutline}
                    title="No assignments yet"
                    description="Your assignments will appear here"
                    action={
                        <GradientButton onClick={() => lists.reload()} disabled={lists.isFetching}>
                            <MdRefresh className={cn(lists.isFetching && 'animate-spin')} /> Refresh
                        </GradientButton>
                    }
                />
            ) : totalFiltered === 0 ? (
                <EmptyState
                    icon={MdSearchOff}
                    title="No matching assignments"
                    description={query !== '' ? 'Try a different search term' : 'Try a different filter'}
                    action={
                        <GradientButton onClick={resetFilters}>
                            <MdFilterAltOff /> Clear Filters
                        </GradientButton>
                    }
                />
            ) : (
                <div className="-mt-2 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <span className="bg-primary/8 text-primary dark:bg-primary/20 rounded-md px-2 py-1 text-xs font-semibold dark:text-[#8cc4ee]">
                            {totalFiltered === totalSource ? `${totalFiltered} assignment${totalFiltered === 1 ? '' : 's'}` : `${totalFiltered} of ${totalSource}`}
                        </span>
                        {refreshButton('lg:hidden')}
                    </div>
                    {filtered.length > 0 && (
                        <section className="space-y-3">
                            {filteredRequisitions.length > 0 && <SectionLabel>Operations</SectionLabel>}
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                            {filtered.length > 0 && <SectionLabel>CCTV Requisitions</SectionLabel>}
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

// ==================== Pieces ====================

interface SummaryCardProps {
    icon: IconType;
    label: string;
    value?: number;
    color: string;
    onClick: () => void;
}

/** The phone's compact stat card: icon tile (plus count) over a two-line label. */
function SummaryCard({ icon, label, value, color, onClick }: SummaryCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="bg-card shadow-card hover:border-primary/40 flex w-[calc((100%-16px)/3)] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[14px] border px-2 py-3 text-center transition-colors md:w-auto md:flex-row md:justify-start md:gap-3 md:px-4 md:text-left"
        >
            <span className="flex items-center gap-1.5 md:shrink-0">
                <IconTile icon={icon} color={color} size="sm" />
                {value !== undefined && <span className="text-[17px] leading-none font-bold md:hidden">{value}</span>}
            </span>
            <span className="min-w-0">
                {value !== undefined && <span className="hidden text-[17px] leading-tight font-bold md:block">{value}</span>}
                <span
                    className={cn(
                        'line-clamp-2 text-[11px] leading-[1.15] font-semibold md:text-[12.5px]',
                        value !== undefined && 'md:text-muted-foreground md:text-[11px] md:font-medium',
                    )}
                >
                    {label}
                </span>
            </span>
        </button>
    );
}

type FilterChipProps = {
    icon: IconType;
    label: string;
    count: number;
    selected: boolean;
    withMenu?: boolean;
} & React.ComponentPropsWithoutRef<'button'>;

/** A status chip with its count bubble; the selected one is solid primary. Forwards its ref for the menu trigger. */
const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(({ icon: Icon, label, count, selected, withMenu = false, className, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        aria-pressed={withMenu ? undefined : selected}
        {...props}
        className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border-[1.2px] px-3.5 text-[13px] whitespace-nowrap transition-colors',
            selected
                ? 'bg-primary border-primary font-semibold text-white'
                : 'bg-card text-primary hover:bg-primary/5 border-black/[0.12] font-medium dark:border-white/[0.18] dark:text-neutral-200',
            className,
        )}
    >
        <Icon className="size-4 shrink-0" />
        {label}
        <span
            className={cn(
                'ml-0.5 rounded-lg px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                selected ? 'bg-white/20 text-white' : 'bg-primary/8 text-primary dark:bg-primary/20 dark:text-[#8cc4ee]',
            )}
        >
            {count}
        </span>
        {withMenu && <MdExpandMore className="-mr-1 size-[15px] shrink-0" />}
    </button>
));
FilterChip.displayName = 'FilterChip';

function GradientButton({ className, ...props }: React.ComponentProps<'button'>) {
    return (
        <button
            type="button"
            {...props}
            className={cn(
                BLUE_GRADIENT,
                'inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white shadow-[0_4px_12px_rgb(33_120_189/0.3)] transition-opacity hover:opacity-95 disabled:opacity-60 [&_svg]:size-5',
                className,
            )}
        />
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="text-muted-foreground px-0.5 pt-1 text-xs font-bold tracking-[0.3px]">{children}</h2>;
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
    const accent = ticket.isDispatchManaged ? TONE_COLORS[dispatchStateTone(ticket.dispatchState)] : statusAccent(ticket.status);

    return (
        <div className="bg-card shadow-card flex overflow-hidden rounded-2xl border">
            {/* Status accent strip for at-a-glance scanning. */}
            <span className="w-1 shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col">
                <Link href={route('tickets.show', ticket.ticketId)} className="hover:bg-accent/40 block flex-1 px-3.5 pt-4 pb-3.5 transition-colors">
                    <div className="flex items-start gap-3">
                        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-white', isCctv ? PURPLE_GRADIENT : BLUE_GRADIENT)}>
                            {isCctv ? <MdVideocam className="size-[22px]" /> : <MdLocalGasStation className="size-[22px]" />}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold">{ticket.stationName || 'Unknown station'}</p>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">{ticket.clusterName}</p>
                        </div>
                        {ticket.isDispatchManaged ? <DispatchStateChip state={ticket.dispatchState} /> : <Pill tone={statusInfo.tone}>{statusInfo.label}</Pill>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <TicketTypeTag type={isCctv ? 'cctv' : 'operations'} />
                        {ticket.isDispatchManaged && (
                            <>
                                <PriorityChip priority={ticket.priority} />
                                {/* Overrides are flagged in the technician's queue. */}
                                {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                                {!ticket.isMine && (
                                    <span className="text-muted-foreground text-[11.5px]">
                                        {ticket.assignee ? `With ${ticket.assignee.fullName} · view only` : 'View only'}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#4B5563] dark:text-white/70">
                        {isCctv ? (
                            <MdVideocamOutline className="text-muted-foreground/70 size-3.5 shrink-0" />
                        ) : (
                            <MdBuild className="text-muted-foreground/70 size-3.5 shrink-0" />
                        )}
                        <span className="min-w-0">{ticket.issueType}</span>
                    </p>
                    {ticket.description && <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-[1.3]">{ticket.description}</p>}
                    <div className="text-muted-foreground mt-3 flex items-center gap-3.5 border-t pt-2.5 text-[11.5px] font-medium">
                        <span className="flex min-w-0 items-center gap-1">
                            <MdConfirmationNumberOutline className="size-[13px] shrink-0" />
                            <span className="truncate">{ticket.ticketId}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                            <MdSchedule className="size-[13px]" />
                            {timeAgo(ticket.reportedAt)}
                        </span>
                        <MdChevronRight className="text-muted-foreground/70 ml-auto size-[18px] shrink-0" />
                    </div>
                </Link>
                {(needsAcceptDecision(ticket) || ticket.canStart) && (
                    <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
                        {needsAcceptDecision(ticket) && (
                            <div className="flex gap-2.5">
                                {onReassign && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-10 min-w-0 flex-1 border-[#9FB3D6] px-2 text-[13px] text-[#1F4788] dark:border-[#3a5683] dark:text-[#8cc4ee]"
                                        disabled={isProcessing}
                                        onClick={onReassign}
                                    >
                                        <MdPersonAddAlt1 className="hidden min-[420px]:block" /> Re-assign
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 min-w-0 flex-1 border-red-200 px-2 text-[13px] text-red-700 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:text-red-400"
                                    disabled={isProcessing}
                                    onClick={onReject}
                                >
                                    {ticket.isDispatchManaged ? 'Decline' : 'Reject'}
                                </Button>
                                <Button
                                    size="sm"
                                    className={cn(BLUE_GRADIENT, 'h-10 min-w-0 flex-1 px-2 text-[13px] text-white')}
                                    disabled={isProcessing}
                                    onClick={onAccept}
                                >
                                    {isProcessing && <LoaderCircle className="animate-spin" />}
                                    Accept
                                </Button>
                            </div>
                        )}
                        {ticket.canStart && (
                            <Button
                                size="sm"
                                className="h-10 w-full bg-[#FB8C00] text-[13px] text-white shadow-none hover:bg-[#FB8C00]/90"
                                disabled={isProcessing}
                                onClick={onStart}
                            >
                                {isProcessing ? <LoaderCircle className="animate-spin" /> : <MdPlayArrow />}
                                Start Work
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function RequisitionCard({ requisition }: { requisition: CctvRequisition }) {
    const itemCount = requisition.items.length;
    const statusLabel = requisition.status ? requisition.status.charAt(0).toUpperCase() + requisition.status.slice(1).toLowerCase() : 'Pending';
    const content = (
        <div className="flex items-start gap-3">
            <span className={cn(PURPLE_GRADIENT, 'flex size-11 shrink-0 items-center justify-center rounded-xl text-white')}>
                <MdVideocam className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[14.5px] font-bold">{requisition.reqNo}</p>
                    <Pill tone={requisitionTone(requisition.status)} className="text-[10.5px]">
                        {statusLabel}
                    </Pill>
                </div>
                <div className="mt-1.5">
                    <TicketTypeTag type="cctv-requisition" />
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                        <MdInventory2Outline className="size-[13px]" />
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1">
                        <MdFlagOutline className="size-[13px]" />
                        {requisition.priority}
                    </span>
                    <span className="text-muted-foreground/80 ml-auto text-[11.5px]">
                        {formatDate(requisition.createdAt ?? requisition.dateOfRequest, requisition.dateOfRequest)}
                    </span>
                </div>
                {requisition.jobRef && <p className="text-muted-foreground/80 mt-1.5 text-[11.5px]">Job ref: {requisition.jobRef}</p>}
            </div>
        </div>
    );
    const className = 'bg-card shadow-card block rounded-2xl border p-3.5';
    return requisition.requisitionId ? (
        <Link href={route('requisitions.show', requisition.requisitionId)} className={cn(className, 'hover:bg-accent/40 transition-colors')}>
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
