import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { SearchPicker } from '@/components/fuelops/search-picker';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDate, formatQuantity, type Tone } from '@/lib/format';
import { inventoryRequests, products } from '@/lib/fuelops-api';
import { type CollectionCode, type InventoryRequest, type WarehouseProduct } from '@/types/fuelops';
import { CircleCheck, Copy, LoaderCircle, PackagePlus, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface RequestLine {
    productId: string;
    productName: string;
    quantity: number;
}

function statusTone(status: string): Tone {
    switch (status.toUpperCase()) {
        case 'APPROVED':
        case 'ISSUED':
            return 'blue';
        case 'RECEIVED':
        case 'COLLECTED':
            return 'emerald';
        case 'REJECTED':
        case 'CANCELLED':
            return 'red';
        default:
            return 'amber';
    }
}

export default function InventoryRequests() {
    const history = useApiQuery(() => inventoryRequests.mine());
    const [lines, setLines] = useState<RequestLine[]>([]);
    const [reason, setReason] = useState('');
    const [picking, setPicking] = useState(false);
    const [quantityFor, setQuantityFor] = useState<WarehouseProduct | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (lines.length === 0) {
            toast.error('Add at least one item');
            return;
        }
        if (reason.trim() === '') {
            toast.error('Enter a reason for this request');
            return;
        }
        setIsSubmitting(true);
        try {
            // One request for all items: the Cluster Leader approves each line, and the
            // issued lines share one collection code.
            await inventoryRequests.submit({
                requestId: inventoryRequests.generateRequestId(),
                reason: reason.trim(),
                items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
            });
            setLines([]);
            setReason('');
            toast.success('Request submitted - pending Cluster Leader approval');
            history.reload();
        } catch (e) {
            toast.error(errorText(e, 'Failed to submit inventory request'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Page title="Inventory Request" description="Request stock from the warehouse" back={{ href: '/dashboard', label: 'Dashboard' }}>
            <Section title="New Request">
                <form onSubmit={submit} className="bg-card space-y-4 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Items</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                            <Plus /> Add item
                        </Button>
                    </div>
                    {lines.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No items added yet.</p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {lines.map((line) => (
                                <li key={line.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
                                    <span className="flex-1">{line.productName}</span>
                                    <span className="font-semibold">×{line.quantity}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setLines((current) => current.filter((l) => l.productId !== line.productId))}
                                        aria-label={`Remove ${line.productName}`}
                                    >
                                        <Trash2 className="text-red-600" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Field label="Reason" htmlFor="reason" required>
                        <Textarea id="reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </Field>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
                        Submit Request
                    </Button>
                </form>
            </Section>

            <Section
                title="My Requests"
                actions={
                    <Button variant="outline" size="sm" onClick={history.reload} disabled={history.isFetching}>
                        <RefreshCw className={history.isFetching ? 'animate-spin' : undefined} /> Refresh
                    </Button>
                }
            >
                <QueryView
                    query={history}
                    loadingRows={3}
                    empty={(data) => data.length === 0 && <EmptyState icon={PackagePlus} title="No requests submitted yet." />}
                >
                    {(data) => (
                        <ul className="space-y-3">
                            {data.map((request) => (
                                <li key={request.requestId}>
                                    <RequestHistoryCard request={request} onChanged={history.reload} />
                                </li>
                            ))}
                        </ul>
                    )}
                </QueryView>
            </Section>

            <SearchPicker<WarehouseProduct>
                open={picking}
                onOpenChange={setPicking}
                title="Select Item"
                placeholder="Search warehouse items"
                search={(query, signal) => products.search(query, null, signal)}
                getKey={(product) => `${product.productId}-${product.warehouseId}`}
                isDisabled={(product) => lines.some((line) => line.productId === product.productId)}
                renderItem={(product) => (
                    <span className="block">
                        <span className="block font-medium">{product.productName}</span>
                        <span className="text-muted-foreground block text-xs">
                            In stock: {formatQuantity(product.quantity)} · You have: {formatQuantity(product.myHolding)}
                        </span>
                    </span>
                )}
                onSelect={setQuantityFor}
            />

            <QuantityDialog
                product={quantityFor}
                onClose={() => setQuantityFor(null)}
                onAdd={(product, quantity) =>
                    setLines((current) => [...current, { productId: product.productId, productName: product.productName, quantity }])
                }
            />
        </Page>
    );
}

function QuantityDialog({
    product,
    onClose,
    onAdd,
}: {
    product: WarehouseProduct | null;
    onClose: () => void;
    onAdd: (product: WarehouseProduct, quantity: number) => void;
}) {
    const [quantity, setQuantity] = useState('');
    const [error, setError] = useState<string | null>(null);

    const add = (event: FormEvent) => {
        event.preventDefault();
        if (!product) return;
        if (!/^\d+$/.test(quantity.trim()) || Number(quantity) <= 0) {
            setError('Enter a valid quantity');
            return;
        }
        onAdd(product, Number(quantity));
        onClose();
    };

    return (
        <Dialog
            open={product !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
                setQuantity('');
                setError(null);
            }}
        >
            <DialogContent>
                <form onSubmit={add} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Quantity for {product?.productName}</DialogTitle>
                    </DialogHeader>
                    <Field label="Quantity" htmlFor="request-quantity" error={error}>
                        <Input
                            id="request-quantity"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            autoFocus
                            value={quantity}
                            onChange={(event) => {
                                setQuantity(event.target.value);
                                setError(null);
                            }}
                        />
                    </Field>
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">Add</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RequestHistoryCard({ request, onChanged }: { request: InventoryRequest; onChanged: () => void }) {
    const [confirming, setConfirming] = useState<string | null>(null);

    const confirmReceived = async (ticketNumber: string) => {
        setConfirming(ticketNumber);
        try {
            await inventoryRequests.confirmReceived(ticketNumber);
            toast.success('Receipt confirmed');
            onChanged();
        } catch (e) {
            toast.error(errorText(e, 'Failed to confirm receipt'));
        } finally {
            setConfirming(null);
        }
    };

    return (
        <div className="bg-card space-y-3 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium">{request.requestId}</p>
            {request.collectionCodes.map((code) => (
                <CollectionCodeBanner key={code.code} code={code} />
            ))}
            <ul className="space-y-2">
                {request.items.map((item) => {
                    const approved = item.quantityApproved;
                    const qtyLabel = approved != null && String(approved) !== item.quantity ? `×${approved} of ${item.quantity}` : `×${item.quantity}`;
                    // Items handed over through a collection code are confirmed at the station instead.
                    const canConfirm = item.status.toUpperCase() === 'ISSUED' && !item.collectionCode && request.collectionCodes.length === 0;
                    return (
                        <li key={item.ticketNumber} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="flex-1 font-medium">
                                {item.itemName} {qtyLabel}
                            </span>
                            <Pill tone={statusTone(item.status)}>{item.status}</Pill>
                            {canConfirm && (
                                <Button size="sm" variant="outline" disabled={confirming !== null} onClick={() => confirmReceived(item.ticketNumber)}>
                                    {confirming === item.ticketNumber ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
                                    Confirm received
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {request.reason && <p className="text-muted-foreground text-xs italic">{request.reason}</p>}
            {request.submittedAt && <p className="text-muted-foreground text-xs">Submitted {formatDate(request.submittedAt)}</p>}
        </div>
    );
}

/** The collection code, large and copyable: the technician reads it out (or shows it) at the station. */
function CollectionCodeBanner({ code }: { code: CollectionCode }) {
    const collected = code.status.toUpperCase() === 'COLLECTED';
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code.code);
            toast.success(`Code ${code.code} copied`);
        } catch {
            toast.error('Could not copy the code');
        }
    };

    return (
        <div
            className={
                collected
                    ? 'flex items-center gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3'
                    : 'flex items-center gap-3 rounded-lg border border-blue-600/30 bg-blue-600/10 p-3'
            }
        >
            <div className="flex-1">
                <p className="text-muted-foreground text-xs">
                    {collected ? 'Collected at the station' : 'Collection code - give this at the station'}
                </p>
                <p className="font-mono text-xl font-bold tracking-widest select-all">{code.code}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy code" title="Copy code">
                <Copy />
            </Button>
        </div>
    );
}
