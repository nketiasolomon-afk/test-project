/** Display helpers shared by the pages: dates, durations and the status vocabularies of the ERP. */

import type { Ticket } from '@/types/fuelops';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(value?: string | Date | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** e.g. "Aug 4, 2026". */
export function formatDate(value?: string | Date | null, fallback = '-'): string {
    const date = parseDate(value);
    return date ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}` : fallback;
}

/** e.g. "Aug 4, 14:05". */
export function formatDateTime(value?: string | Date | null, fallback = '-'): string {
    const date = parseDate(value);
    if (!date) return fallback;
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${time}`;
}

/** The value for an `<input type="date">`. */
export function toDateInputValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Reads an `<input type="date">` value as a local date (not UTC midnight). */
export function fromDateInputValue(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** e.g. "45m", "2h 5m", "3d 4h". */
export function formatDurationMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours < 24) return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Compact "time ago": "just now", "5m ago", "3h ago", "2d ago", then "Aug 4". */
export function timeAgo(value?: string | Date | null): string {
    const date = parseDate(value);
    if (!date) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** How long ago something happened as a duration: "just now" or "2h 5m ago". */
export function ageLabel(since?: string | Date | null): string {
    const date = parseDate(since);
    if (!date) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    return minutes < 1 ? 'just now' : `${formatDurationMinutes(minutes)} ago`;
}

/** Trims trailing zeros from a quantity: 2 -> "2", 0.75 -> "0.75". */
export function formatQuantity(quantity: number): string {
    return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

export function initials(fullName: string): string {
    const names = fullName.trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
}

/**
 * A colour for a status pill. `tone` picks the pill's palette (see components/fuelops/pill.tsx).
 */
export type Tone = 'blue' | 'indigo' | 'amber' | 'orange' | 'red' | 'green' | 'emerald' | 'purple' | 'teal' | 'slate';

// ---- Dispatch states (Ticket.dispatchState) ----

export const DISPATCH_HELD_STATES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];

export function dispatchStateLabel(state?: string | null): string {
    switch (state) {
        case 'NEW':
            return 'Awaiting assignment';
        case 'ASSIGNED':
            return 'Awaiting response';
        case 'DECLINED':
            return 'Declined';
        case 'ACCEPTED':
            return 'Accepted';
        case 'IN_PROGRESS':
            return 'In progress';
        case 'JOB_CARD_SUBMITTED':
            return 'Job card submitted';
        case 'CLOSED':
            return 'Closed';
        case 'REOPENED':
            return 'Reopened';
        case 'CANCELLED':
            return 'Cancelled';
        default:
            return state ?? '';
    }
}

export function dispatchStateTone(state?: string | null): Tone {
    switch (state) {
        case 'NEW':
            return 'indigo';
        case 'ASSIGNED':
            return 'amber';
        case 'DECLINED':
        case 'REOPENED':
            return 'red';
        case 'ACCEPTED':
            return 'blue';
        case 'IN_PROGRESS':
            return 'orange';
        case 'JOB_CARD_SUBMITTED':
            return 'green';
        case 'CLOSED':
            return 'emerald';
        default:
            return 'slate';
    }
}

// ---- Ticket status (Ticket.status, the collapsed one) ----

export function ticketStatusLabel(status: string): string {
    switch (status) {
        case 'assigned':
            return 'Ready to Start';
        case 'done':
            return 'Awaiting Confirmation';
        case 'confirmed':
            return 'Confirmed';
        case 'rejected':
            return 'Rejected - Resubmit';
        default:
            return status;
    }
}

export function ticketStatusTone(status: string): Tone {
    switch (status) {
        case 'assigned':
            return 'blue';
        case 'done':
            return 'orange';
        case 'confirmed':
            return 'green';
        case 'rejected':
            return 'red';
        default:
            return 'slate';
    }
}

// ---- Ticket rules (mirroring the mobile app's Ticket getters) ----

/**
 * Whether the ticket is waiting on the current user to accept or decline it. Dispatch-managed
 * tickets always carry a reliable flag; older ones are inferred from status when the flag is missing.
 */
export function needsAcceptDecision(ticket: Ticket): boolean {
    return ticket.isDispatchManaged ? ticket.canAccept : ticket.canAccept || (ticket.status === 'assigned' && !ticket.acceptedAt);
}

/** Whether the job-card form is usable: for dispatch-managed tickets only after Accept then Start. */
export function jobCardUnlocked(ticket: Ticket): boolean {
    return ticket.isDispatchManaged ? ticket.canSubmitJobCard : !needsAcceptDecision(ticket);
}

/** CCTV tickets arrive as ordinary tickets; `source` is authoritative, the text match covers older API versions. */
export function isCctvRelated(ticket: Pick<Ticket, 'source' | 'issueType' | 'description'>): boolean {
    return [ticket.source, ticket.issueType, ticket.description].some((text) => (text ?? '').toLowerCase().includes('cctv'));
}

/** Technicians keep read-only visibility of cluster tickets they don't hold. */
export function isReadOnlyForMe(ticket: Ticket): boolean {
    return (
        ticket.isDispatchManaged &&
        !ticket.isMine &&
        !ticket.canAssign &&
        !ticket.canCancel &&
        !ticket.canReopen &&
        !ticket.canStationValidate &&
        !ticket.canValidate
    );
}

// ---- Technician availability ----

export function availabilityLabel(status: string): string {
    return status === 'busy' ? 'Busy' : status === 'off_duty' ? 'Off duty' : 'Available';
}

export function availabilityTone(status: string): Tone {
    return status === 'busy' ? 'orange' : status === 'off_duty' ? 'slate' : 'green';
}

/** e.g. "TKT-12 at Adenta (2h 5m)". */
export function busyTicketSummary(busy: { ticketId: string; stationName?: string | null; minutesOnIt?: number | null }): string {
    const where = busy.stationName ? ` at ${busy.stationName}` : '';
    const howLong = busy.minutesOnIt == null ? '' : ` (${formatDurationMinutes(busy.minutesOnIt)})`;
    return `${busy.ticketId}${where}${howLong}`;
}

/** Travel modes offered on the daily-update "Mode of Transport" pickers, matching the ERP web app. */
export const TRANSPORT_MODES = ['Company Vehicle', 'Motorbike', 'Public Transport', 'Walking', 'Ride Hailing', 'Other'];
