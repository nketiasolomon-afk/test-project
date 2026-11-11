import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, errorText } from '@/lib/api';
import { formatDate, formatQuantity, fromDateInputValue, initials, toDateInputValue, type Tone } from '@/lib/format';
import { dashboards, miniStore, myStock } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type MiniStoreItem, type MyStock, type RestockRequest, type TechnicianStats } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { ChevronRight, CircleMinus, LoaderCircle, Package, RefreshCw, Wrench } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface StockOverview {
    /** Whether the technician's own stock is live; until then items come from the cluster mini store. */
    live: boolean;
    items: MiniStoreItem[];
    technicians: TechnicianStats[];
    restocks: RestockRequest[];
}

async function loadOverview(): Promise<StockOverview> {
    const [miniItems, technicians, restocks, own] = await Promise.all([
        miniStore.myItems(),
        dashboards.technicianStats(),
        miniStore.myRestocks(),
        // Older servers have no /my-stock; treat that as "not live".
        myStock.get().catch((e: unknown): MyStock | null => {
            if (e instanceof ApiError) return null;
            throw e;
        }),
    ]);
    const live = own?.live ?? false;
    return {
        live,
        items: live
            ? own!.items.map((item) => ({ miniStoreItemId: '', productId: item.productId, productName: item.productName, quantity: item.quantity }))
            : miniItems,
        technicians,
        restocks,
    };
}

function restockTone(status: string): Tone {
    switch (status.toUpperCase()) {
        case 'CLUSTER_APPROVED':
        case 'ISSUED':
            return 'blue';
        case 'RECEIVED':
        case 'PART_RECEIVED':
            return 'emerald';
        case 'CLUSTER_REJECTED':
        case 'REJECTED':
            return 'red';
        default:
            return 'amber';
    }
}

