import { useApiQuery } from '@/hooks/use-api-query';
import { formatDateTime } from '@/lib/format';
import { tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type TicketEvent } from '@/types/fuelops';
import {
    type IconType,
    LoaderCircle,
    MdAssignmentTurnedIn,
    MdCancel,
    MdCircleOutline,
    MdPersonAddAlt1,
    MdPlayCircleFill,
    MdReplay,
    MdThumbDownAlt,
    MdThumbUpAlt,
    MdTimerOff,
    MdVerified,
    MdWarningAmber,
} from '@/components/icons';

function eventTitle(event: TicketEvent): string {
    const tech = event.technicianName || 'technician';
    switch (event.type) {
        case 'RAISED':
            return 'Ticket raised';
        case 'ASSIGN':
            return `Assigned to ${tech}`;
        case 'REASSIGN':
            return `Reassigned to ${tech}`;
        case 'OVERRIDE_ASSIGN':
            return `Override: assigned to ${tech} while unavailable`;
        case 'ACCEPT':
            return `Accepted by ${tech}`;
        case 'DECLINE':
            return `Declined by ${tech}`;
        case 'START':
            return 'Work started';
        case 'JOB_CARD_SUBMIT':
            return 'Job card submitted';
        case 'RESTORATION_CONFIRMED':
            return 'Restoration confirmed';
        case 'CLOSE':
            return 'Closed';
        case 'FORCE_CLOSE':
            return 'Force-closed';
        case 'REOPEN':
            return 'Reopened';
        case 'CANCEL':
            return 'Cancelled';
        case 'RESPONSE_OVERDUE':
            return 'No response within the response window';
        case 'MIGRATED':
            return 'Moved to the new dispatch flow';
        default:
            return event.type;
    }
}

const EVENT_ICONS: Record<string, IconType> = {
    ASSIGN: MdPersonAddAlt1,
    REASSIGN: MdPersonAddAlt1,
    OVERRIDE_ASSIGN: MdWarningAmber,
    ACCEPT: MdThumbUpAlt,
    DECLINE: MdThumbDownAlt,
    START: MdPlayCircleFill,
    JOB_CARD_SUBMIT: MdAssignmentTurnedIn,
    RESTORATION_CONFIRMED: MdVerified,
    CLOSE: MdVerified,
    REOPEN: MdReplay,
    CANCEL: MdCancel,
    FORCE_CLOSE: MdCancel,
    RESPONSE_OVERDUE: MdTimerOff,
};

const ATTENTION_EVENTS = ['OVERRIDE_ASSIGN', 'DECLINE', 'RESPONSE_OVERDUE'];

/**
 * Every assign, accept, decline, override and reassign on a ticket, with timestamps
 * and actors. Pass a changing `refreshKey` (e.g. the ticket's dispatch state) to reload it.
 */
export function AssignmentHistory({ ticketId, refreshKey }: { ticketId: string; refreshKey?: unknown }) {
    const events = useApiQuery(() => tickets.events(ticketId), [ticketId, refreshKey]);

    if (events.isLoading) {
        return (
            <div className="flex justify-center p-4">
                <LoaderCircle className="text-muted-foreground size-5 animate-spin" />
            </div>
        );
    }
    if (events.data === undefined) return <p className="text-[12.5px] text-red-500 dark:text-red-400">{events.error}</p>;
    if (events.data.length === 0) return <p className="text-muted-foreground text-[13px]">No assignment activity yet.</p>;

    return (
        <ol>
            {events.data.map((event, index) => {
                const Icon = EVENT_ICONS[event.type] ?? MdCircleOutline;
                const isLast = index === events.data!.length - 1;
                const detail = [
                    event.actorName ? `${event.actorName}${event.actorRole ? ` (${event.actorRole})` : ''}` : null,
                    formatDateTime(event.createdAt),
                ]
                    .filter(Boolean)
                    .join(' · ');
                const why = [event.reason, event.note].filter((text): text is string => !!text).join(': ');
                return (
                    <li key={event.id || index} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                            <Icon
                                className={cn(
                                    'size-[18px] shrink-0',
                                    ATTENTION_EVENTS.includes(event.type) ? 'text-[#D84315] dark:text-[#FF8A65]' : 'text-primary dark:text-[#5AA3E0]',
                                )}
                            />
                            {!isLast && <span className="my-1 w-[1.5px] flex-1 bg-slate-400/30" />}
                        </div>
                        <div className="min-w-0 pb-3.5">
                            <p className="text-[13.5px] leading-snug font-semibold">{eventTitle(event)}</p>
                            <p className="text-muted-foreground mt-0.5 text-[11.5px]">{detail}</p>
                            {why && <p className="text-foreground/80 mt-0.5 text-xs">{why}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
