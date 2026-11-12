import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, errorText } from '@/lib/api';
import { formatDate, formatQuantity, fromDateInputValue, initials, toDateInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dashboards, miniStore, myStock } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type MiniStoreItem, type MyStock, type RestockRequest, type TechnicianStats } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { type IconType, LoaderCircle, MdBuildCircle, MdChevronRight, MdInventory2, MdRemoveCircleOutline, RefreshCw } from '@/components/icons';
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

type RestockTone = 'blue' | 'emerald' | 'red' | 'amber';

function restockTone(status: string): RestockTone {
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

/** The phone's restock status colours (text in the colour on a 10% tint, 18% in dark mode). */
const STATUS_CHIP: Record<RestockTone, string> = {
    blue: 'text-[#2563EB] bg-[#2563EB]/10 dark:text-[#60A5FA] dark:bg-[#2563EB]/18',
    emerald: 'text-[#059669] bg-[#059669]/10 dark:text-[#34D399] dark:bg-[#059669]/18',
    red: 'text-[#DC2626] bg-[#DC2626]/10 dark:text-[#F87171] dark:bg-[#DC2626]/18',
    amber: 'text-[#B45309] bg-[#B45309]/10 dark:text-[#FBBF24] dark:bg-[#B45309]/18',
};

function StatusChip({ status }: { status: string }) {
    return (
        <span className={cn('inline-flex shrink-0 rounded-full px-2 py-[3px] text-[10px] leading-tight font-semibold', STATUS_CHIP[restockTone(status)])}>
            {status}
        </span>
    );
}

/** The phone's plain grey empty line, used under each section. */
function EmptyLine({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}

/** The green stock tile used on the stock cards and item detail. */
function StockTile() {
    return (
        <span className="relative flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-xl text-[#047857] dark:text-[#34D399]">
            <span className="absolute inset-0 bg-[#10B981]/12 dark:bg-[#10B981]/20" aria-hidden="true" />
            <MdInventory2 className="relative size-5" />
        </span>
    );
}

function SummaryStat({ icon: Icon, label, value }: { icon: IconType; label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center text-center">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/16 bg-white/12">
                <Icon className="size-5" />
            </span>
            <p className="mt-2 text-base leading-tight font-bold">{value}</p>
            <p className="mt-0.5 text-[11px] text-white/70">{label}</p>
        </div>
    );
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
            width="wide"
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
                        <div className="space-y-[26px]">
                            {/* Inventory Overview: the phone's green gradient summary card. */}
                            <div className="rounded-[20px] bg-[linear-gradient(135deg,#064E3B_0%,#047857_55%,#10B981_100%)] p-5 text-white">
                                <p className="text-base font-bold">Inventory Overview</p>
                                <p className="mt-1 text-xs text-white/70">
                                    {data.items.length} item type{data.items.length === 1 ? '' : 's'} {data.live ? 'in your stock' : 'in store'}
                                </p>
                                <div className="mx-auto mt-[18px] grid max-w-md grid-cols-2 gap-4">
                                    <SummaryStat icon={MdInventory2} label="Stock on hand" value={formatQuantity(Math.round(totalStockOnHand))} />
                                    <SummaryStat icon={MdBuildCircle} label="Used" value={totalItemsUsed} />
                                </div>
                            </div>

                            <Section title={data.live ? 'My Stock' : 'Stock On Hand'}>
                                {data.live && data.items.length > 0 && (
                                    <Button variant="outline" className="-mt-1.5 w-full sm:w-auto" onClick={() => setRecording(true)}>
                                        <MdRemoveCircleOutline /> Record Usage (not on a job card)
                                    </Button>
                                )}
                                {data.items.length === 0 ? (
                                    <EmptyLine>No stock items currently on hand.</EmptyLine>
                                ) : (
                                    <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                        {data.items.map((item) => (
                                            <li key={item.miniStoreItemId || item.productId}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDetailItem(item)}
                                                    className="bg-card shadow-card flex h-full w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-[#10B981]/40"
                                                >
                                                    <StockTile />
                                                    <span className="text-foreground min-w-0 flex-1 text-[14.5px] font-semibold">{item.productName}</span>
                                                    <span className="text-[15px] font-bold text-[#047857] dark:text-[#34D399]">{formatQuantity(item.quantity)}</span>
                                                    <MdChevronRight className="-ml-1 size-[18px] shrink-0 text-gray-400" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <div className={cn('grid gap-[26px]', auth.user.isClusterLeader && 'lg:grid-cols-2 lg:items-start lg:gap-8')}>
                                <Section title="My Restock Requests">
                                    {data.restocks.length === 0 ? (
                                        <EmptyLine>No restock requests yet.</EmptyLine>
                                    ) : (
                                        <ul className={cn('grid gap-2.5', !auth.user.isClusterLeader && 'lg:grid-cols-2 xl:grid-cols-3')}>
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
                                            <EmptyLine>No usage data available yet.</EmptyLine>
                                        ) : (
                                            <ul className="grid gap-2.5">
                                                {data.technicians.map((technician) => (
                                                    <li
                                                        key={technician.technicianId}
                                                        className="bg-card shadow-card flex items-center gap-3 rounded-2xl border p-4"
                                                    >
                                                        <span className="bg-primary/12 text-primary dark:bg-primary/20 flex size-[42px] shrink-0 items-center justify-center rounded-xl text-[15px] font-bold dark:text-[#6fb3e8]">
                                                            {initials(technician.fullName)}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="text-foreground block truncate text-[14.5px] font-semibold">
                                                                {technician.fullName}
                                                            </span>
                                                            {technician.role && (
                                                                <span className="text-muted-foreground mt-0.5 block truncate text-xs">{technician.role}</span>
                                                            )}
                                                        </span>
                                                        <span className="shrink-0 rounded-[10px] bg-[#6D28D9]/8 px-2.5 py-1.5 text-xs font-bold text-[#6D28D9] dark:bg-[#6D28D9]/14 dark:text-[#C4B5FD]">
                                                            {technician.partsConsumed} used
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </Section>
                                )}
                            </div>

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
        <div className="bg-card shadow-card h-full rounded-[14px] border p-3.5">
            <div className="flex items-center gap-2">
                <span className="text-foreground min-w-0 flex-1 text-sm font-semibold">{request.productName}</span>
                <StatusChip status={request.status} />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Requested {request.requestedQuantity}</p>
            {request.status === 'CLUSTER_REJECTED' && request.clusterDecisionNote && (
                <p className="mt-1.5 text-[11px] text-red-500 italic dark:text-red-400">{request.clusterDecisionNote}</p>
            )}
        </div>
    );
}

function ItemDetailDialog({ item, onClose, relatedRequests }: { item: MiniStoreItem | null; onClose: () => void; relatedRequests: RestockRequest[] }) {
    return (
        <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
                    <StockTile />
                    <div className="min-w-0">
                        <DialogTitle className="text-base font-bold">{item?.productName}</DialogTitle>
                        <DialogDescription className="mt-0.5 text-[12.5px]">{item ? formatQuantity(item.quantity) : ''} in stock</DialogDescription>
                    </div>
                </DialogHeader>
                <h3 className="text-muted-foreground mt-1 text-[13px] font-semibold">Request History</h3>
                {relatedRequests.length === 0 ? (
                    <p className="text-muted-foreground py-2 text-sm">No restock requests for this item yet.</p>
                ) : (
                    <ul className="space-y-2.5">
                        {relatedRequests.map((request) => (
                            <li key={request.id} className="rounded-xl bg-gray-500/5 p-3 dark:bg-white/4">
                                <div className="flex items-center gap-2">
                                    <span className="text-foreground min-w-0 flex-1 text-[13px] font-semibold">Requested {request.requestedQuantity}</span>
                                    {request.submittedAt && <span className="text-muted-foreground text-[11px]">{formatDate(request.submittedAt)}</span>}
                                    <StatusChip status={request.status} />
                                </div>
                                {(request.approvedQuantity != null || request.issuedQuantity != null || request.receivedQuantity != null) && (
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {[
                                            request.approvedQuantity != null && `Approved: ${request.approvedQuantity}`,
                                            request.issuedQuantity != null && `Issued: ${request.issuedQuantity}`,
                                            request.receivedQuantity != null && `Received: ${request.receivedQuantity}`,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                )}
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
                            className="border-border bg-input focus-visible:border-primary focus-visible:ring-primary h-12 w-full rounded-[14px] border px-4 text-base focus-visible:ring-1 focus-visible:outline-hidden md:text-sm"
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
