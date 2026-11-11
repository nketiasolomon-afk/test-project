import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { SearchPicker } from '@/components/fuelops/search-picker';
import { EmptyState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api';
import { formatQuantity, fromDateInputValue, toDateInputValue } from '@/lib/format';
import { products, requisitions } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type WarehouseProduct } from '@/types/fuelops';
import { router, usePage } from '@inertiajs/react';
import { ChevronDown, LoaderCircle, PackageOpen, Plus, Send, Trash2 } from '@/components/icons';
import { FormEvent, useEffect, useState } from 'react';

/** CCTV requisitions draw only from the IT warehouse. */
const IT_WAREHOUSE = 'IT';

interface ItemRow {
    key: number;
    itemName: string;
    specification: string;
    unit: string;
    qtyRequested: string;
    remarks: string;
}

/** The ERP stores requisition dates as DD/MM/YYYY text, as the paper form does. */
function toFormDate(value: string): string {
    const date = fromDateInputValue(value);
    if (!date) return '';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

let nextRowKey = 1;

function emptyRow(): ItemRow {
    return { key: nextRowKey++, itemName: '', specification: '', unit: '', qtyRequested: '', remarks: '' };
}

export default function RequisitionCreate() {
    const { auth } = usePage<SharedData>().props;
    const [reqNo, setReqNo] = useState('');
    const [isLoadingReqNo, setIsLoadingReqNo] = useState(true);
    const [dateOfRequest, setDateOfRequest] = useState(toDateInputValue(new Date()));
    const [requiredBy, setRequiredBy] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<ItemRow[]>([]);
    const [pickingFor, setPickingFor] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // The requisition number comes from the ERP, not the browser.
    useEffect(() => {
        requisitions.nextNumber().then((number) => {
            setReqNo(number ?? '');
            setIsLoadingReqNo(false);
        });
    }, []);

    const updateRow = (key: number, changes: Partial<ItemRow>) => {
        setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
        setErrors((current) => {
            const next = { ...current };
            delete next[`row-${key}`];
            delete next.items;
            return next;
        });
    };

    const validate = (): Record<string, string> => {
        const found: Record<string, string> = {};
        if (reqNo.trim() === '') found.reqNo = 'Enter the requisition number';
        if (!fromDateInputValue(dateOfRequest)) found.dateOfRequest = 'Pick the date of request';
        const requiredByDate = fromDateInputValue(requiredBy);
        if (!requiredByDate) {
            found.requiredBy = 'Pick the date the items are required by';
        } else if (fromDateInputValue(dateOfRequest) && requiredByDate < fromDateInputValue(dateOfRequest)!) {
            found.requiredBy = 'Required-by date cannot be before the date of request';
        }
        let filledRows = 0;
        for (const row of items) {
            const isEmpty = row.itemName.trim() === '' && row.qtyRequested.trim() === '';
            if (isEmpty) continue;
            filledRows++;
            if (row.itemName.trim() === '') {
                found[`row-${row.key}`] = 'Select an item from the IT warehouse';
            } else if (!/^\d+$/.test(row.qtyRequested.trim()) || Number(row.qtyRequested) <= 0) {
                found[`row-${row.key}`] = 'Enter a whole-number quantity greater than zero';
            }
        }
        if (filledRows === 0) found.items = 'Please add at least one item';
        return found;
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
            toast.error(found.items ?? 'Please fix the highlighted fields');
            return;
        }

        // Empty rows (no item and no quantity) are skipped, as on the paper form.
        const submittedItems = items
            .filter((row) => !(row.itemName.trim() === '' && row.qtyRequested.trim() === ''))
            .map((row, index) => ({
                rowNumber: index + 1,
                station: '',
                itemName: row.itemName.trim(),
                specification: row.specification.trim(),
                unit: row.unit.trim(),
                qtyRequested: Number(row.qtyRequested),
                qtyApproved: 0,
                qtyIssued: 0,
                remarks: row.remarks.trim(),
            }));

        setIsSubmitting(true);
        try {
            const created = await requisitions.submit({
                reqNo: reqNo.trim(),
                dateOfRequest: toFormDate(dateOfRequest),
                technicianName: auth.user.fullName,
                requiredByDate: toFormDate(requiredBy),
                designation: '',
                priority: 'Normal',
                jobRef: '',
                notes: notes.trim(),
                items: submittedItems,
            });
            toast.success('Requisition submitted successfully');
            const id = created?.requisitionId || created?.reqNo || reqNo.trim();
            router.visit(`/requisitions/${encodeURIComponent(id)}`);
        } catch (e) {
            toast.error(errorText(e, 'Submission failed'));
            setIsSubmitting(false);
        }
    };

    const pickingRow = items.find((row) => row.key === pickingFor);

    return (
        <Page
            title="Requisition Form"
            description="Equipment / Stock Requisition"
            back={{ href: '/requisitions', label: 'Requisition' }}
            width="narrow"
        >
            <form onSubmit={submit} className="space-y-8" noValidate>
                <Section title="Request Details">
                    <div className="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                        <Field label="Requisition No." htmlFor="reqNo" error={errors.reqNo} required>
                            <Input
                                id="reqNo"
                                value={reqNo}
                                onChange={(event) => setReqNo(event.target.value)}
                                placeholder={isLoadingReqNo ? 'Fetching from ERP…' : 'Enter requisition number'}
                                disabled={isLoadingReqNo}
                            />
                        </Field>
                        <Field label="Date of request" htmlFor="dateOfRequest" error={errors.dateOfRequest} required>
                            <Input id="dateOfRequest" type="date" value={dateOfRequest} onChange={(event) => setDateOfRequest(event.target.value)} />
                        </Field>
                        <Field label="Requested by (Technician)" htmlFor="technician">
                            <Input id="technician" value={auth.user.fullName} disabled />
                        </Field>
                        <Field label="Required by" htmlFor="requiredBy" error={errors.requiredBy} required>
                            <Input
                                id="requiredBy"
                                type="date"
                                value={requiredBy}
                                min={dateOfRequest || undefined}
                                onChange={(event) => {
                                    setRequiredBy(event.target.value);
                                    setErrors((current) => {
                                        const next = { ...current };
                                        delete next.requiredBy;
                                        return next;
                                    });
                                }}
                            />
                        </Field>
                    </div>
                </Section>

                <Section
                    title={`Items Required${items.length > 0 ? ` (${items.length})` : ''}`}
                    actions={
                        <Button type="button" variant="outline" size="sm" onClick={() => setItems((rows) => [...rows, emptyRow()])}>
                            <Plus /> Add Item
                        </Button>
                    }
                >
                    {errors.items && <p className="text-sm text-red-600 dark:text-red-400">{errors.items}</p>}
                    {items.length === 0 ? (
                        <EmptyState
                            icon={PackageOpen}
                            title="No items added yet"
                            description="Add the CCTV and network equipment this job needs from the IT warehouse."
                            action={
                                <Button type="button" onClick={() => setItems([emptyRow()])}>
                                    <Plus /> Add Item
                                </Button>
                            }
                        />
                    ) : (
                        <ol className="space-y-3">
                            {items.map((row, index) => (
                                <li key={row.key} className="bg-card space-y-3 rounded-xl border p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold">Item {index + 1}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}
                                            aria-label={`Remove item ${index + 1}`}
                                            title="Remove item"
                                        >
                                            <Trash2 className="text-red-600" />
                                        </Button>
                                    </div>
                                    {/* Items can't be typed freehand: only what the IT warehouse holds can be requested. */}
                                    <Field label="Item" error={errors[`row-${row.key}`]} required>
                                        <button
                                            type="button"
                                            onClick={() => setPickingFor(row.key)}
                                            className="border-input bg-background flex h-10 w-full items-center justify-between rounded-md border px-3 text-left text-sm"
                                        >
                                            <span className={row.itemName ? '' : 'text-muted-foreground'}>{row.itemName || 'Select IT warehouse item'}</span>
                                            <ChevronDown className="text-muted-foreground size-4" />
                                        </button>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Unit" htmlFor={`unit-${row.key}`}>
                                            <Input id={`unit-${row.key}`} value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value })} />
                                        </Field>
                                        <Field label="Requested" htmlFor={`qty-${row.key}`} required>
                                            <Input
                                                id={`qty-${row.key}`}
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                step={1}
                                                placeholder="0"
                                                value={row.qtyRequested}
                                                onChange={(e) => updateRow(row.key, { qtyRequested: e.target.value })}
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Specification / Model" htmlFor={`spec-${row.key}`}>
                                        <Input
                                            id={`spec-${row.key}`}
                                            value={row.specification}
                                            onChange={(e) => updateRow(row.key, { specification: e.target.value })}
                                        />
                                    </Field>
                                    <Field label="Remarks (optional)" htmlFor={`remarks-${row.key}`}>
                                        <Input
                                            id={`remarks-${row.key}`}
                                            value={row.remarks}
                                            onChange={(e) => updateRow(row.key, { remarks: e.target.value })}
                                        />
                                    </Field>
                                </li>
                            ))}
                        </ol>
                    )}
                </Section>

                <Section title="Notes / Justification">
                    <Textarea
                        rows={4}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Enter any additional notes or justification for this requisition..."
                        aria-label="Notes / Justification"
                    />
                </Section>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || isLoadingReqNo}>
                    {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
                    Submit Requisition
                </Button>
            </form>

            <SearchPicker<WarehouseProduct>
                open={pickingFor !== null}
                onOpenChange={(open) => !open && setPickingFor(null)}
                title="Select Item"
                placeholder="Search IT warehouse items"
                search={(query, signal) => products.search(query, IT_WAREHOUSE, signal)}
                getKey={(product) => product.productId}
                renderItem={(product) => (
                    <span className="block">
                        <span className="block font-medium">{product.productName}</span>
                        <span className="text-muted-foreground block text-xs">In stock: {formatQuantity(product.quantity)}</span>
                    </span>
                )}
                onSelect={(product) => pickingRow && updateRow(pickingRow.key, { itemName: product.productName })}
            />
        </Page>
    );
}
