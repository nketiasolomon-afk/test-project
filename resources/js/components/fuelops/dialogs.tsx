import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api';
import { LoaderCircle } from '@/components/icons';
import { useEffect, useState } from 'react';

interface ActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel: string;
    /** Styles the confirm button as a destructive action. */
    destructive?: boolean;
}

/**
 * Asks the user to confirm an action. `onConfirm` may be async: the dialog shows
 * progress, closes when it resolves, and shows the error if it throws.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive,
    onConfirm,
}: ActionDialogProps & { onConfirm: () => void | Promise<void> }) {
    const { busy, error, run } = useDialogAction(open, onOpenChange);

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant={destructive ? 'destructive' : 'default'} onClick={() => run(onConfirm)} disabled={busy}>
                        {busy && <LoaderCircle className="animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Asks for a free-text reason or note before an action. With `required` (the default)
 * the confirm button stays disabled until something is typed.
 */
export function ReasonDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive,
    placeholder = 'Reason',
    required = true,
    onConfirm,
}: ActionDialogProps & {
    placeholder?: string;
    required?: boolean;
    onConfirm: (reason: string) => void | Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const { busy, error, run } = useDialogAction(open, onOpenChange);

    useEffect(() => {
        if (open) setReason('');
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <Textarea
                    autoFocus
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                />
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={() => run(() => onConfirm(reason.trim()))}
                        disabled={busy || (required && reason.trim() === '')}
                    >
                        {busy && <LoaderCircle className="animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Runs a dialog's confirm action: tracks progress, closes on success, keeps the dialog open with the error on failure. */
function useDialogAction(open: boolean, onOpenChange: (open: boolean) => void) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const run = async (action: () => void | Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    return { busy, error, run };
}