export default function InventoryStock() {
    const { auth } = usePage<SharedData>().props;
    const overview = useApiQuery(loadOverview);
    const [recording, setRecording] = useState(false);
    const [detailItem, setDetailItem] = useState<MiniStoreItem | null>(null);

    return (
        <Page
            title="Tech Inventory"
            description="Stock on hand & usage"
            back={{ href: '/dashboard', label: 'Dashboard' }}
            actions={
                <Button variant="outline" size="sm" onClick={overview.reload} disabled={overview.isFetching}>
                    <RefreshCw className={overview.isFetching ? 'animate-spin' : undefined} /> Refresh
                </Button>
            }
        >
            <QueryView query={overview}>
                {(data) => {
                    const totalStockOnHand = data.items.reduce((sum, item) => sum + item.quantity, 0);
                    const totalItemsUsed = data.technicians.reduce((sum, t) => sum + t.partsConsumed, 0);
                    return (
                        <div className="space-y-8">
                            <div className="rounded-2xl bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#10b981] p-5 text-white shadow-lg">
                                <p className="text-lg font-bold">Inventory Overview</p>
                                <p className="text-sm text-white/80">
                                    {data.items.length} item type{data.items.length === 1 ? '' : 's'} {data.live ? 'in your stock' : 'in store'}
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-center">
                                    <div>
                                        <p className="text-2xl font-bold">{formatQuantity(Math.round(totalStockOnHand))}</p>
                                        <p className="text-xs text-white/75">Stock on hand</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{totalItemsUsed}</p>
                                        <p className="text-xs text-white/75">Used</p>
                                    </div>
                                </div>
                            </div>

                            <Section
                                title={data.live ? 'My Stock' : 'Stock On Hand'}
                                actions={
                                    data.live &&
                                    data.items.length > 0 && (
                                        <Button variant="outline" size="sm" onClick={() => setRecording(true)}>
                                            <CircleMinus /> Record Usage (not on a job card)
                                        </Button>
                                    )
                                }
                            >
                                {data.items.length === 0 ? (
                                    <EmptyState icon={Package} title="No stock items currently on hand." />
                                ) : (
                                    <ul className="grid gap-2 sm:grid-cols-2">
                                        {data.items.map((item) => (
                                            <li key={item.miniStoreItemId || item.productId}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDetailItem(item)}
                                                    className="bg-card hover:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-xs"
                                                >
                                                    <span className="bg-muted flex size-9 items-center justify-center rounded-lg text-teal-700">
                                                        <Package className="size-4" />
                                                    </span>
                                                    <span className="flex-1 text-sm font-medium">{item.productName}</span>
                                                    <span className="text-lg font-bold">{formatQuantity(item.quantity)}</span>
                                                    <ChevronRight className="text-muted-foreground size-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title="My Restock Requests">
                                {data.restocks.length === 0 ? (
                                    <EmptyState title="No restock requests yet." />
                                ) : (
                                    <ul className="space-y-2">
                                        {data.restocks.map((request) => (
                                            <li key={request.id}>
                                                <RestockRow request={request} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            {auth.user.isClusterLeader && (
                                <Section title="Items Used by Technicians">
                                    {data.technicians.length === 0 ? (
                                        <EmptyState icon={Wrench} title="No usage data available yet." />
                                    ) : (
                                        <ul className="space-y-2">
                                            {data.technicians.map((technician) => (
                                                <li key={technician.technicianId} className="bg-card flex items-center gap-3 rounded-xl border p-3">
                                                    <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full text-xs font-bold">
                                                        {initials(technician.fullName)}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-medium">{technician.fullName}</span>
                                                        {technician.role && <span className="text-muted-foreground block text-xs">{technician.role}</span>}
                                                    </span>
                                                    <Pill tone="teal">{technician.partsConsumed} used</Pill>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </Section>
                            )}

                            <RecordUsageDialog
                                open={recording}
                                onOpenChange={setRecording}
                                items={data.items.filter((item) => item.quantity > 0)}
                                onRecorded={() => {
                                    toast.success('Usage recorded.');
                                    overview.reload();
                                }}
                            />
                            <ItemDetailDialog
                                item={detailItem}
                                onClose={() => setDetailItem(null)}
                                relatedRequests={
                                    detailItem
                                        ? data.restocks
                                              .filter((r) => r.productName === detailItem.productName)
                                              .sort((a, b) => (Date.parse(b.submittedAt ?? '') || 0) - (Date.parse(a.submittedAt ?? '') || 0))
                                        : []
                                }
                            />
                        </div>
                    );
                }}
            </QueryView>
        </Page>
    );
}

function RestockRow({ request }: { request: RestockRequest }) {
    return (
        <div className="bg-card rounded-xl border p-3">
            <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{request.productName}</span>
                <Pill tone={restockTone(request.status)}>{request.status}</Pill>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Requested {request.requestedQuantity}</p>
            {request.status === 'CLUSTER_REJECTED' && request.clusterDecisionNote && (
                <p className="mt-1 text-xs text-red-700 italic dark:text-red-400">{request.clusterDecisionNote}</p>
            )}
        </div>
    );
}

function ItemDetailDialog({ item, onClose, relatedRequests }: { item: MiniStoreItem | null; onClose: () => void; relatedRequests: RestockRequest[] }) {
    return (
        <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item?.productName}</DialogTitle>
                    <DialogDescription>On hand: {item ? formatQuantity(item.quantity) : ''}</DialogDescription>
                </DialogHeader>
                <h3 className="text-sm font-semibold">Request History</h3>
                {relatedRequests.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No restock requests for this item yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {relatedRequests.map((request) => (
                            <li key={request.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="flex-1 font-medium">Requested {request.requestedQuantity}</span>
                                    <Pill tone={restockTone(request.status)}>{request.status}</Pill>
                                </div>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {[
                                        request.approvedQuantity != null && `Approved: ${request.approvedQuantity}`,
                                        request.issuedQuantity != null && `Issued: ${request.issuedQuantity}`,
                                        request.receivedQuantity != null && `Received: ${request.receivedQuantity}`,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                                {request.submittedAt && <p className="text-muted-foreground text-xs">{formatDate(request.submittedAt)}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Records usage outside a job card. Items used on a ticket go on its job card instead. */
function RecordUsageDialog({
    open,
    onOpenChange,
    items,
    onRecorded,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: MiniStoreItem[];
    onRecorded: () => void;
}) {
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [consumedOn, setConsumedOn] = useState(toDateInputValue(new Date()));
    const [ticketNumber, setTicketNumber] = useState('');
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const item = items.find((i) => i.productId === productId) ?? null;

    const reset = () => {
        setProductId('');
        setQuantity('');
        setConsumedOn(toDateInputValue(new Date()));
        setTicketNumber('');
        setNote('');
        setErrors({});
        setError(null);
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        const found: Record<string, string> = {};
        const amount = Number(quantity);
        if (!item) found.item = 'Pick an item';
        if (quantity.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
            found.quantity = 'Enter a quantity greater than zero';
        } else if (item && amount > item.quantity) {
            found.quantity = `You only have ${formatQuantity(item.quantity)}`;
        }
        const date = fromDateInputValue(consumedOn);
        if (!date) found.date = 'Pick the date used';
        setErrors(found);
        if (Object.keys(found).length > 0 || !item || !date) return;

        setIsSaving(true);
        setError(null);
        try {
            await myStock.recordConsumption({ productId: item.productId, quantity: amount, consumedOn: date, ticketNumber, note });
            onOpenChange(false);
            reset();
            onRecorded();
        } catch (e) {
            setError(errorText(e, 'Failed to record usage'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (isSaving) return;
                onOpenChange(next);
                if (!next) reset();
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={save} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>Record Usage</DialogTitle>
                        <DialogDescription>For items used outside a job card. Items used on a ticket go on its job card.</DialogDescription>
                    </DialogHeader>
                    <Field label="Item" htmlFor="usage-item" error={errors.item}>
                        <select
                            id="usage-item"
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">Select item</option>
                            {items.map((i) => (
                                <option key={i.productId} value={i.productId}>
                                    {i.productName} ({formatQuantity(i.quantity)})
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Quantity used" htmlFor="usage-quantity" error={errors.quantity}>
                        <Input
                            id="usage-quantity"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                        />
                    </Field>
                    <Field label="Date used" htmlFor="usage-date" error={errors.date}>
                        <Input
                            id="usage-date"
                            type="date"
                            max={toDateInputValue(new Date())}
                            value={consumedOn}
                            onChange={(event) => setConsumedOn(event.target.value)}
                        />
                    </Field>
                    <Field label="Related ticket number (optional)" htmlFor="usage-ticket">
                        <Input id="usage-ticket" value={ticketNumber} onChange={(event) => setTicketNumber(event.target.value)} />
                    </Field>
                    <Field label="Note (optional)" htmlFor="usage-note">
                        <Input id="usage-note" value={note} onChange={(event) => setNote(event.target.value)} />
                    </Field>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <DialogFooter>
                        <Button type="submit" className="w-full" disabled={isSaving}>
                            {isSaving && <LoaderCircle className="animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
