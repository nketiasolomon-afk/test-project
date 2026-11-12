import { Field } from '@/components/fuelops/field';
import { Page, SectionHeader } from '@/components/fuelops/page';
import { SearchPicker } from '@/components/fuelops/search-picker';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { CircleCheck, Copy, LoaderCircle, MdAdd, MdClose, MdInventory2Outline, MdSend, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDate, formatQuantity } from '@/lib/format';
import { inventoryRequests, products } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type CollectionCode, type InventoryRequest, type WarehouseProduct } from '@/types/fuelops';
import { FormEvent, useState } from 'react';

interface RequestLine {
    productId: string;
    productName: string;
    quantity: number;
}

type StatusTone = 'blue' | 'emerald' | 'red' | 'amber';

function statusTone(status: string): StatusTone {
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

/** The phone's request status colours (text in the colour on a 10% tint, 18% in dark mode). */
const STATUS_CHIP: Record<StatusTone, string> = {
    blue: 'text-[#2563EB] bg-[#2563EB]/10 dark:text-[#60A5FA] dark:bg-[#2563EB]/18',
    emerald: 'text-[#059669] bg-[#059669]/10 dark:text-[#34D399] dark:bg-[#059669]/18',
    red: 'text-[#DC2626] bg-[#DC2626]/10 dark:text-[#F87171] dark:bg-[#DC2626]/18',
    amber: 'text-[#B45309] bg-[#B45309]/10 dark:text-[#FBBF24] dark:bg-[#B45309]/18',
};

function StatusChip({ status }: { status: string }) {
    return (
        <span className={cn('inline-flex shrink-0 rounded-full px-2 py-[3px] text-[10px] leading-tight font-semibold', STATUS_CHIP[statusTone(status)])}>
            {status}
        </span>
    );
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
        <Page title="Inventory Request" description="Request stock from the warehouse" back={{ href: '/dashboard', label: 'Dashboard' }} width="wide">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-8">
                {/* New Request: the phone's white section card. */}
                <form onSubmit={submit} className="bg-card shadow-card space-y-4 rounded-2xl border p-4 lg:sticky lg:top-6">
                    <h2 className="text-foreground text-base font-bold">New Request</h2>
                    <div className="flex items-center justify-between">
                        <span className="text-foreground text-sm font-semibold">Items</span>
                        <Button type="button" variant="ghost" size="sm" className="text-primary dark:text-[#6fb3e8]" onClick={() => setPicking(true)}>
                            <MdAdd /> Add item
                        </Button>
                    </div>
                    {lines.length === 0 ? (
                        <p className="text-muted-foreground -mt-1 py-1 text-[13px]">No items added yet.</p>
                    ) : (
                        <ul className="-mt-1 space-y-2">
                            {lines.map((line) => (
                                <li key={line.productId} className="bg-primary/6 dark:bg-primary/14 flex items-center gap-2 rounded-[10px] py-1 pr-1 pl-3">
                                    <span className="text-foreground min-w-0 flex-1 py-1.5 text-[13px]">
                                        {line.productName}
                                        <span className="ml-2 font-semibold">×{line.quantity}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setLines((current) => current.filter((l) => l.productId !== line.productId))}
                                        aria-label={`Remove ${line.productName}`}
                                        title="Remove"
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#FF5252] transition-colors hover:bg-[#FF5252]/10"
                                    >
                                        <MdClose className="size-[18px]" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Field label="Reason" htmlFor="reason" required>
                        <Textarea id="reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </Field>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : <MdSend />}
                        Submit Request
                    </Button>
                </form>

                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <SectionHeader title="My Requests" className="text-base" />
                        <Button variant="outline" size="sm" onClick={history.reload} disabled={history.isFetching}>
                            <RefreshCw className={history.isFetching ? 'animate-spin' : undefined} /> Refresh
                        </Button>
                    </div>
                    <QueryView
                        query={history}
                        loadingRows={3}
                        empty={(data) =>
                            data.length === 0 && <EmptyState icon={MdInventory2Outline} title="No requests submitted yet." className="py-8" />
                        }
                    >
                        {(data) => (
                            <ul className="grid gap-2.5 xl:grid-cols-2">
                                {data.map((request) => (
                                    <li key={request.requestId}>
                                        <RequestHistoryCard request={request} onChanged={history.reload} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </QueryView>
                </section>
            </div>

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
        <div className="bg-card shadow-card h-full space-y-2.5 rounded-[14px] border p-3.5">
            <p className="text-muted-foreground text-[11px] font-medium">{request.requestId}</p>
            {request.collectionCodes.map((code) => (
                <CollectionCodeBanner key={code.code} code={code} />
            ))}
            <ul className="space-y-1.5">
                {request.items.map((item) => {
                    const approved = item.quantityApproved;
                    const qtyLabel = approved != null && String(approved) !== item.quantity ? `×${approved} of ${item.quantity}` : `×${item.quantity}`;
                    // Items handed over through a collection code are confirmed at the station instead.
                    const canConfirm = item.status.toUpperCase() === 'ISSUED' && !item.collectionCode && request.collectionCodes.length === 0;
                    return (
                        <li key={item.ticketNumber} className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground min-w-0 flex-1 text-[13px] font-semibold">
                                {item.itemName} {qtyLabel}
                            </span>
                            <StatusChip status={item.status} />
                            {canConfirm && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8"
                                    disabled={confirming !== null}
                                    onClick={() => confirmReceived(item.ticketNumber)}
                                >
                                    {confirming === item.ticketNumber ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
                                    Confirm received
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {request.reason && <p className="text-muted-foreground text-xs italic">{request.reason}</p>}
            {request.submittedAt && <p className="text-muted-foreground text-[11px]">Submitted {formatDate(request.submittedAt)}</p>}
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
            className={cn(
                'flex items-center gap-2 rounded-[10px] border py-2.5 pr-1 pl-3',
                collected
                    ? 'border-[#059669]/35 bg-[#059669]/7 dark:bg-[#059669]/16'
                    : 'border-[#2563EB]/35 bg-[#2563EB]/7 dark:bg-[#2563EB]/16',
            )}
        >
            <div className="min-w-0 flex-1">
                <p className={cn('text-[11px]', collected ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#2563EB] dark:text-[#60A5FA]')}>
                    {collected ? 'Collected at the station' : 'Collection code - give this at the station'}
                </p>
                <p className="text-foreground mt-0.5 text-[22px] leading-tight font-bold tracking-[2px] select-all">{code.code}</p>
            </div>
            <button
                type="button"
                onClick={copy}
                aria-label="Copy code"
                title="Copy code"
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-current/10',
                    collected ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#2563EB] dark:text-[#60A5FA]',
                )}
            >
                <Copy className="size-[18px]" />
            </button>
        </div>
    );
}
