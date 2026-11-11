import { ConfirmDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { type Tone } from '@/lib/format';
import { inventoryRequests } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type ClusterInventoryRequest } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { ClipboardCheck, Copy, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

function statusTone(status: string): Tone {
    switch (status.toUpperCase()) {
        case 'APPROVED':
            return 'blue';
        case 'ISSUED':
        case 'RECEIVED':
            return 'emerald';
        case 'REJECTED':
            return 'red';
        default:
            return 'amber';
    }
}

export default function ClusterInventoryApprovals() {
    const { auth } = usePage<SharedData>().props;
    const allowed = auth.user.isClusterLeader;
    const requests = useApiQuery(() => inventoryRequests.pendingApprovals(), [], { enabled: allowed });
    const [deciding, setDeciding] = useState<ClusterInventoryRequest | null>(null);
    const [issuing, setIssuing] = useState<ClusterInventoryRequest | null>(null);
    const [issued, setIssued] = useState<ClusterInventoryRequest | null>(null);

    const open = (request: ClusterInventoryRequest) => {
        if (request.status === 'PENDING') setDeciding(request);
        else if (request.status === 'APPROVED') setIssuing(request);
    };

    return (
        <Page
            title="Team Requests"
            description="Fulfil your cluster's stock requests"
            back={{ href: '/dashboard', label: 'Dashboard' }}
            width="narrow"
        >
            {!allowed ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="For Cluster Leaders"
                    description="Approving and issuing team stock requests is a Cluster Leader module."
                />
            ) : (
                <QueryView
                    query={requests}
                    empty={(list) => list.length === 0 && <EmptyState icon={ClipboardCheck} title="No pending requests from your team." />}
                >
                    {(list) => (
                        <ul className="space-y-3">
                            {list.map((request) => {
                                const canAct = request.status === 'PENDING' || request.status === 'APPROVED';
                                return (
                                    <li key={request.ticketNumber} className="bg-card rounded-xl border p-4 shadow-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-semibold">{request.itemName}</span>
                                            <Pill tone={statusTone(request.status)}>{request.status}</Pill>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {request.requesterName} · requested {request.quantityRequested}
                                            {request.quantityApproved != null && ` · approved ${request.quantityApproved}`}
                                        </p>
                                        {request.reason && <p className="text-muted-foreground mt-1 text-sm italic">{request.reason}</p>}
                                        {request.collectionCode && (
                                            <p className="mt-1 text-sm">
                                                Collection code <span className="font-mono font-semibold">{request.collectionCode}</span>
                                                {request.collectionStatus && ` · ${request.collectionStatus}`}
                                            </p>
                                        )}
                                        {canAct && (
                                            <div className="mt-3 flex justify-end">
                                                <Button size="sm" onClick={() => open(request)}>
                                                    {request.status === 'PENDING' ? 'Approve or reject' : 'Issue'}
                                                </Button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </QueryView>
            )}

            <DecisionDialog
                request={deciding}
                onOpenChange={(isOpen) => !isOpen && setDeciding(null)}
                onDone={(message) => {
                    toast.success(message);
                    requests.reload();
                }}
            />

            <ConfirmDialog
                open={issuing !== null}
                onOpenChange={(isOpen) => !isOpen && setIssuing(null)}
                title="Issue to technician"
                description={
                    issuing
                        ? `Issue ${issuing.quantityApproved ?? ''} unit(s) of ${issuing.itemName} to ${issuing.requesterName}? This deducts the warehouse, credits their own inventory and sends them a collection code.`
                        : ''
                }
                confirmLabel="Issue"
                onConfirm={async () => {
                    if (!issuing) return;
                    const result = await inventoryRequests.issue(issuing.ticketNumber);
                    requests.reload();
                    if (result.collectionCode) {
                        setIssued(result);
                    } else {
                        toast.success(`Issued ${issuing.itemName} to ${issuing.requesterName}`);
                    }
                }}
            />

            <Dialog open={issued !== null} onOpenChange={(isOpen) => !isOpen && setIssued(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Issued - collection code</DialogTitle>
                        <DialogDescription>
                            {issued?.quantityApproved ?? ''} x {issued?.itemName} issued to {issued?.requesterName}.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-center font-mono text-3xl font-bold tracking-widest select-all">{issued?.collectionCode}</p>
                    <p className="text-muted-foreground text-sm">
                        The code has been sent to {issued?.requesterName}. They give it to the FMS attendant at the station to collect the items.
                    </p>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                const code = issued?.collectionCode ?? '';
                                try {
                                    await navigator.clipboard.writeText(code);
                                    toast.success(`Code ${code} copied`);
                                } catch {
                                    toast.error('Could not copy the code. Select it and copy it instead.');
                                }
                                setIssued(null);
                            }}
                        >
                            <Copy /> Copy code
                        </Button>
                        <Button onClick={() => setIssued(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}

function DecisionDialog({
    request,
    onOpenChange,
    onDone,
}: {
    request: ClusterInventoryRequest | null;
    onOpenChange: (open: boolean) => void;
    onDone: (message: string) => void;
}) {
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (request) {
            setQuantity(String(request.quantityRequested));
            setNote('');
            setError(null);
        }
    }, [request]);

    const decide = async (action: 'approve' | 'reject') => {
        if (!request) return;
        const trimmedNote = note.trim();
        const qty = Number.parseInt(quantity.trim(), 10);
        if (action === 'approve' && (!Number.isInteger(qty) || qty < 1)) {
            setError('Enter a valid quantity');
            return;
        }
        if (action === 'reject' && trimmedNote === '') {
            setError('A reason is required to reject');
            return;
        }
        setBusy(action);
        setError(null);
        try {
            if (action === 'approve') {
                await inventoryRequests.approve(request.ticketNumber, qty, trimmedNote || null);
                onDone(`Approved ${request.itemName}`);
            } else {
                await inventoryRequests.reject(request.ticketNumber, trimmedNote);
                onDone(`Rejected ${request.itemName}`);
            }
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(null);
        }
    };

    return (
        <Dialog open={request !== null} onOpenChange={(isOpen) => busy === null && onOpenChange(isOpen)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{request?.itemName}</DialogTitle>
                    <DialogDescription>
                        Requested by {request?.requesterName} · qty {request?.quantityRequested}
                    </DialogDescription>
                </DialogHeader>
                <Field label="Approve Qty" htmlFor="approve-qty">
                    <Input id="approve-qty" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </Field>
                <Field label="Note (required if approving less, or rejecting)" htmlFor="approve-note">
                    <Textarea id="approve-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" disabled={busy !== null} onClick={() => decide('reject')}>
                        {busy === 'reject' && <LoaderCircle className="animate-spin" />}
                        Reject
                    </Button>
                    <Button disabled={busy !== null} onClick={() => decide('approve')}>
                        {busy === 'approve' && <LoaderCircle className="animate-spin" />}
                        Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
