import { DeclineNotice, DispatchStateChip, OverrideFlag, PriorityChip, ResponseOverdueChip } from '@/components/dispatch/chips';
import { formatDateTime } from '@/lib/format';
import { type Ticket } from '@/types/fuelops';
import { CirclePlay, ClipboardCheck, Clock, HardHat, type LucideIcon, Phone, ThumbsUp, UserRound } from 'lucide-react';

/** Who's coming, whether they've accepted, and when each step happened. */
export function TicketAssignmentPanel({ ticket }: { ticket: Ticket }) {
    const rows: [LucideIcon, string, string][] = [[HardHat, 'Technician', ticket.assignee?.fullName || 'Not assigned yet']];
    if (ticket.assignee?.phone) rows.push([Phone, 'Phone', ticket.assignee.phone]);
    if (ticket.assignedBy) rows.push([UserRound, 'Assigned by', ticket.assignedBy.fullName]);
    if (ticket.assignedAt) rows.push([Clock, 'Assigned', formatDateTime(ticket.assignedAt)]);
    rows.push([
        ThumbsUp,
        'Accepted',
        ticket.acceptedAt ? formatDateTime(ticket.acceptedAt) : ticket.dispatchState === 'ASSIGNED' ? 'Awaiting response' : '-',
    ]);
    if (ticket.startedAt) rows.push([CirclePlay, 'On site', formatDateTime(ticket.startedAt)]);
    if (ticket.jobCardSubmittedAt) rows.push([ClipboardCheck, 'Job card', formatDateTime(ticket.jobCardSubmittedAt)]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                <DispatchStateChip state={ticket.dispatchState} />
                <PriorityChip priority={ticket.priority} />
                {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                {ticket.responseOverdue && <ResponseOverdueChip />}
            </div>
            {ticket.lastDecline && <DeclineNotice decline={ticket.lastDecline} />}
            <dl className="space-y-2 text-sm">
                {rows.map(([Icon, label, value]) => (
                    <div key={label} className="flex items-start gap-2.5">
                        <Icon className="text-primary mt-0.5 size-4 shrink-0" />
                        <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                    </div>
                ))}
            </dl>
            {ticket.isOverrideAssignment && ticket.overrideNote && (
                <p className="text-muted-foreground text-xs">Override note: {ticket.overrideNote}</p>
            )}
        </div>
    );
}
