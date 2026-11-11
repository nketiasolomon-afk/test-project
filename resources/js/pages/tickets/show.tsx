import { AssignmentHistory } from '@/components/dispatch/assignment-history';
import { DeclineDialog } from '@/components/dispatch/decline-dialog';
import { OverrideFlag } from '@/components/dispatch/chips';
import { TechnicianPickerDialog } from '@/components/dispatch/technician-picker-dialog';
import { TicketAssignmentPanel } from '@/components/dispatch/ticket-assignment-panel';
import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { PhotoPicker } from '@/components/fuelops/photo-picker';
import { ErrorState, LoadingState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
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
    TRANSPORT_MODES,
} from '@/lib/format';
import { dispatch, jobCards, myStock, stockLineKey, tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { type CrewOptions, type JobCard, type JobCardStock, type JobItemInput, type MiniStoreItem, type Ticket } from '@/types/fuelops';
import { router, usePage } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    Download,
    Eye,
    Hourglass,
    LoaderCircle,
    Package,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    UserPlus,
    X,
    XCircle,
} from '@/components/icons';
import { FormEvent, useEffect, useState } from 'react';

const NO_CREW: CrewOptions = { technicians: [], transportModes: [] };

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

function Card({ title, actions, className, children }: { title?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
    return (
        <section className={cn('bg-card space-y-3 rounded-xl border p-5 shadow-xs', className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {title && <h2 className="border-l-4 border-[var(--brand-yellow)] pl-2 font-semibold">{title}</h2>}
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex gap-3 border-b py-2 text-sm last:border-0">
            <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
        </div>
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
            <Page title="Job Card" back={{ href: route('tickets.index'), label: 'Tickets' }}>
                <LoadingState rows={4} />
            </Page>
        );
    }
    if (!ticket) {
        return (
            <Page title="Job Card" back={{ href: route('tickets.index'), label: 'Tickets' }}>
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
                    <div className="flex flex-wrap gap-2 pt-1">
                        {showAssign && (
                            <Button size="sm" disabled={busyAction !== null} onClick={() => setDialog('assign')}>
                                <UserPlus /> {ticket.assignee ? 'Reassign' : 'Assign'}
                            </Button>
                        )}
                        {ticket.canReopen && (
                            <Button size="sm" variant="outline" disabled={busyAction !== null} onClick={() => setDialog('reopen')}>
                                <RotateCcw /> Reopen
                            </Button>
                        )}
                        {ticket.canCancel && (
                            <Button size="sm" variant="outline" className="text-destructive" disabled={busyAction !== null} onClick={() => setDialog('cancel')}>
                                <XCircle /> Cancel ticket
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

    const banners = (
        <>
            {needsAcceptDecision(ticket) && (
                <div className="space-y-3 rounded-xl border border-blue-600/30 bg-blue-600/5 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{ticket.isDispatchManaged ? 'You have a new assignment' : 'Accept or reject this ticket'}</p>
                        {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {ticket.isDispatchManaged
                            ? 'Review the details below, then accept it, or decline with a reason so your Cluster Leader can reassign it.'
                            : "You must accept this assignment before you can submit a job card. If you can't take it, reject it so your Cluster Leader can re-assign it."}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="text-destructive"
                            disabled={busyAction !== null}
                            onClick={() => setDialog(ticket.isDispatchManaged ? 'decline' : 'reject')}
                        >
                            {ticket.isDispatchManaged ? 'Decline' : 'Reject'}
                        </Button>
                        <Button className="flex-1" disabled={busyAction !== null} onClick={accept}>
                            {busyAction === 'accept' && <LoaderCircle className="animate-spin" />}
                            Accept Ticket
                        </Button>
                    </div>
                </div>
            )}
            {ticket.canStart && (
                <div className="space-y-3 rounded-xl border border-orange-500/40 bg-orange-500/5 p-5">
                    <p className="font-semibold">On site?</p>
                    <p className="text-muted-foreground text-sm">
                        Tap Start Work when you begin on site. Your on-site time is measured from here, and the job card unlocks.
                    </p>
                    <Button
                        className="w-full bg-orange-600 text-white hover:bg-orange-600/90"
                        disabled={busyAction !== null}
                        onClick={() => runDispatch('start', () => dispatch.start(ticket), 'Work started. Fill in the job card when you are done.')}
                    >
                        {busyAction === 'start' ? <LoaderCircle className="animate-spin" /> : <Play />}
                        Start Work
                    </Button>
                </div>
            )}
            {ticket.status === 'rejected' && ticket.rejectionReason && (
                <div className="flex gap-3 rounded-xl border border-red-600/30 bg-red-600/5 p-4">
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
                    <div>
                        <p className="font-semibold text-red-800 dark:text-red-300">Job card rejected — please fix and resubmit</p>
                        <p className="text-sm">{ticket.rejectionReason}</p>
                    </div>
                </div>
            )}
        </>
    );

    const jobDetails = (
        <Card title="Job Details">
            <dl>
                <DetailRow label="Ticket" value={ticket.ticketId} />
                <DetailRow label="Station" value={ticket.stationName || '-'} />
                <DetailRow label="Cluster" value={ticket.clusterName || '-'} />
                <DetailRow label="Issue Type" value={ticket.issueType || '-'} />
                {ticket.description && <DetailRow label="Description" value={<span className="whitespace-pre-line">{ticket.description}</span>} />}
                <DetailRow
                    label="Raised"
                    value={`${formatDateTime(ticket.reportedAt)}${ticket.reportedBy ? ` by ${ticket.reportedBy}` : ''}`}
                />
                {!ticket.isDispatchManaged && (
                    <DetailRow
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
                    <p className="text-muted-foreground text-sm">Confirm the fault is fixed, or send it back to the Cluster Leader for reassignment.</p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="text-destructive flex-1" disabled={busyAction !== null} onClick={() => setDialog('not-fixed')}>
                            Not fixed
                        </Button>
                        <Button
                            className="flex-1"
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
                    <p className="text-muted-foreground text-sm">The station has confirmed restoration. Validate and close the ticket.</p>
                    <Button disabled={busyAction !== null} onClick={() => setDialog('validate')}>
                        <CircleCheck /> Validate &amp; Close
                    </Button>
                </>
            )}
        </Card>
    );

    let body: React.ReactNode;
    if (mode === 'form') {
        body = (
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
        );
    } else if (mode === 'submitted' && jobCard) {
        body = (
            <>
                <SubmittedJobCard ticket={ticket} jobCard={jobCard} onEdit={() => setIsEditing(true)} />
                {jobDetails}
                <JobCardContents jobCard={jobCard} />
                {dispatchSections}
                {signoff}
                <Button variant="outline" className="w-full" disabled={busyAction === 'pdf'} onClick={downloadPdf}>
                    {busyAction === 'pdf' ? <LoaderCircle className="animate-spin" /> : <Download />}
                    Download Job Card PDF
                </Button>
            </>
        );
    } else {
        body = (
            <>
                {banners}
                {jobDetails}
                {dispatchSections}
                {signoff}
                {isReadOnlyForMe(ticket) && (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Eye className="size-4" /> View only. This ticket isn't assigned to you.
                    </p>
                )}
            </>
        );
    }

    return (
        <Page
            title="Job Card"
            description={isEditing ? 'Edit Work Report' : isSubmitted ? 'View Report' : 'Submit Work Report'}
            back={{ href: route('tickets.index'), label: 'Tickets' }}
            width="narrow"
        >
            <div className="space-y-4">{body}</div>

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

// ==================== Submitted job card ====================

function SubmittedJobCard({ ticket, jobCard, onEdit }: { ticket: Ticket; jobCard: JobCard; onEdit: () => void }) {
    const confirmed = ticket.status === 'confirmed';
    return (
        <div className="space-y-3">
            <div className={cn('flex items-center gap-4 rounded-xl p-5 text-white shadow', confirmed ? 'bg-green-600' : 'bg-orange-500')}>
                {confirmed ? <CircleCheck className="size-8 shrink-0" /> : <Hourglass className="size-8 shrink-0" />}
                <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold">{ticketStatusLabel(ticket.status)}</p>
                    <p className="text-sm text-white/85">Submitted on {formatDateTime(jobCard.submittedAt)}</p>
                </div>
            </div>
            {jobCard.canEdit && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-600/30 bg-blue-600/5 p-4">
                    <p className="flex-1 text-sm">Awaiting station leader approval. You can still edit this job card until it is approved.</p>
                    <Button size="sm" onClick={onEdit}>
                        <Pencil /> Edit
                    </Button>
                </div>
            )}
        </div>
    );
}

function JobCardContents({ jobCard }: { jobCard: JobCard }) {
    return (
        <>
            <Card title="Work Performed">
                <p className="text-sm whitespace-pre-line">{jobCard.workDescription || '-'}</p>
            </Card>
            {jobCard.technicians.length > 0 && (
                <Card title="Team & Transport">
                    <dl>
                        {jobCard.technicians.map((t) => (
                            <DetailRow key={t.userId} label={t.isPrimary ? `${t.fullName} (submitted)` : t.fullName} value={t.transportMode || '—'} />
                        ))}
                    </dl>
                </Card>
            )}
            <Card title="Materials & Items Used">
                {jobCard.items.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No items recorded.</p>
                ) : (
                    <ul className="divide-y">
                        {jobCard.items.map((item, index) => (
                            <li key={item.itemId || index} className="flex items-center gap-3 py-2 text-sm">
                                <Package className="text-primary size-4 shrink-0" />
                                <span className="flex-1">
                                    <span className="font-medium">{item.itemName}</span>
                                    {item.partNumber && <span className="text-muted-foreground block text-xs">Part No: {item.partNumber}</span>}
                                </span>
                                <span className="font-semibold">
                                    {formatQuantity(item.quantity)} {item.unit}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            {jobCard.photoUrls.length > 0 && (
                <Card title="Photos">
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {jobCard.photoUrls.map((url, index) => (
                            <li key={url + index}>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg border">
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

    return (
        <form onSubmit={submit} className="space-y-4">
            {banners}

            <Card>
                <p className="font-semibold">{ticket.stationName}</p>
                <p className="text-muted-foreground text-sm">
                    {ticket.clusterName} • {ticket.issueType}
                </p>
                {ticket.description && <p className="text-sm whitespace-pre-line">{ticket.description}</p>}
                <p className="text-muted-foreground text-xs">{ticket.ticketId}</p>
            </Card>

            <fieldset disabled={locked || isSubmitting} className="space-y-4 disabled:opacity-60">
                <Card title="Work Carried Out">
                    <Field label="Work description" htmlFor="work-description" error={descriptionError} required>
                        <Textarea
                            id="work-description"
                            rows={5}
                            value={workDescription}
                            placeholder="Describe the work performed, repairs made, and any observations..."
                            onChange={(e) => {
                                setWorkDescription(e.target.value);
                                if (descriptionError) setDescriptionError(validateDescription(e.target.value));
                            }}
                        />
                    </Field>
                    <p className="text-muted-foreground text-right text-xs">{workDescription.trim().length} characters</p>
                </Card>

                <Card title="Team & Transport">
                    <Field label="Your mode of transport" htmlFor="my-transport" required>
                        <select
                            id="my-transport"
                            value={myTransportMode}
                            onChange={(e) => setMyTransportMode(e.target.value)}
                            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                        >
                            <option value="">Select mode of transport</option>
                            {transportModes.map((mode) => (
                                <option key={mode}>{mode}</option>
                            ))}
                        </select>
                    </Field>
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Other technicians who worked this ticket</p>
                        {isLoadingCrew ? (
                            <p className="text-muted-foreground text-sm">Loading technicians...</p>
                        ) : crew.technicians.length === 0 && selectedCrewIds.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No other technicians found in your cluster.</p>
                        ) : (
                            <ul className="divide-y rounded-lg border">
                                {[...crew.technicians.map((t) => t.userId), ...selectedCrewIds.filter((id) => !crew.technicians.some((t) => t.userId === id))].map(
                                    (id) => {
                                        const option = crew.technicians.find((t) => t.userId === id);
                                        const checked = id in crewModes;
                                        const detail = [option?.role, option?.clusterName].filter(Boolean).join(' · ');
                                        return (
                                            <li key={id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary size-4"
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
                                                        <span className="block truncate font-medium">{crewName(id)}</span>
                                                        {detail && <span className="text-muted-foreground block truncate text-xs">{detail}</span>}
                                                    </span>
                                                </label>
                                                {checked && (
                                                    <select
                                                        aria-label={`Mode of transport for ${crewName(id)}`}
                                                        value={crewModes[id]}
                                                        onChange={(e) => setCrewModes((current) => ({ ...current, [id]: e.target.value }))}
                                                        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                                                    >
                                                        <option value="">Mode of transport</option>
                                                        {transportModes.map((mode) => (
                                                            <option key={mode}>{mode}</option>
                                                        ))}
                                                    </select>
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
                        <Button type="button" size="sm" onClick={() => setAddingItem(true)}>
                            <Plus /> Add Item
                        </Button>
                    }
                >
                    {items.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">No items added yet</p>
                    ) : (
                        <ul className="divide-y">
                            {items.map((item, index) => (
                                <li key={item.key} className="flex items-center gap-3 py-2 text-sm">
                                    <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold">{index + 1}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{item.itemName}</span>
                                        {item.partNumber && <span className="text-muted-foreground block text-xs">Part No: {item.partNumber}</span>}
                                    </span>
                                    <span className="font-semibold">
                                        {formatQuantity(item.quantity)} {item.unit}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Remove ${item.itemName}`}
                                    >
                                        <X className="size-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Proof of Work (Photos)">
                    {photos.length === 0 && <p className="text-muted-foreground text-sm">Take or choose photos to document your work</p>}
                    <PhotoPicker files={photos} onChange={setPhotos} />
                </Card>
            </fieldset>

            <Button type="submit" className="w-full" size="lg" disabled={locked || isSubmitting}>
                {isSubmitting && <LoaderCircle className="animate-spin" />}
                {isSubmitting ? (isEditing ? 'Saving...' : 'Submitting...') : isEditing ? 'Save Changes' : 'Submit Job Card'}
            </Button>
            {isEditing && (
                <Button type="button" variant="ghost" className="w-full" disabled={isSubmitting} onClick={onCancelEditing}>
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
                    <DialogTitle>Add Material/Item</DialogTitle>
                </DialogHeader>
                {stock.isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading your inventory...</p>
                ) : stock.data === undefined ? (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-red-600 dark:text-red-400">Could not load your inventory.</span>
                        <Button size="sm" variant="outline" onClick={stock.reload}>
                            Retry
                        </Button>
                    </div>
                ) : options.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
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
                            <select
                                id="item"
                                value={selectedKey}
                                onChange={(e) => setSelectedKey(e.target.value)}
                                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                            >
                                <option value="">Select from your inventory</option>
                                {options.map((item) => (
                                    <option key={keyFor(item)} value={keyFor(item)}>
                                        {item.productName} ({formatQuantity(available(item))} available)
                                    </option>
                                ))}
                            </select>
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
                        Add Item
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
