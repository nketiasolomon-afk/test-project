import { ReasonPickerDialog } from '@/components/dispatch/reason-picker-dialog';
import { useApiQuery } from '@/hooks/use-api-query';
import { dispatch } from '@/lib/fuelops-api';
import { type Ticket } from '@/types/fuelops';

/**
 * The technician's decline flow for a dispatch-managed ticket: pick a reason, then decline.
 * `onDeclined` receives the updated ticket.
 */
export function DeclineDialog({
    ticket,
    open,
    onOpenChange,
    onDeclined,
}: {
    ticket: Ticket;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeclined: (ticket: Ticket) => void;
}) {
    const reasons = useApiQuery(() => dispatch.reasons(), [], { enabled: open });

    return (
        <ReasonPickerDialog
            open={open}
            onOpenChange={onOpenChange}
            title={`Decline ${ticket.ticketId}`}
            reasons={reasons.data?.decline ?? []}
            confirmLabel="Decline assignment"
            destructive
            header={
                <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                        Your Cluster Leader will see who declined and why, and reassign the ticket.
                    </p>
                    {reasons.isLoading && <p className="text-muted-foreground text-sm">Loading reasons...</p>}
                    {reasons.error && <p className="text-sm text-red-600 dark:text-red-400">{reasons.error}</p>}
                </div>
            }
            onConfirm={async (choice) => {
                onDeclined(await dispatch.decline(ticket, choice.code, choice.note));
            }}
        />
    );
}
