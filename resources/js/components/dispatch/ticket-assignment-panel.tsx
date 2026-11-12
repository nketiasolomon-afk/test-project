import { DeclineNotice, DispatchStateChip, OverrideFlag, PriorityChip, ResponseOverdueChip } from '@/components/dispatch/chips';
import { formatDateTime } from '@/lib/format';
import { type Ticket } from '@/types/fuelops';
import {
    type IconType,
    MdAssignmentTurnedIn,
    MdEngineering,
    MdPerson,
    MdPhone,
    MdPlayCircleFill,
    MdSchedule,
    MdThumbUpAlt,
} from '@/components/icons';

/** Who's coming, whether they've accepted, and when each step happened. */
export function TicketAssignmentPanel({ ticket }: { ticket: Ticket }) {
    const rows: [IconType, string, string][] = [[MdEngineering, 'Technician', ticket.assignee?.fullName || 'Not assigned yet']];
    if (ticket.assignee?.phone) rows.push([MdPhone, 'Phone', ticket.assignee.phone]);
    if (ticket.assignedBy) rows.push([MdPerson, 'Assigned by', ticket.assignedBy.fullName]);
    if (ticket.assignedAt) rows.push([MdSchedule, 'Assigned', formatDateTime(ticket.assignedAt)]);
    rows.push([
        MdThumbUpAlt,
        'Accepted',
        ticket.acceptedAt ? formatDateTime(ticket.acceptedAt) : ticket.dispatchState === 'ASSIGNED' ? 'Awaiting response' : '-',
    ]);
    if (ticket.startedAt) rows.push([MdPlayCircleFill, 'On site', formatDateTime(ticket.startedAt)]);
    if (ticket.jobCardSubmittedAt) rows.push([MdAssignmentTurnedIn, 'Job card', formatDateTime(ticket.jobCardSubmittedAt)]);

    return (
        <div>
            <div className="flex flex-wrap gap-1.5">
                <DispatchStateChip state={ticket.dispatchState} />
                <PriorityChip priority={ticket.priority} />
                {ticket.isOverrideAssignment && <OverrideFlag reason={ticket.overrideReason} />}
                {ticket.responseOverdue && <ResponseOverdueChip />}
            </div>
            {ticket.lastDecline && <DeclineNotice decline={ticket.lastDecline} className="mt-2.5" />}
            <dl className="mt-1.5">
                {rows.map(([Icon, label, value]) => (
                    <div key={label} className="flex items-start gap-2.5 py-1.5">
                        <Icon className="text-primary mt-0.5 size-4 shrink-0 dark:text-[#5AA3E0]" />
                        <dt className="text-muted-foreground w-[92px] shrink-0 text-[12.5px] leading-5">{label}</dt>
                        <dd className="min-w-0 text-[13.5px] leading-5 font-medium break-words">{value}</dd>
                    </div>
                ))}
            </dl>
            {ticket.isOverrideAssignment && ticket.overrideNote && (
                <p className="text-muted-foreground mt-1 text-xs">Override note: {ticket.overrideNote}</p>
            )}
        </div>
    );
}
