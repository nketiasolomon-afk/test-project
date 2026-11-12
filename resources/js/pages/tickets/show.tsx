import { AssignmentHistory } from '@/components/dispatch/assignment-history';
import { DeclineDialog } from '@/components/dispatch/decline-dialog';
import { OverrideFlag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { TicketAssignmentPanel } from '@/components/dispatch/ticket-assignment-panel';
import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { PhotoPicker } from '@/components/fuelops/photo-picker';
import { TONE_COLORS } from '@/components/fuelops/pill';
import { ErrorState, LoadingState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import {
    type IconType,
    LoaderCircle,
    MdAdd,
    MdArrowDropDown,
    MdAssignmentTurnedIn,
    MdBuild,
    MdBuildOutline,
    MdCampaign,
    MdCancelOutline,
    MdCheckCircle,
    MdClose,
    MdConfirmationNumberOutline,
    MdDescription,
    MdEdit,
    MdEditNote,
    MdErrorOutline,
    MdFormatQuote,
    MdGroup,
    MdHourglassBottom,
    MdImageOutline,
    MdInventory2Outline,
    MdLocalGasStation,
    MdPeopleAlt,
    MdPerson,
    MdPersonAddAlt1,
    MdPersonPinCircle,
    MdPictureAsPdf,
    MdPlayArrow,
    MdReplay,
    MdSave,
    MdSend,
    MdVerified,
    MdVisibility,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, errorText } from '@/lib/api';
import {
    formatDateTime,
    formatQuantity,
    isReadOnlyForMe,
    jobCardUnlocked,
    needsAcceptDecision,
    ticketStatusLabel,
    ticketStatusTone,
    TRANSPORT_MODES,
} from '@/lib/format';
import { dispatch, jobCards, myStock, stockLineKey, tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type CrewOptions, type JobCard, type JobCardStock, type JobItemInput, type MiniStoreItem, type Ticket } from '@/types/fuelops';
import { router, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

const NO_CREW: CrewOptions = { technicians: [], transportModes: [] };

/** The phone's two-tone blue used on primary actions and the station tile. */
const BLUE_GRADIENT = 'bg-gradient-to-br from-[#1F4788] to-[#2A5DB0]';

function canReassign(user: User): boolean {
    return user.isClusterLeader || user.canDispatch || user.role === 'Cluster Leader';
}

/** The ERP validates ids as integers where they are numeric. */
function idValue(id: string): string | number {
    return /^\d+$/.test(id) ? Number(id) : id;
}

/** Sums quantities per stock line, so the same stock isn't promised twice. */
function quantitiesByStockLine(lines: { source?: string | null; miniStoreItemId?: string | null; productId?: string | null; quantity: number }[]) {
    const totals: Record<string, number> = {};
    for (const line of lines) {
        const key = stockLineKey(line.source, line.miniStoreItemId, line.productId);
        if (key) totals[key] = (totals[key] ?? 0) + line.quantity;
    }
    return totals;
}

/** The job card screen's "glass card": white, radius 16, faint blue border and a soft shadow. */
function Card({ title, actions, className, children }: { title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
    return (
        <section className={cn('bg-card shadow-card space-y-3 rounded-2xl border border-[#1F4788]/[0.08] p-4 sm:p-5 dark:border-white/[0.06]', className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {title && (
                        <h2 className="flex min-w-0 items-center gap-2.5 text-base font-bold tracking-[-0.2px]">
                            <span className={cn(BLUE_GRADIENT, 'h-[18px] w-[3px] shrink-0 rounded-sm')} aria-hidden="true" />
                            <span className="truncate">{title}</span>
                        </h2>
                    )}
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/** Icon tile, fixed-width grey label and a bold value, with an indented divider between rows. */
function DetailRow({ icon: Icon, label, value }: { icon: IconType; label: string; value: React.ReactNode }) {
    return (
        <div className="relative flex items-start gap-3 py-2.5 after:absolute after:right-0 after:bottom-0 after:left-9 after:border-b last:after:hidden">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#1F4788]/[0.06] text-[#1F4788] dark:bg-white/[0.08] dark:text-[#8cc4ee]">
                <Icon className="size-[15px]" />
            </span>
            <dt className="text-muted-foreground w-20 shrink-0 pt-1 text-xs font-medium sm:w-24">{label}</dt>
            <dd className="min-w-0 flex-1 pt-0.5 text-[13px] font-semibold break-words">{value}</dd>
        </div>
    );
}

/** A tinted notice block (accept / start / rejection), as on the phone. */
function Banner({
    icon: Icon,
    tone,
    title,
    children,
}: {
    icon?: IconType;
    tone: 'blue' | 'orange' | 'red';
    title: React.ReactNode;
    children: React.ReactNode;
}) {
    const styles = {
        blue: { box: 'border-[#1F4788]/20 bg-[#1F4788]/[0.06] dark:border-[#5b8bd6]/30 dark:bg-[#5b8bd6]/10', title: 'text-[#1F4788] dark:text-[#8cc4ee]' },
        orange: { box: 'border-[#FB8C00]/30 bg-[#FB8C00]/[0.08]', title: 'text-[#E65100] dark:text-[#FFB74D]' },
        red: { box: 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30', title: 'text-red-700 dark:text-red-300' },
    }[tone];
    return (
        <div className={cn('flex gap-3 rounded-[14px] border p-4', styles.box)}>
            {Icon && <Icon className={cn('size-[22px] shrink-0', styles.title)} />}
            <div className="min-w-0 flex-1 space-y-1">
                <div className={cn('text-[13px] font-bold', styles.title)}>{title}</div>
                {children}
            </div>
        </div>
    );
}

/** The phone's full-width gradient call to action. */
function GradientButton({ className, ...props }: React.ComponentProps<'button'>) {
    return (
        <button
            {...props}
            className={cn(
                BLUE_GRADIENT,
                'inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-base font-semibold tracking-[0.3px] text-white shadow-[0_6px_16px_rgb(31_71_136/0.3)] transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:size-5 [&_svg]:shrink-0',
                className,
            )}
        />
    );
}

/** A native select dressed as the phone's filled dropdown. */
function SelectField({ className, children, ...props }: React.ComponentProps<'select'>) {
    return (
        <div className={cn('relative', className)}>
            <select
                {...props}
                className="border-border bg-input focus-visible:border-primary focus-visible:ring-primary h-12 w-full appearance-none rounded-xl border pr-10 pl-3.5 text-base outline-hidden focus-visible:ring-1 md:text-sm"
            >
                {children}
            </select>
            <MdArrowDropDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-6 -translate-y-1/2" />
        </div>
    );
}

/** The dashed-free soft box shown in a section with nothing in it yet. */
function EmptyBox({ icon: Icon, title, hint }: { icon: IconType; title: string; hint: string }) {
    return (
        <div className="bg-input flex flex-col items-center rounded-xl border px-4 py-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#1F4788]/[0.06] text-[#1F4788]/30 dark:bg-white/[0.06] dark:text-white/30">
                <Icon className="size-7" />
            </span>
            <p className="text-muted-foreground mt-3.5 text-sm font-semibold">{title}</p>
            <p className="text-muted-foreground/80 mt-1 text-xs">{hint}</p>
        </div>
    );
}

/** A material line: tinted icon tile, name, quantity chip and part number. */
function ItemTile({ icon: Icon, name, quantity, partNumber, trailing }: { icon: IconType; name: string; quantity: string; partNumber?: string | null; trailing?: React.ReactNode }) {
    return (
        <li className="bg-card flex items-center gap-3 rounded-xl border p-3.5 shadow-[0_2px_4px_rgb(0_0_0/0.02)]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1F4788]/[0.06] text-[#1F4788] dark:bg-white/[0.08] dark:text-[#8cc4ee]">
                <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#1F4788]/[0.06] px-1.5 py-0.5 text-xs font-medium text-[#1F4788] dark:bg-white/[0.08] dark:text-[#8cc4ee]">
                        {quantity}
                    </span>
                    {partNumber && <span className="text-muted-foreground text-[11px]">P/N: {partNumber}</span>}
                </span>
            </span>
            {trailing}
        </li>
    );
}

export default function TicketShow({ ticketId }: { ticketId: string }) {
    const { auth } = usePage<SharedData>().props;
    const ticketQuery = useApiQuery(() => tickets.get(ticketId), [ticketId]);
    const jobCardQuery = useApiQuery(() => jobCards.get(ticketId), [ticketId]);
    const ticket = ticketQuery.data;

    // The crew list is only served once the ticket is workable, so reload it as the ticket moves on.
    const crew = useApiQuery(() => jobCards.crewOptions(ticketId).catch(() => NO_CREW), [ticketId, ticket?.dispatchState, ticket?.acceptedAt], {
        enabled: ticket !== undefined,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [historyVersion, setHistoryVersion] = useState(0);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [dialog, setDialog] = useState<'decline' | 'reject' | 'assign' | 'reopen' | 'cancel' | 'not-fixed' | 'validate' | null>(null);

    if (ticketQuery.isLoading) {
        return (
            <Page title="Job Card" back={{ href: route('tickets.index'), label: 'Tickets' }} width="narrow">
                <LoadingState rows={4} />
            </Page>
        );
    }
    if (!ticket) {
        return (
            <Page title="Job Card" back={{ href: route('tickets.index'), label: 'Tickets' }} width="narrow">
                <ErrorState message={ticketQuery.error ?? 'Failed to load ticket'} onRetry={ticketQuery.reload} />
            </Page>
        );
    }

    const jobCard = jobCardQuery.data ?? null;
    const isSubmitted = ticket.status === 'done' || ticket.status === 'confirmed';

    const updateTicket = (updated: Ticket) => {
        ticketQuery.setData(updated);
        setHistoryVersion((v) => v + 1);
    };

    /** Runs a dispatch action that returns the updated ticket. A conflict means it changed underneath us, so refresh. */
    const runDispatch = async (name: string, action: () => Promise<Ticket>, success: string) => {
        setBusyAction(name);
        try {
            updateTicket(await action());
            toast.success(success);
        } catch (e) {
            toast.error(errorText(e));
            if (e instanceof ApiError && e.isConflict) {
                await ticketQuery.reload();
                setHistoryVersion((v) => v + 1);
            }
        } finally {
            setBusyAction(null);
        }
    };

    const accept = async () => {
        setBusyAction('accept');
        try {
            updateTicket(await dispatch.accept(ticket));
            toast.success(
                ticket.isDispatchManaged ? 'Accepted. Tap Start Work when you arrive on site.' : 'Ticket accepted. You can now submit your job card.',
            );
        } catch (e) {
            toast.error(errorText(e));
            if (e instanceof ApiError && e.isConflict) router.visit(route('tickets.index'));
        } finally {
            setBusyAction(null);
        }
    };

    const leaveAfterDecline = () => {
        toast.success('Declined. The Cluster Leader has been notified to reassign it.');
        router.visit(route('tickets.index'));
    };

    const stationValidate = async (approve: boolean, note: string | null) => {
        await tickets.stationValidate(ticket.ticketId, approve, note);
        toast.success(approve ? 'Restoration confirmed.' : 'Sent back to the Cluster Leader for reassignment.');
        router.visit(route('tickets.index'));
    };

    const downloadPdf = async () => {
        // Opened before the request so the browser doesn't treat it as an unrequested popup.
        const tab = window.open('', '_blank');
        setBusyAction('pdf');
        try {
            const url = await jobCards.pdfUrl(ticket.ticketId);
            if (!url) throw new Error('The server did not return a PDF link.');
            if (tab) tab.location.href = url;
            else window.location.assign(url);
        } catch (e) {
            tab?.close();
            toast.error(errorText(e));
        } finally {
            setBusyAction(null);
        }
    };

    // A technician only gets the job-card form once they've accepted AND started work. Before
    // that, and for everyone else, the ticket is read-only plus whichever actions the server allows.
    let mode: 'form' | 'submitted' | 'detail';
    if (isEditing) mode = 'form';
    else if (ticket.isDispatchManaged) mode = ticket.canSubmitJobCard ? 'form' : jobCard && isSubmitted ? 'submitted' : 'detail';
    else mode = jobCard && isSubmitted ? 'submitted' : 'form';

    const showAssign = ticket.canAssign && canReassign(auth.user);
    const dispatchSections = ticket.isDispatchManaged && (
        <>
            <Card title="Assignment">
                <TicketAssignmentPanel ticket={ticket} />
                {(showAssign || ticket.canReopen || ticket.canCancel) && (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                        {showAssign && (
                            <Button size="sm" disabled={busyAction !== null} onClick={() => setDialog('assign')}>
                                <MdPersonAddAlt1 /> {ticket.assignee ? 'Reassign' : 'Assign'}
                            </Button>
                        )}
                        {ticket.canReopen && (
                            <Button size="sm" variant="outline" disabled={busyAction !== null} onClick={() => setDialog('reopen')}>
                                <MdReplay /> Reopen
                            </Button>
                        )}
                        {ticket.canCancel && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:text-red-700 dark:border-red-900 dark:text-red-400"
                                disabled={busyAction !== null}
                                onClick={() => setDialog('cancel')}
                            >
                                <MdCancelOutline /> Cancel ticket
                            </Button>
                        )}
                    </div>
                )}
            </Card>
            <Card title="Assignment History">
                <AssignmentHistory ticketId={ticket.ticketId} refreshKey={historyVersion} />
            </Card>
        </>
    );

    const declineButtonClass = 'h-11 flex-1 border-red-200 text-red-700 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:text-red-400';

    const banners = (
        <>
            {needsAcceptDecision(ticket) && (
                <Banner
                    icon={MdAssignmentTurnedIn}
                    tone="blue"
                    title={
                        <div className="flex flex-wrap items-center gap-2">
                            {ticket.isDispatchManaged ? 'You have a new assignment' : 'Accept or reject this ticket'}
                            {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                        </div>
                    }
                >
                    <p className="text-[13px] leading-[1.4] text-neutral-700 dark:text-neutral-300">
                        {ticket.isDispatchManaged
                            ? 'Review the details below, then accept it, or decline with a reason so your Cluster Leader can reassign it.'
                            : "You must accept this assignment before you can submit a job card. If you can't take it, reject it so your Cluster Leader can re-assign it."}
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className={declineButtonClass}
                            disabled={busyAction !== null}
                            onClick={() => setDialog(ticket.isDispatchManaged ? 'decline' : 'reject')}
                        >
                            {ticket.isDispatchManaged ? 'Decline' : 'Reject'}
                        </Button>
                        <Button type="button" className={cn(BLUE_GRADIENT, 'h-11 flex-1 text-white')} disabled={busyAction !== null} onClick={accept}>
                            {busyAction === 'accept' && <LoaderCircle className="animate-spin" />}
                            Accept Ticket
                        </Button>
                    </div>
                </Banner>
            )}
            {ticket.canStart && (
                <Banner tone="orange" title="On site?">
                    <p className="text-[13px] leading-[1.4] text-neutral-700 dark:text-neutral-300">
                        Tap Start Work when you begin on site. Your on-site time is measured from here, and the job card unlocks.
                    </p>
                    <div className="pt-2">
                        <Button
                            type="button"
                            className="h-11 w-full bg-[#FB8C00] text-white shadow-none hover:bg-[#FB8C00]/90"
                            disabled={busyAction !== null}
                            onClick={() => runDispatch('start', () => dispatch.start(ticket), 'Work started. Fill in the job card when you are done.')}
                        >
                            {busyAction === 'start' ? <LoaderCircle className="animate-spin" /> : <MdPlayArrow />}
                            Start Work
                        </Button>
                    </div>
                </Banner>
            )}
            {ticket.status === 'rejected' && ticket.rejectionReason && (
                <Banner icon={MdErrorOutline} tone="red" title="Job card rejected — please fix and resubmit">
                    <p className="text-[13px] leading-[1.4] text-red-900 dark:text-red-200">{ticket.rejectionReason}</p>
                </Banner>
            )}
        </>
    );

    const jobDetails = (
        <Card title="Job Details">
            <dl>
                <DetailRow icon={MdConfirmationNumberOutline} label="Ticket" value={ticket.ticketId} />
                <DetailRow icon={MdLocalGasStation} label="Station" value={ticket.stationName || '-'} />
                <DetailRow icon={MdPeopleAlt} label="Cluster" value={ticket.clusterName || '-'} />
                <DetailRow icon={MdBuild} label="Issue Type" value={ticket.issueType || '-'} />
                {ticket.description && (
                    <DetailRow icon={MdDescription} label="Description" value={<span className="font-medium whitespace-pre-line">{ticket.description}</span>} />
                )}
                <DetailRow
                    icon={MdCampaign}
                    label="Raised"
                    value={`${formatDateTime(ticket.reportedAt)}${ticket.reportedBy ? ` by ${ticket.reportedBy}` : ''}`}
                />
                {!ticket.isDispatchManaged && (
                    <DetailRow
                        icon={MdPersonPinCircle}
                        label="Acceptance"
                        value={
                            ticket.acceptedAt
                                ? `Accepted ${formatDateTime(ticket.acceptedAt)}`
                                : needsAcceptDecision(ticket)
                                  ? 'Awaiting technician acceptance'
                                  : 'Not recorded'
                        }
                    />
                )}
            </dl>
        </Card>
    );

    const signoff = (ticket.canStationValidate || ticket.canValidate) && (
        <Card title={ticket.canStationValidate ? 'Station Confirmation' : 'Validation'}>
            {ticket.canStationValidate ? (
                <>
                    <p className="text-muted-foreground text-[13px]">Confirm the fault is fixed, or send it back to the Cluster Leader for reassignment.</p>
                    <div className="flex gap-3 pt-1">
                        <Button variant="outline" className={declineButtonClass} disabled={busyAction !== null} onClick={() => setDialog('not-fixed')}>
                            Not fixed
                        </Button>
                        <Button
                            className="h-11 flex-1 bg-[#2E7D32] text-white shadow-none hover:bg-[#2E7D32]/90"
                            disabled={busyAction !== null}
                            onClick={async () => {
                                setBusyAction('station-validate');
                                try {
                                    await stationValidate(true, null);
                                } catch (e) {
                                    toast.error(errorText(e));
                                    setBusyAction(null);
                                }
                            }}
                        >
                            {busyAction === 'station-validate' && <LoaderCircle className="animate-spin" />}
                            Confirm
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-muted-foreground text-[13px]">The station has confirmed restoration. Validate and close the ticket.</p>
                    <Button className="h-11 w-full bg-[#2E7D32] text-white shadow-none hover:bg-[#2E7D32]/90 sm:w-auto" disabled={busyAction !== null} onClick={() => setDialog('validate')}>
                        <MdVerified /> Validate &amp; Close
                    </Button>
                </>
            )}
        </Card>
    );

    // On desktop the detail and submitted views split into the job itself (left) and the
    // assignment / sign-off side panel (right). On a phone they stack in that order.
    let body: React.ReactNode;
    if (mode === 'form') {
        body = (
            <div className="mx-auto w-full max-w-3xl">
                <JobCardForm
                    key={isEditing ? `edit-${jobCard?.jobCardId}` : 'new'}
                    ticket={ticket}
                    jobCard={jobCard}
                    isEditing={isEditing}
                    crew={crew.data ?? NO_CREW}
                    isLoadingCrew={crew.isLoading}
                    banners={banners}
                    onCancelEditing={() => setIsEditing(false)}
                    onSaved={async (updated) => {
                        if (isEditing) {
                            jobCardQuery.setData(updated);
                            setIsEditing(false);
                            // Picks up any photos just added.
                            jobCardQuery.reload();
                            toast.success('Job card updated');
                        } else {
                            toast.success('Job card submitted successfully!');
                            window.setTimeout(() => router.visit(route('tickets.index')), 1000);
                        }
                    }}
                />
            </div>
        );
    } else if (mode === 'submitted' && jobCard) {
        body = (
            <TwoColumn
                main={
                    <>
                        <SubmittedJobCard ticket={ticket} jobCard={jobCard} onEdit={() => setIsEditing(true)} />
                        {jobDetails}
                        <JobCardContents jobCard={jobCard} />
                    </>
                }
                aside={
                    <>
                        {dispatchSections}
                        {signoff}
                        <GradientButton type="button" disabled={busyAction === 'pdf'} onClick={downloadPdf} className="h-[50px] text-[15px]">
                            {busyAction === 'pdf' ? <LoaderCircle className="animate-spin" /> : <MdPictureAsPdf className="!size-[22px]" />}
                            Download Job Card PDF
                        </GradientButton>
                    </>
                }
            />
        );
    } else {
        const readOnlyNote = isReadOnlyForMe(ticket) && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-[12.5px]">
                <MdVisibility className="size-4 shrink-0" /> View only. This ticket isn't assigned to you.
            </p>
        );
        const hasAside = Boolean(dispatchSections || signoff);
        body = hasAside ? (
            <TwoColumn
                main={
                    <>
                        {banners}
                        {jobDetails}
                        {readOnlyNote}
                    </>
                }
                aside={
                    <>
                        {dispatchSections}
                        {signoff}
                    </>
                }
            />
        ) : (
            <div className="mx-auto w-full max-w-3xl space-y-4">
                {banners}
                {jobDetails}
                {readOnlyNote}
            </div>
        );
    }

    return (
        <Page
            title="Job Card"
            description={isEditing ? 'Edit Work Report' : isSubmitted ? 'View Report' : 'Submit Work Report'}
            back={{ href: route('tickets.index'), label: 'Tickets' }}
            width={mode === 'form' ? 'narrow' : 'default'}
        >
            {body}

            {dialog === 'decline' && <DeclineDialog ticket={ticket} open onOpenChange={() => setDialog(null)} onDeclined={leaveAfterDecline} />}
            {dialog === 'assign' && (
                <TechnicianPickerDialog
                    ticket={ticket}
                    open
                    onOpenChange={() => setDialog(null)}
                    onAssigned={(updated) => {
                        updateTicket(updated);
                        toast.success('Ticket assigned.');
                    }}
                />
            )}
            <ReasonDialog
                open={dialog === 'reject'}
                onOpenChange={() => setDialog(null)}
                title="Reject Assignment"
                description="Your Cluster Leader will be notified to re-assign this ticket to another technician. Let them know why you can't take it (optional):"
                placeholder="Reason (optional)"
                required={false}
                confirmLabel="Reject"
                destructive
                onConfirm={async (reason) => {
                    await tickets.reject(ticket.ticketId, reason || null);
                    leaveAfterDecline();
                }}
            />
            <ReasonDialog
                open={dialog === 'reopen'}
                onOpenChange={() => setDialog(null)}
                title="Reopen ticket"
                description="Restoration not confirmed or the fault came back? The ticket returns to the assignment queue."
                confirmLabel="Reopen"
                onConfirm={(reason) => runDispatch('reopen', () => dispatch.reopen(ticket, reason), 'Ticket reopened.')}
            />
            <ReasonDialog
                open={dialog === 'cancel'}
                onOpenChange={() => setDialog(null)}
                title="Cancel ticket"
                description="The ticket is withdrawn and leaves the assignment queue."
                confirmLabel="Cancel ticket"
                destructive
                onConfirm={(reason) => runDispatch('cancel', () => dispatch.cancel(ticket, reason), 'Ticket cancelled.')}
            />
            <ReasonDialog
                open={dialog === 'not-fixed'}
                onOpenChange={() => setDialog(null)}
                title="Restoration not confirmed"
                description="What is still wrong? The ticket goes back to the Cluster Leader to reassign."
                confirmLabel="Send back"
                destructive
                onConfirm={(note) => stationValidate(false, note)}
            />
            <ReasonDialog
                open={dialog === 'validate'}
                onOpenChange={() => setDialog(null)}
                title="Validate ticket"
                description="Add a note for the record (optional)."
                placeholder="Note (optional)"
                required={false}
                confirmLabel="Validate & Close"
                onConfirm={async (note) => {
                    updateTicket(await tickets.validate(ticket.ticketId, note || null));
                    toast.success('Ticket validated and closed.');
                }}
            />
        </Page>
    );
}

function TwoColumn({ main, aside }: { main: React.ReactNode; aside: React.ReactNode }) {
    return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-5">
            <div className="min-w-0 space-y-4">{main}</div>
            <div className="min-w-0 space-y-4">{aside}</div>
        </div>
    );
}

// ==================== Submitted job card ====================

function SubmittedJobCard({ ticket, jobCard, onEdit }: { ticket: Ticket; jobCard: JobCard; onEdit: () => void }) {
    const confirmed = ticket.status === 'confirmed';
    const color = TONE_COLORS[ticketStatusTone(ticket.status)];
    return (
        <>
            <section
                className="bg-card shadow-card flex items-center gap-4 rounded-2xl border p-5"
                style={{ borderColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
                <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-white"
                    style={{
                        backgroundImage: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`,
                        boxShadow: `0 4px 8px color-mix(in srgb, ${color} 30%, transparent)`,
                    }}
                >
                    {confirmed ? <MdCheckCircle className="size-[26px]" /> : <MdHourglassBottom className="size-[26px]" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p
                        className={cn(
                            'text-[17px] font-bold tracking-[-0.2px]',
                            confirmed ? 'text-[#2E7D32] dark:text-[#81C784]' : 'text-[#E65100] dark:text-[#FFB74D]',
                        )}
                    >
                        {ticketStatusLabel(ticket.status)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">Submitted on {formatDateTime(jobCard.submittedAt)}</p>
                </div>
            </section>
            {jobCard.canEdit && (
                <section className="bg-card shadow-card flex flex-wrap items-center gap-3 rounded-2xl border border-[#B45309]/15 p-4">
                    <MdEditNote className="size-[26px] shrink-0 text-[#B45309] dark:text-amber-400" />
                    <p className="min-w-[180px] flex-1 text-[12.5px] text-[#6B4E16] dark:text-amber-200">
                        Awaiting station leader approval. You can still edit this job card until it is approved.
                    </p>
                    <Button size="sm" className={cn(BLUE_GRADIENT, 'text-white')} onClick={onEdit}>
                        <MdEdit /> Edit
                    </Button>
                </section>
            )}
        </>
    );
}

function JobCardContents({ jobCard }: { jobCard: JobCard }) {
    return (
        <>
            <Card title="Work Performed">
                <p className="rounded-xl border border-[#1F4788]/[0.06] bg-[#1F4788]/[0.03] p-3.5 text-sm leading-relaxed whitespace-pre-line dark:border-white/[0.06] dark:bg-white/[0.03]">
                    {jobCard.workDescription || '-'}
                </p>
            </Card>
            {jobCard.technicians.length > 0 && (
                <Card title="Team & Transport">
                    <dl>
                        {jobCard.technicians.map((t) => (
                            <DetailRow
                                key={t.userId}
                                icon={t.isPrimary ? MdPerson : MdGroup}
                                label={t.isPrimary ? `${t.fullName} (submitted)` : t.fullName}
                                value={t.transportMode || '—'}
                            />
                        ))}
                    </dl>
                </Card>
            )}
            <Card title="Materials & Items Used">
                {jobCard.items.length === 0 ? (
                    <EmptyBox icon={MdInventory2Outline} title="No items recorded." hint="No materials were added to this job card" />
                ) : (
                    <ul className="space-y-2.5">
                        {jobCard.items.map((item, index) => (
                            <ItemTile
                                key={item.itemId || index}
                                icon={MdInventory2Outline}
                                name={item.itemName}
                                quantity={`${formatQuantity(item.quantity)} ${item.unit}`}
                                partNumber={item.partNumber}
                            />
                        ))}
                    </ul>
                )}
            </Card>
            {jobCard.photoUrls.length > 0 && (
                <Card title="Photos">
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {jobCard.photoUrls.map((url, index) => (
                            <li key={url + index}>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="bg-muted block aspect-square overflow-hidden rounded-xl border">
                                    <img src={url} alt={`Photo ${index + 1}`} loading="lazy" className="size-full object-cover" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </>
    );
}

// ==================== Job card form ====================

interface FormItem extends JobItemInput {
    key: number;
}

let nextItemKey = 1;

function JobCardForm({
    ticket,
    jobCard,
    isEditing,
    crew,
    isLoadingCrew,
    banners,
    onCancelEditing,
    onSaved,
}: {
    ticket: Ticket;
    jobCard: JobCard | null;
    isEditing: boolean;
    crew: CrewOptions;
    isLoadingCrew: boolean;
    banners: React.ReactNode;
    onCancelEditing: () => void;
    onSaved: (jobCard: JobCard) => void;
}) {
    // Editing opens the submitted card pre-filled. Warehouse part requests have their own
    // approval flow and are left as they are by an edit, so they aren't part of the form.
    const [workDescription, setWorkDescription] = useState(jobCard?.workDescription ?? '');
    const [items, setItems] = useState<FormItem[]>(() =>
        isEditing && jobCard
            ? jobCard.items
                  .filter((item) => item.source !== 'warehouse')
                  .map((item) => ({
                      key: nextItemKey++,
                      itemName: item.itemName,
                      quantity: item.quantity,
                      unit: item.unit || 'pcs',
                      partNumber: item.partNumber ?? null,
                      source: item.source,
                      miniStoreItemId: item.miniStoreItemId ?? null,
                      productId: item.productId ?? null,
                  }))
            : [],
    );
    const primary = isEditing ? jobCard?.technicians.find((t) => t.isPrimary) : undefined;
    const [myTransportMode, setMyTransportMode] = useState<string>(primary?.transportMode ?? '');
    const [crewModes, setCrewModes] = useState<Record<string, string>>(() =>
        Object.fromEntries(isEditing && jobCard ? jobCard.technicians.filter((t) => !t.isPrimary).map((t) => [t.userId, t.transportMode ?? '']) : []),
    );
    const [photos, setPhotos] = useState<File[]>([]);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [addingItem, setAddingItem] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const locked = !jobCardUnlocked(ticket) && !isEditing;
    const transportModes = crew.transportModes.length > 0 ? crew.transportModes : TRANSPORT_MODES;
    const selectedCrewIds = Object.keys(crewModes);
    const crewName = (id: string) => crew.technicians.find((t) => t.userId === id)?.fullName ?? id;

    const validateDescription = (value: string): string | null => {
        if (value.trim() === '') return 'Please describe the work performed';
        if (value.trim().length < 10) return 'Description must be at least 10 characters';
        return null;
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const error = validateDescription(workDescription);
        setDescriptionError(error);
        if (error) return;
        if (items.length === 0) return toast.error('Please add at least one material/item');
        if (myTransportMode === '') return toast.error('Select your mode of transport');
        if (Object.values(crewModes).some((mode) => mode === '')) return toast.error('Pick a mode of transport for each technician');

        setIsSubmitting(true);
        try {
            if (photos.length > 0) await jobCards.uploadPhotos(ticket.ticketId, photos);
            const input = {
                workDescription: workDescription.trim(),
                items: items.map((item) => ({
                    itemName: item.itemName,
                    quantity: item.quantity,
                    unit: item.unit,
                    partNumber: item.partNumber ?? null,
                    source: item.source || 'station',
                    miniStoreItemId: item.miniStoreItemId ?? null,
                    productId: item.productId ?? null,
                    warehouseId: item.warehouseId ?? null,
                })),
                transportMode: myTransportMode,
                technicians: selectedCrewIds.map((id) => ({ user_id: idValue(id), transport_mode: crewModes[id] })),
            };
            const saved = isEditing ? await jobCards.update(ticket.ticketId, input) : await jobCards.submit(ticket.ticketId, input);
            onSaved(saved);
            if (isEditing) setIsSubmitting(false);
        } catch (e) {
            toast.error(`${isEditing ? 'Error saving job card' : 'Error submitting job card'}: ${errorText(e)}`);
            setIsSubmitting(false);
        }
    };

    const crewLabel = 'text-muted-foreground text-[12.5px] font-semibold';

    return (
        <form onSubmit={submit} className="space-y-4 sm:space-y-5">
            {banners}

            {/* Job summary */}
            <section className="bg-card shadow-card space-y-3.5 rounded-2xl border border-[#1F4788]/[0.08] p-[18px] dark:border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                    <span className={cn(BLUE_GRADIENT, 'flex size-[42px] shrink-0 items-center justify-center rounded-xl text-white shadow-[0_3px_6px_rgb(31_71_136/0.25)]')}>
                        <MdLocalGasStation className="size-[22px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-bold tracking-[-0.2px]">{ticket.stationName}</p>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs font-medium">
                            {ticket.clusterName} • {ticket.issueType}
                        </p>
                    </div>
                </div>
                {ticket.description && (
                    <div className="flex gap-2 rounded-[10px] border border-[#1F4788]/[0.08] bg-[#1F4788]/[0.04] p-3 dark:border-white/[0.06] dark:bg-white/[0.04]">
                        <MdFormatQuote className="mt-0.5 size-4 shrink-0 text-[#1F4788]/50 dark:text-white/40" />
                        <p className="text-[13px] leading-[1.4] whitespace-pre-line text-neutral-700 dark:text-neutral-300">{ticket.description}</p>
                    </div>
                )}
                <p className="text-muted-foreground flex items-center gap-1 text-[11.5px] font-medium">
                    <MdConfirmationNumberOutline className="size-[13px]" />
                    {ticket.ticketId}
                </p>
            </section>

            <fieldset disabled={locked || isSubmitting} className="space-y-4 disabled:opacity-60 sm:space-y-5">
                <Card title="Work Carried Out">
                    <Field label="Work description" htmlFor="work-description" error={descriptionError} required className="[&>label]:sr-only">
                        <Textarea
                            id="work-description"
                            rows={5}
                            value={workDescription}
                            placeholder="Describe the work performed, repairs made, and any observations..."
                            className="min-h-32 leading-relaxed"
                            onChange={(e) => {
                                setWorkDescription(e.target.value);
                                if (descriptionError) setDescriptionError(validateDescription(e.target.value));
                            }}
                        />
                    </Field>
                    <p className="text-muted-foreground/80 text-[11px]">{workDescription.trim().length} characters</p>
                </Card>

                <Card title="Team & Transport">
                    <div className="space-y-1.5">
                        <label htmlFor="my-transport" className={crewLabel}>
                            Your mode of transport<span className="text-destructive"> *</span>
                        </label>
                        <SelectField id="my-transport" value={myTransportMode} onChange={(e) => setMyTransportMode(e.target.value)}>
                            <option value="">Select mode of transport</option>
                            {transportModes.map((mode) => (
                                <option key={mode}>{mode}</option>
                            ))}
                        </SelectField>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <p className={crewLabel}>Other technicians who worked this ticket</p>
                        {isLoadingCrew ? (
                            <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                <LoaderCircle className="size-4 animate-spin" /> Loading technicians...
                            </p>
                        ) : crew.technicians.length === 0 && selectedCrewIds.length === 0 ? (
                            <p className="bg-input text-muted-foreground rounded-xl border px-3.5 py-3 text-[13.5px]">No other technicians found in your cluster.</p>
                        ) : (
                            <ul className="bg-input divide-y overflow-hidden rounded-xl border">
                                {[...crew.technicians.map((t) => t.userId), ...selectedCrewIds.filter((id) => !crew.technicians.some((t) => t.userId === id))].map(
                                    (id) => {
                                        const option = crew.technicians.find((t) => t.userId === id);
                                        const checked = id in crewModes;
                                        const detail = [option?.role, option?.clusterName].filter(Boolean).join(' · ');
                                        return (
                                            <li key={id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5', checked && 'bg-primary/[0.04]')}>
                                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary size-[18px] shrink-0"
                                                        checked={checked}
                                                        onChange={() =>
                                                            setCrewModes((current) => {
                                                                const next = { ...current };
                                                                if (checked) delete next[id];
                                                                else next[id] = '';
                                                                return next;
                                                            })
                                                        }
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-[13px] font-medium">{crewName(id)}</span>
                                                        {detail && <span className="text-muted-foreground block truncate text-xs">{detail}</span>}
                                                    </span>
                                                </label>
                                                {checked && (
                                                    <SelectField
                                                        aria-label={`Mode of transport for ${crewName(id)}`}
                                                        value={crewModes[id]}
                                                        onChange={(e) => setCrewModes((current) => ({ ...current, [id]: e.target.value }))}
                                                        className="w-full sm:w-56 [&>select]:h-10 [&>select]:bg-card"
                                                    >
                                                        <option value="">Select mode</option>
                                                        {transportModes.map((mode) => (
                                                            <option key={mode}>{mode}</option>
                                                        ))}
                                                    </SelectField>
                                                )}
                                            </li>
                                        );
                                    },
                                )}
                            </ul>
                        )}
                    </div>
                </Card>

                <Card
                    title="Materials & Items Used"
                    actions={
                        <Button type="button" size="sm" className={cn(BLUE_GRADIENT, 'h-9 rounded-[10px] px-3 text-[13px] text-white')} onClick={() => setAddingItem(true)}>
                            <MdAdd /> Add Item
                        </Button>
                    }
                >
                    {items.length === 0 ? (
                        <EmptyBox icon={MdInventory2Outline} title="No items added yet" hint={'Tap "Add Item" to include materials used'} />
                    ) : (
                        <ul className="space-y-2.5">
                            {items.map((item) => (
                                <ItemTile
                                    key={item.key}
                                    icon={MdBuildOutline}
                                    name={item.itemName}
                                    quantity={`${formatQuantity(item.quantity)} ${item.unit}`}
                                    partNumber={item.partNumber}
                                    trailing={
                                        <button
                                            type="button"
                                            onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                                            className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-red-500/[0.06] text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-500"
                                            aria-label={`Remove ${item.itemName}`}
                                        >
                                            <MdClose className="size-[18px]" />
                                        </button>
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Proof of Work (Photos)">
                    {photos.length === 0 && <EmptyBox icon={MdImageOutline} title="No photos added" hint="Take or choose photos to document your work" />}
                    <PhotoPicker files={photos} onChange={setPhotos} />
                    {photos.length > 0 && (
                        <span className="text-primary bg-primary/5 inline-block rounded-lg px-2.5 py-1 text-xs font-medium">
                            {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                        </span>
                    )}
                </Card>
            </fieldset>

            <GradientButton type="submit" disabled={locked || isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : isEditing ? <MdSave /> : <MdSend />}
                {isSubmitting ? (isEditing ? 'Saving...' : 'Submitting...') : isEditing ? 'Save Changes' : 'Submit Job Card'}
            </GradientButton>
            {isEditing && (
                <Button type="button" variant="outline" className="h-12 w-full" disabled={isSubmitting} onClick={onCancelEditing}>
                    Cancel Editing
                </Button>
            )}

            <AddItemDialog
                open={addingItem}
                onOpenChange={setAddingItem}
                alreadyAdded={quantitiesByStockLine(items)}
                // When editing, what the saved card already drew from each line counts as available again.
                alreadyDrawn={isEditing && jobCard ? quantitiesByStockLine(jobCard.items) : {}}
                onAdd={(item) => setItems((current) => [...current, { ...item, key: nextItemKey++ }])}
            />
        </form>
    );
}

/**
 * Adds a material line. Items used must come from the technician's inventory: their own stock
 * once it is live, otherwise the cluster mini store; the name is picked, never typed.
 */
function AddItemDialog({
    open,
    onOpenChange,
    alreadyAdded,
    alreadyDrawn,
    onAdd,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    alreadyAdded: Record<string, number>;
    alreadyDrawn: Record<string, number>;
    onAdd: (item: JobItemInput) => void;
}) {
    const stock = useApiQuery<JobCardStock>(() => myStock.forJobCard(), [], { enabled: open });
    const [selectedKey, setSelectedKey] = useState('');
    const [quantity, setQuantity] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [quantityError, setQuantityError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setSelectedKey('');
            setQuantity('');
            setPartNumber('');
            setQuantityError(null);
        }
    }, [open]);

    const isMyStock = stock.data?.source === 'my_stock';
    const keyFor = (item: MiniStoreItem) => (isMyStock ? `p:${item.productId}` : item.miniStoreItemId);
    const available = (item: MiniStoreItem) => item.quantity + (alreadyDrawn[keyFor(item)] ?? 0) - (alreadyAdded[keyFor(item)] ?? 0);
    // Only lines with a usable id: the server needs it to draw the stock.
    const options = (stock.data?.items ?? []).filter((item) => /^\d+$/.test(isMyStock ? item.productId : item.miniStoreItemId) && available(item) > 0);
    const selected = options.find((item) => keyFor(item) === selectedKey) ?? null;

    const add = () => {
        if (!selected) {
            setQuantityError(null);
            return toast.error('Select an item from your inventory');
        }
        const qty = Number(quantity);
        let error: string | null = null;
        if (quantity.trim() === '') error = 'Required';
        else if (!Number.isFinite(qty)) error = 'Enter a number';
        else if (qty <= 0) error = 'Must be more than 0';
        else if (qty > available(selected)) error = `Only ${formatQuantity(available(selected))} available`;
        setQuantityError(error);
        if (error) return;
        onAdd({
            itemName: selected.productName,
            quantity: qty,
            unit: 'pcs',
            partNumber: partNumber.trim() || null,
            source: stock.data?.source ?? 'mini_store',
            miniStoreItemId: isMyStock ? null : selected.miniStoreItemId,
            productId: selected.productId,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span className={cn(BLUE_GRADIENT, 'flex size-10 shrink-0 items-center justify-center rounded-xl text-white')}>
                            <MdInventory2Outline className="size-5" />
                        </span>
                        Add Material/Item
                    </DialogTitle>
                </DialogHeader>
                {stock.isLoading ? (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <LoaderCircle className="size-4 animate-spin" /> Loading your inventory...
                    </p>
                ) : stock.data === undefined ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/60 dark:bg-red-950/30">
                        <span className="flex-1 text-red-600 dark:text-red-400">Could not load your inventory.</span>
                        <Button size="sm" variant="outline" onClick={stock.reload}>
                            Retry
                        </Button>
                    </div>
                ) : options.length === 0 ? (
                    <p className="bg-input text-muted-foreground rounded-xl border p-3.5 text-sm">
                        {isMyStock
                            ? 'You have no items in your stock. Raise an Inventory Request, or ask your administrator to record your opening stock.'
                            : 'You have no items in your inventory. Request a restock from your mini store first.'}
                    </p>
                ) : (
                    <div className="space-y-4">
                        <Field
                            label="Item"
                            htmlFor="item"
                            hint={selected ? `From your inventory · ${formatQuantity(available(selected))} available` : undefined}
                            required
                        >
                            <SelectField id="item" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
                                <option value="">Select from your inventory</option>
                                {options.map((item) => (
                                    <option key={keyFor(item)} value={keyFor(item)}>
                                        {item.productName} ({formatQuantity(available(item))} available)
                                    </option>
                                ))}
                            </SelectField>
                        </Field>
                        <Field label="Quantity" htmlFor="quantity" error={quantityError} required>
                            <Input id="quantity" type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                        </Field>
                        <Field label="Part Number (Optional)" htmlFor="part-number">
                            <Input id="part-number" placeholder="e.g., FK-4072" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
                        </Field>
                    </div>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={add} disabled={options.length === 0}>
                        <MdAdd /> Add Item
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
