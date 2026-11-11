import { Pill } from '@/components/fuelops/pill';
import { ageLabel, availabilityLabel, availabilityTone, dispatchStateLabel, dispatchStateTone } from '@/lib/format';
import { type TicketDecline } from '@/types/fuelops';
import { Ban, CheckCircle2, Flag, HardHat, ThumbsDown, TimerOff, TriangleAlert, Video, Wrench } from 'lucide-react';

/** Shared pieces of the ticket assignment & acceptance flow UI. */

export function DispatchStateChip({ state }: { state?: string | null }) {
    if (!state) return null;
    return <Pill tone={dispatchStateTone(state)}>{dispatchStateLabel(state)}</Pill>;
}

/** Overridden assignments are visibly flagged wherever they appear. */
export function OverrideFlag({ reason }: { reason?: string | null }) {
    return (
        <Pill tone="orange" icon={TriangleAlert} title={reason ?? undefined}>
            Override
        </Pill>
    );
}

export function PriorityChip({ priority }: { priority?: string | null }) {
    const p = (priority ?? '').toUpperCase();
    if (p === '') return null;
    return (
        <Pill tone={p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'orange' : 'slate'} icon={Flag}>
            {p.charAt(0) + p.slice(1).toLowerCase()}
        </Pill>
    );
}

export function ResponseOverdueChip() {
    return (
        <Pill tone="red" icon={TimerOff}>
            No response yet
        </Pill>
    );
}

/**
 * Says what kind of work a card is, so CCTV work stands apart from ordinary Operations
 * tickets at a glance: an FMS CCTV fault ticket, a CCTV requisition, or anything else.
 */
export function TicketTypeTag({ type }: { type: 'cctv' | 'cctv-requisition' | 'operations' }) {
    if (type === 'operations') {
        return (
            <Pill tone="blue" icon={Wrench}>
                Operations
            </Pill>
        );
    }
    return (
        <Pill tone="purple" icon={Video}>
            {type === 'cctv' ? 'CCTV' : 'CCTV Requisition'}
        </Pill>
    );
}

export function AvailabilityBadge({ status }: { status: string }) {
    return (
        <Pill tone={availabilityTone(status)} icon={status === 'busy' ? HardHat : status === 'off_duty' ? Ban : CheckCircle2}>
            {availabilityLabel(status)}
        </Pill>
    );
}

/** Why the last technician declined, for the leader deciding who to assign next. */
export function DeclineNotice({ decline }: { decline: TicketDecline }) {
    const why = [decline.reason, decline.note].filter((text): text is string => !!text).join(': ');
    return (
        <div className="flex items-start gap-2 rounded-lg border border-red-600/25 bg-red-600/5 p-2.5 text-sm text-red-900 dark:text-red-200">
            <ThumbsDown className="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400" />
            <p>
                Declined by {decline.technicianName || 'A technician'}
                {decline.declinedAt ? ` (${ageLabel(decline.declinedAt)})` : ''}
                {why ? ` · ${why}` : ''}
            </p>
        </div>
    );
}
