import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { SearchPicker } from '@/components/fuelops/search-picker';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatQuantity, type Tone } from '@/lib/format';
import { miniStore, products } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type PendingRestockApproval, type RestockRequest, type WarehouseProduct } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { IconTile } from '@/components/fuelops/icon-tile';
import { LoaderCircle, MdAdd, MdCheckCircleOutline, MdEngineering, MdInventory2Outline, MdStorefront } from '@/components/icons';
import { useEffect, useState } from 'react';

function statusTone(status: string): Tone {
    switch (status.toUpperCase()) {
        case 'ISSUED':
            return 'blue';
        case 'RECEIVED':
            return 'emerald';
        case 'PART_RECEIVED':
            return 'amber';
        case 'REJECTED':
        case 'CLUSTER_REJECTED':
            return 'red';
        default:
            return 'purple';
    }
}

export default function ClusterMiniStore() {
    const { auth } = usePage<SharedData>().props;
    const allowed = auth.user.isClusterLeader;
    const data = useApiQuery(
        async () => {
            const [clusterStock, restocks, pendingApprovals] = await Promise.all([
                miniStore.cluster(),
                miniStore.myRestocks(),
                miniStore.pendingRestockApprovals(),
            ]);
            return { clusterStock, restocks, pendingApprovals };
        },
        [],
        { enabled: allowed },
    );

    const [note, setNote] = useState('');
    const [picking, setPicking] = useState(false);
    const [product, setProduct] = useState<WarehouseProduct | null>(null);
    const [receiving, setReceiving] = useState<RestockRequest | null>(null);
    const [rejecting, setRejecting] = useState<PendingRestockApproval | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);

    const approve = async (approval: PendingRestockApproval) => {
        setApprovingId(approval.id);
        try {
            await miniStore.approveRestock(approval.id);
            toast.success(`Approved ${approval.productName} for ${approval.technicianName}`);
            data.reload();
        } catch (e) {
            toast.error(errorText(e));
        } finally {
            setApprovingId(null);
        }
    };

    return (
        <Page
            title="Mini Store"
            description="Your cluster's stock & restock requests"
            back={{ href: '/dashboard', label: 'Dashboard' }}
            width="wide"
        >
            {!allowed ? (
                <EmptyState icon={MdStorefront} title="For Cluster Leaders" description="The cluster mini store is a Cluster Leader module." />
            ) : (
                <QueryView query={data}>
                    {({ clusterStock, restocks, pendingApprovals }) => (
                        <div className="space-y-7">
                            <div className="bg-card shadow-card rounded-2xl border p-4 lg:max-w-2xl">
                                <div className="flex items-center gap-3">
                                    <IconTile icon={MdInventory2Outline} className="text-primary" />
                                    <h2 className="text-brand-ink text-base font-bold dark:text-white">Raise a Restock Request</h2>
                                </div>
                                <div className="mt-3.5 space-y-3">
                                    <Field label="Note (optional)" htmlFor="restock-note">
                                        <Textarea id="restock-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                                    </Field>
                                    <Button variant="outline" className="w-full" onClick={() => setPicking(true)}>
                                        <MdAdd /> Select Item &amp; Request
                                    </Button>
                                </div>
                            </div>

                            <Section title="Pending Team Requests">
                                {pendingApprovals.length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No requests awaiting your approval.</p>
                                ) : (
                                    <ul className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                                        {pendingApprovals.map((approval) => (
                                            <li
                                                key={approval.id}
                                                className="bg-card shadow-card rounded-[14px] border border-[#6D28D9]/30 p-3.5 dark:border-[#A78BFA]/35"
                                            >
                                                <p className="text-muted-foreground text-xs font-semibold">{approval.technicianName}</p>
                                                <p className="text-brand-ink mt-0.5 text-[15px] font-bold dark:text-white">
                                                    {approval.productName} × {approval.requestedQuantity}
                                                </p>
                                                {approval.note && <p className="text-muted-foreground/80 mt-1 text-xs italic">{approval.note}</p>}
                                                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                                                    <Button
                                                        variant="outline"
                                                        className="border-red-200 text-red-700 hover:bg-red-600/8 hover:text-red-700 dark:border-red-400/40 dark:text-red-400"
                                                        onClick={() => setRejecting(approval)}
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        className="bg-[#2E7D32] text-white hover:bg-[#2E7D32]/90"
                                                        disabled={approvingId === approval.id}
                                                        onClick={() => approve(approval)}
                                                    >
                                                        {approvingId === approval.id && <LoaderCircle className="animate-spin" />}
                                                        Approve
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title="My Restock Requests">
                                {restocks.length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No restock requests yet.</p>
                                ) : (
                                    <ul className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                                        {restocks.map((request) => (
                                            <li key={request.id} className="bg-card shadow-card rounded-[14px] border p-3.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-brand-ink min-w-0 text-sm font-semibold dark:text-white">
                                                        {request.productName}
                                                    </span>
                                                    <Pill
                                                        tone={statusTone(request.status)}
                                                        className="rounded-full px-2 py-[3px] text-[10px] font-semibold"
                                                    >
                                                        {request.status}
                                                    </Pill>
                                                </div>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    Requested {request.requestedQuantity}
                                                    {request.receivedQuantity != null
                                                        ? ` · received ${request.receivedQuantity}`
                                                        : request.issuedQuantity != null
                                                          ? ` · dispatched ${request.issuedQuantity}`
                                                          : ''}
                                                </p>
                                                {request.status === 'CLUSTER_REJECTED' && request.clusterDecisionNote && (
                                                    <p className="mt-1.5 text-[11px] text-red-500 italic dark:text-red-300">
                                                        {request.clusterDecisionNote}
                                                    </p>
                                                )}
                                                {request.status === 'ISSUED' && (
                                                    <div className="mt-2.5 flex justify-end">
                                                        <Button size="sm" onClick={() => setReceiving(request)}>
                                                            <MdCheckCircleOutline /> Confirm receipt
                                                        </Button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title="Cluster Stock">
                                {clusterStock.length === 0 ? (
                                    <p className="text-muted-foreground text-[13px]">No stock held by your team yet.</p>
                                ) : (
                                    <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                        {clusterStock.map((entry) => (
                                            <div key={entry.technicianId} className="bg-card shadow-card rounded-[14px] border p-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <IconTile icon={MdEngineering} size="sm" className="text-primary" />
                                                    <p className="text-brand-ink min-w-0 truncate text-sm font-semibold dark:text-white">
                                                        {entry.technicianName}
                                                    </p>
                                                </div>
                                                {entry.items.length === 0 ? (
                                                    <p className="text-muted-foreground mt-2 text-xs">No stock held</p>
                                                ) : (
                                                    <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                                                        {entry.items.map((item) => (
                                                            <li key={item.miniStoreItemId || item.productId}>
                                                                {item.productName} · {formatQuantity(item.quantity)}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Section>
                        </div>
                    )}
                </QueryView>
            )}

            <SearchPicker<WarehouseProduct>
                open={picking}
                onOpenChange={setPicking}
                title="Select Item"
                placeholder="Search warehouse items"
                search={(query, signal) => products.search(query, null, signal)}
                getKey={(p) => `${p.productId}-${p.warehouseId}`}
                renderItem={(p) => (
                    <>
                        <span className="block font-medium">{p.productName}</span>
                        <span className="text-muted-foreground block text-xs">
                            In stock: {Math.round(p.quantity)} · You have: {Math.round(p.myHolding)}
                        </span>
                    </>
                )}
                onSelect={setProduct}
            />

            <RestockQuantityDialog
                product={product}
                onOpenChange={(open) => !open && setProduct(null)}
                onSubmit={async (quantity) => {
                    if (!product) return;
                    await miniStore.submitRestock({ productId: product.productId, quantity, note: note.trim() || null });
                    setNote('');
                    toast.success('Restock request submitted');
                    data.reload();
                }}
            />

            <ReceiveDialog
                request={receiving}
                onOpenChange={(open) => !open && setReceiving(null)}
                onReceived={(request) => {
                    toast.success(`Receipt recorded for ${request.productName}`);
                    data.reload();
                }}
            />

            <ReasonDialog
                open={rejecting !== null}
                onOpenChange={(open) => !open && setRejecting(null)}
                title={`Reject ${rejecting?.productName ?? ''}?`}
                confirmLabel="Reject"
                destructive
                placeholder="Reason (required)"
                onConfirm={async (reason) => {
                    if (!rejecting) return;
                    if (reason.length < 5) throw new Error('Enter a reason (at least 5 characters)');
                    await miniStore.rejectRestock(rejecting.id, reason);
                    toast.success(`Rejected ${rejecting.productName}`);
                    data.reload();
                }}
            />
        </Page>
    );
}

function RestockQuantityDialog({
    product,
    onOpenChange,
    onSubmit,
}: {
    product: WarehouseProduct | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (quantity: number) => Promise<void>;
}) {
    const [quantity, setQuantity] = useState('1');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setQuantity('1');
            setError(null);
        }
    }, [product]);

    const submit = async () => {
        const qty = Number.parseInt(quantity.trim(), 10);
        if (!Number.isInteger(qty) || qty < 1) {
            setError('Enter a valid quantity');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onSubmit(qty);
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={product !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Quantity for {product?.productName}</DialogTitle>
                </DialogHeader>
                <Field label="Quantity" htmlFor="restock-qty">
                    <Input id="restock-qty" type="number" min={1} autoFocus value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </Field>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={busy} onClick={submit}>
                        {busy && <LoaderCircle className="animate-spin" />}
                        Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ReceiveDialog({
    request,
    onOpenChange,
    onReceived,
}: {
    request: RestockRequest | null;
    onOpenChange: (open: boolean) => void;
    onReceived: (request: RestockRequest) => void;
}) {
    const expected = request?.issuedQuantity ?? request?.approvedQuantity ?? 0;
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (request) {
            setQuantity(String(request.issuedQuantity ?? request.approvedQuantity ?? 0));
            setNote('');
            setError(null);
        }
    }, [request]);

    const confirm = async () => {
        if (!request) return;
        const qty = Number.parseInt(quantity.trim(), 10);
        if (!Number.isInteger(qty) || qty < 1) {
            setError('Enter a valid quantity');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await miniStore.receiveRestock(request.id, qty, note.trim() || null);
            onReceived(request);
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={request !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Receive {request?.productName}</DialogTitle>
                    <DialogDescription>Dispatched: {expected} unit(s)</DialogDescription>
                </DialogHeader>
                <Field label="Quantity received" htmlFor="receive-qty">
                    <Input id="receive-qty" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </Field>
                <Field label="Note (required if short or damaged)" htmlFor="receive-note">
                    <Textarea id="receive-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={busy} onClick={confirm}>
                        {busy && <LoaderCircle className="animate-spin" />}
                        Confirm Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
