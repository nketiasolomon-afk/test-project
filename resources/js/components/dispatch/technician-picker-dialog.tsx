import { AvailabilityBadge, DeclineNotice } from '@/components/dispatch/chips';
import { type ReasonChoice, ReasonPickerDialog } from '@/components/dispatch/reason-picker-dialog';
import { Field } from '@/components/fuelops/field';
import { ErrorState } from '@/components/fuelops/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, errorText } from '@/lib/api';
import { availabilityLabel, busyTicketSummary, DISPATCH_HELD_STATES } from '@/lib/format';
import { dispatch } from '@/lib/fuelops-api';
import { type DispatchReason, type TechnicianAvailability, type Ticket } from '@/types/fuelops';
import { cn } from '@/lib/utils';
import { LoaderCircle, MdWarningAmber } from '@/components/icons';
import { useEffect, useState } from 'react';

/**
 * The Cluster Leader's technician picker for a ticket: its cluster's roster with live
 * availability. Available technicians are assigned directly; a busy or off-duty one
 * needs a recorded override. `onAssigned` receives the updated ticket.
 */
export function TechnicianPickerDialog({
    ticket,
    open,
    onOpenChange,
    onAssigned,
}: {
    ticket: Ticket;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAssigned: (ticket: Ticket) => void;
}) {
    const roster = useApiQuery(() => dispatch.pickerRoster(ticket.ticketId), [ticket.ticketId], { enabled: open });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reassignReason, setReassignReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [overrideReasons, setOverrideReasons] = useState<DispatchReason[] | null>(null);

    // Taking a ticket off a technician who holds it needs a reason.
    const isReassign = DISPATCH_HELD_STATES.includes(ticket.dispatchState ?? '');
    const currentAssigneeName = ticket.assignee?.fullName;
    const selected = roster.data?.find((technician) => technician.userId === selectedId) ?? null;
    const needsOverride = selected !== null && selected.status !== 'available';

    useEffect(() => {
        if (open) {
            setSelectedId(null);
            setReassignReason('');
            setSubmitError(null);
            setOverrideReasons(null);
        }
    }, [open]);

    const reassignReasonMissing = (): boolean => {
        if (isReassign && reassignReason.trim() === '') {
            setSubmitError(`Give a reason for taking this ticket off ${currentAssigneeName || 'its technician'}.`);
            return true;
        }
        return false;
    };

    const assign = async (override?: ReasonChoice) => {
        if (!selected || reassignReasonMissing()) return;
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const updated = await dispatch.assign(ticket, selected.userId, {
                isOverride: override !== undefined,
                overrideReasonCode: override?.code,
                overrideNote: override?.note,
                reassignReason: isReassign ? reassignReason.trim() : null,
            });
            onAssigned(updated);
            onOpenChange(false);
        } catch (e) {
            if (e instanceof ApiError && e.isConflict) {
                setSubmitError(`${e.message} Close this and refresh the queue.`);
            } else {
                setSubmitError(errorText(e));
                // Availability may have changed since the list loaded.
                roster.reload();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const startOverride = async () => {
        if (!selected || reassignReasonMissing()) return;
        try {
            setOverrideReasons((await dispatch.reasons()).override);
        } catch (e) {
            setSubmitError(errorText(e));
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
                <DialogContent className="flex max-h-[90vh] flex-col gap-3">
                    <DialogHeader>
                        <DialogTitle>
                            {isReassign ? 'Reassign' : 'Assign'} {ticket.ticketId}
                        </DialogTitle>
                        <DialogDescription>
                            {ticket.stationName} · {ticket.issueType}
                        </DialogDescription>
                    </DialogHeader>
                    {ticket.lastDecline && <DeclineNotice decline={ticket.lastDecline} />}

                    <div className="-mx-2 min-h-24 flex-1 overflow-y-auto">
                        {roster.isLoading ? (
                            <div className="flex justify-center p-8">
                                <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
                            </div>
                        ) : roster.data === undefined ? (
                            <ErrorState message={roster.error ?? 'Failed to load technicians'} onRetry={roster.reload} className="mx-2 border-0" />
                        ) : roster.data.length === 0 ? (
                            <p className="text-muted-foreground p-8 text-center text-sm">No technicians found in this cluster.</p>
                        ) : (
                            <ul className="[&>li+li]:before:bg-border [&>li+li]:before:ml-12 [&>li+li]:before:block [&>li+li]:before:h-px [&>li+li]:before:content-['']">
                                {roster.data.map((technician) => {
                                    // The current assignee can't be picked again; they're shown but disabled.
                                    const isCurrent = isReassign && technician.userId === ticket.assignee?.userId;
                                    const isSelected = selectedId === technician.userId;
                                    return (
                                        <li key={technician.userId}>
                                            <label
                                                className={cn(
                                                    'flex items-start gap-3.5 rounded-xl px-3 py-3 transition-colors',
                                                    isCurrent
                                                        ? 'opacity-50'
                                                        : isSelected
                                                          ? 'bg-primary/8 dark:bg-primary/20 cursor-pointer'
                                                          : 'hover:bg-accent cursor-pointer',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="technician"
                                                    className="accent-primary mt-0.5 size-[18px] shrink-0"
                                                    disabled={isCurrent}
                                                    checked={selectedId === technician.userId}
                                                    onChange={() => {
                                                        setSelectedId(technician.userId);
                                                        setSubmitError(null);
                                                    }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="truncate text-[14.5px] font-medium">{technician.fullName}</span>
                                                        <AvailabilityBadge status={technician.status} />
                                                    </span>
                                                    <RosterDetail technician={technician} isCurrent={isCurrent} />
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {isReassign && (
                        <Field
                            label="Reason for reassigning (required)"
                            htmlFor="reassign-reason"
                            hint={`${currentAssigneeName || 'The current technician'} will be told the ticket was moved.`}
                        >
                            <Textarea id="reassign-reason" rows={2} value={reassignReason} onChange={(event) => setReassignReason(event.target.value)} />
                        </Field>
                    )}
                    {submitError && <p className="text-[12.5px] text-red-600 dark:text-red-400">{submitError}</p>}

                    {/* Busy/Off-duty: Assign is replaced by a deliberate, recorded Override. */}
                    {needsOverride ? (
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full border-[#D84315] text-[#D84315] hover:bg-[#D84315]/10 hover:text-[#D84315] dark:border-[#FF8A65] dark:text-[#FF8A65] dark:hover:text-[#FF8A65]"
                            disabled={isSubmitting}
                            onClick={startOverride}
                        >
                            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <MdWarningAmber />}
                            Override: {availabilityLabel(selected.status).toLowerCase()}
                        </Button>
                    ) : (
                        <Button size="lg" className="w-full" disabled={isSubmitting || selected === null} onClick={() => assign()}>
                            {isSubmitting && <LoaderCircle className="animate-spin" />}
                            {selected === null ? 'Select a technician' : `Assign to ${selected.fullName}`}
                        </Button>
                    )}
                </DialogContent>
            </Dialog>

            {selected && (
                <ReasonPickerDialog
                    open={overrideReasons !== null}
                    onOpenChange={(next) => !next && setOverrideReasons(null)}
                    title={`Override: assign to ${selected.fullName}`}
                    reasons={overrideReasons ?? []}
                    confirmLabel="Assign anyway"
                    destructive
                    header={<OverrideWarning technician={selected} />}
                    onConfirm={(choice) => {
                        // Errors surface in the picker, which stays open underneath.
                        void assign(choice);
                    }}
                />
            )}
        </>
    );
}

/** What a technician is tied up with: ticket, station, and how long. */
function RosterDetail({ technician, isCurrent }: { technician: TechnicianAvailability; isCurrent: boolean }) {
    const lines = [
        ...(isCurrent ? ['Current assignee'] : []),
        ...(technician.role === 'Cluster Engineer' ? ['Cluster Engineer'] : []),
        ...technician.busyWith.map((busy) => `On ${busyTicketSummary(busy)}${busy.isOverride ? ' · override' : ''}`),
        ...(technician.pendingResponseCount > 0
            ? [`${technician.pendingResponseCount} assignment${technician.pendingResponseCount === 1 ? '' : 's'} awaiting response`]
            : []),
        ...(technician.status === 'off_duty' ? ['Off duty'] : []),
    ];

    return (
        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {lines.length === 0 ? 'No open tickets' : lines.map((line) => <span key={line} className="block">{line}</span>)}
        </span>
    );
}

/** States exactly what the technician is currently working on, so the override is a deliberate choice. */
function OverrideWarning({ technician }: { technician: TechnicianAvailability }) {
    const work = technician.busyWith.length === 0 ? null : technician.busyWith.map(busyTicketSummary).join(', ');
    const text =
        technician.status === 'off_duty'
            ? `${technician.fullName} is off duty${work ? ` and still holds ${work}` : ''}.`
            : `${technician.fullName} is currently working on ${work ?? 'another ticket'}.`;

    return (
        <div className="rounded-xl border border-[#D84315]/30 bg-[#D84315]/8 p-3 dark:bg-[#D84315]/15">
            <p className="text-[13.5px] font-semibold text-[#BF360C] dark:text-[#FFAB91]">{text}</p>
            <p className="text-muted-foreground mt-1 text-[12.5px]">
                This will be recorded as an override and flagged in their queue and in reporting. They stay Busy and will hold both tickets.
            </p>
        </div>
    );
}
