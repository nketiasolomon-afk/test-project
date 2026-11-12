import { Pill } from '@/components/fuelops/pill';
import { ageLabel, availabilityLabel, availabilityTone, dispatchStateLabel, dispatchStateTone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type TicketDecline } from '@/types/fuelops';
import { MdBuild, MdCheckCircle, MdDoNotDisturbOn, MdEngineering, MdFlag, MdThumbDownAlt, MdTimerOff, MdVideocam, MdWarningAmber } from '@/components/icons';

/** Shared pieces of the ticket assignment & acceptance flow UI (the phone's dispatch_widgets.dart). */

/** The phone's dispatch _Pill: semibold 11px text on a 12% tint with a 35% outline of the same colour. */
const DISPATCH_PILL = 'border border-current/35 font-semibold py-[3px]';

export function DispatchStateChip({ state }: { state?: string | null }) {
    if (!state) return null;
    return (
        <Pill tone={dispatchStateTone(state)} className={DISPATCH_PILL}>
            {dispatchStateLabel(state)}
        </Pill>
    );
}

/** Overridden assignments are visibly flagged wherever they appear. */
export function OverrideFlag({ reason }: { reason?: string | null }) {
    return (
        <Pill tone="orange" icon={MdWarningAmber} title={reason ?? undefined} className={DISPATCH_PILL}>
            Override
        </Pill>
    );
}

export function PriorityChip({ priority }: { priority?: string | null }) {
    const p = (priority ?? '').toUpperCase();
    if (p === '') return null;
    return (
        <Pill tone={p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'orange' : 'slate'} icon={MdFlag} className={DISPATCH_PILL}>
            {p.charAt(0) + p.slice(1).toLowerCase()}
        </Pill>
    );
}

export function ResponseOverdueChip() {
    return (
        <Pill tone="red" icon={MdTimerOff} className={DISPATCH_PILL}>
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
            <Pill tone="blue" icon={MdBuild} className={DISPATCH_PILL}>
                Operations
            </Pill>
        );
    }
    return (
        <Pill tone="purple" icon={MdVideocam} className={DISPATCH_PILL}>
            {type === 'cctv' ? 'CCTV' : 'CCTV Requisition'}
        </Pill>
    );
}

export function AvailabilityBadge({ status }: { status: string }) {
    return (
        <Pill
            tone={availabilityTone(status)}
            icon={status === 'busy' ? MdEngineering : status === 'off_duty' ? MdDoNotDisturbOn : MdCheckCircle}
            className={DISPATCH_PILL}
        >
            {availabilityLabel(status)}
        </Pill>
    );
}

/** Why the last technician declined, for the leader deciding who to assign next. */
export function DeclineNotice({ decline, className }: { decline: TicketDecline; className?: string }) {
    const why = [decline.reason, decline.note].filter((text): text is string => !!text).join(': ');
    return (
        <div
            className={cn(
                'flex items-start gap-2 rounded-[10px] border border-red-500/25 bg-red-500/6 p-2.5 text-[12.5px] leading-snug text-red-900 dark:bg-red-500/12 dark:text-red-200',
                className,
            )}
        >
            <MdThumbDownAlt className="mt-px size-4 shrink-0 text-red-700 dark:text-red-400" />
            <p className="min-w-0">
                Declined by {decline.technicianName || 'A technician'}
                {decline.declinedAt ? ` (${ageLabel(decline.declinedAt)})` : ''}
                {why ? ` · ${why}` : ''}
            </p>
        </div>
    );
}
