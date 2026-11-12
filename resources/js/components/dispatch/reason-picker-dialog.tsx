import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api';
import { type DispatchReason } from '@/types/fuelops';
import { LoaderCircle } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/** A reason picked from a controlled list, plus an optional note (required for reasons like "Other"). */
export interface ReasonChoice {
    code: string;
    note: string | null;
}

/**
 * Radio list of controlled reasons plus a note field, used for decline and override.
 * `header` is shown above the list, e.g. what the technician is busy with. `onConfirm`
 * may be async: the dialog closes when it resolves and shows the error if it throws.
 */
export function ReasonPickerDialog({
    open,
    onOpenChange,
    title,
    reasons,
    confirmLabel,
    header,
    destructive,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    reasons: DispatchReason[];
    confirmLabel: string;
    header?: React.ReactNode;
    destructive?: boolean;
    onConfirm: (choice: ReasonChoice) => void | Promise<void>;
}) {
    const [code, setCode] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setCode(null);
            setNote('');
            setError(null);
        }
    }, [open]);

    const noteRequired = reasons.some((reason) => reason.code === code && reason.requiresNote);
    const canConfirm = code !== null && (!noteRequired || note.trim() !== '');

    const confirm = async () => {
        if (code === null) return;
        setBusy(true);
        setError(null);
        try {
            await onConfirm({ code, note: note.trim() || null });
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                {header}
                <fieldset className="-mx-1 space-y-0.5">
                    <legend className="sr-only">Reason</legend>
                    {reasons.map((reason) => (
                        <label
                            key={reason.code}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors',
                                code === reason.code ? 'bg-primary/8 dark:bg-primary/20 font-medium' : 'hover:bg-accent',
                            )}
                        >
                            <input
                                type="radio"
                                name="dispatch-reason"
                                className="accent-primary size-[18px] shrink-0"
                                checked={code === reason.code}
                                onChange={() => setCode(reason.code)}
                            />
                            {reason.label}
                        </label>
                    ))}
                </fieldset>
                <Textarea
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={noteRequired ? 'Describe the reason (required)' : 'Add a note (optional)'}
                    aria-label="Note"
                />
                {error && <p className="text-[12.5px] text-red-600 dark:text-red-400">{error}</p>}
                <Button variant={destructive ? 'destructive' : 'default'} size="lg" className="w-full" disabled={!canConfirm || busy} onClick={confirm}>
                    {busy && <LoaderCircle className="animate-spin" />}
                    {confirmLabel}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
