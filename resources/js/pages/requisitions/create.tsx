import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { SearchPicker } from '@/components/fuelops/search-picker';
import { toast } from '@/components/fuelops/toast';
import {
    type IconType,
    LoaderCircle,
    MdAddCircleOutline,
    MdArrowDropDown,
    MdClose,
    MdDescriptionOutline,
    MdInventory2,
    MdInventory2Outline,
    MdNotes,
    MdSend,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api';
import { formatQuantity, fromDateInputValue, toDateInputValue } from '@/lib/format';
import { products, requisitions } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type WarehouseProduct } from '@/types/fuelops';
import { router, usePage } from '@inertiajs/react';
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
        <Page title="Requisition Form" description="Equipment / Stock Requisition" back={{ href: '/requisitions', label: 'Requisition' }}>
            <form onSubmit={submit} noValidate className="grid gap-[22px] lg:grid-cols-2 lg:items-start lg:gap-8">
                <div className="space-y-[22px]">
                    {/* The phone's navy form header. */}
                    <div className="flex flex-col items-center rounded-[20px] bg-gradient-to-br from-[#1F4788] via-[#2A5DB0] to-[#1F4788] px-5 py-[22px] text-white shadow-[0_10px_20px_rgb(33_120_189/0.24)]">
                        <span className="flex size-12 items-center justify-center rounded-[14px] border border-white/24 bg-white/16">
                            <MdInventory2 className="size-6" />
                        </span>
                        <p className="mt-3.5 text-center text-[17px] font-bold tracking-[-0.2px]">Equipment / Stock Requisition</p>
                    </div>

                    <FormSection icon={MdDescriptionOutline} title="Request Details">
                        <div className="bg-card shadow-card grid gap-3.5 rounded-[18px] border p-4 sm:grid-cols-2">
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
                    </FormSection>
                </div>

                <div className="space-y-[22px] lg:row-span-2">
                    <FormSection icon={MdInventory2Outline} title="Items Required" count={items.length}>
                        {errors.items && <p className="text-sm text-red-600 dark:text-red-400">{errors.items}</p>}
                        {items.length === 0 ? (
                            <div className="bg-card flex flex-col items-center rounded-[18px] border px-4 py-7">
                                <MdInventory2Outline className="size-9 text-gray-400/70" />
                                <p className="text-muted-foreground mt-2.5 text-sm font-semibold">No items added yet</p>
                                <AddItemButton onClick={() => setItems([emptyRow()])} className="mt-4" />
                            </div>
                        ) : (
                            <>
                                <ol className="space-y-3">
                                    {items.map((row, index) => (
                                        <li key={row.key} className="bg-card shadow-card space-y-2.5 rounded-2xl border p-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="bg-primary/10 text-primary dark:bg-primary/20 flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold dark:text-[#6fb3e8]">
                                                    {index + 1}
                                                </span>
                                                {/* Items can't be typed freehand: only what the IT warehouse holds can be requested. */}
                                                <button
                                                    type="button"
                                                    onClick={() => setPickingFor(row.key)}
                                                    aria-label={`Item ${index + 1}: ${row.itemName || 'Select IT warehouse item'}`}
                                                    className="flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                                >
                                                    <span
                                                        className={cn(
                                                            'truncate',
                                                            row.itemName
                                                                ? 'text-foreground text-[14.5px] font-semibold'
                                                                : 'text-muted-foreground/80 text-sm font-medium',
                                                        )}
                                                    >
                                                        {row.itemName || 'Select IT warehouse item'}
                                                    </span>
                                                    <MdArrowDropDown className="text-muted-foreground size-6 shrink-0" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}
                                                    aria-label={`Remove item ${index + 1}`}
                                                    title="Remove item"
                                                    className="hover:bg-accent flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors"
                                                >
                                                    <MdClose className="size-[19px]" />
                                                </button>
                                            </div>
                                            {errors[`row-${row.key}`] && (
                                                <p className="text-xs text-red-600 dark:text-red-400">{errors[`row-${row.key}`]}</p>
                                            )}
                                            <div className="grid grid-cols-2 gap-2.5">
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
                                                        className="text-center font-semibold"
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
                                <AddItemButton onClick={() => setItems((rows) => [...rows, emptyRow()])} />
                            </>
                        )}
                    </FormSection>
                </div>

                <div className="space-y-[22px]">
                    <FormSection icon={MdNotes} title="Notes / Justification">
                        <div className="bg-card shadow-card rounded-[18px] border p-4">
                            <Textarea
                                rows={4}
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="Enter any additional notes or justification for this requisition..."
                                aria-label="Notes / Justification"
                            />
                        </div>
                    </FormSection>

                    {/* The phone's submit bar: a white strip holding the full-width primary button. */}
                    <div className="bg-card shadow-card rounded-[18px] border p-3">
                        <Button type="submit" className="h-[52px] w-full text-[15px]" disabled={isSubmitting || isLoadingReqNo}>
                            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <MdSend />}
                            Submit Requisition
                        </Button>
                    </div>
                </div>
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

/** The phone form's section header: a blue icon, an uppercase grey title, an optional count and a hairline rule. */
function FormSection({ icon: Icon, title, count, children }: { icon: IconType; title: string; count?: number; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="flex items-center gap-2">
                <Icon className="text-primary size-[17px] shrink-0" />
                <span className="text-[12.5px] font-bold tracking-[0.7px] text-gray-700 uppercase dark:text-gray-300">{title}</span>
                {count !== undefined && (
                    <span className="bg-primary/10 text-primary dark:bg-primary/20 rounded-full px-[7px] py-0.5 text-[11px] leading-tight font-bold dark:text-[#6fb3e8]">
                        {count}
                    </span>
                )}
                <span className="bg-border ml-0.5 h-px flex-1" aria-hidden="true" />
            </h2>
            {children}
        </section>
    );
}

function AddItemButton({ onClick, className }: { onClick: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'border-primary/35 text-primary hover:bg-primary/5 flex w-full items-center justify-center gap-2 rounded-[14px] border-[1.3px] py-3.5 text-sm font-bold transition-colors dark:text-[#6fb3e8]',
                className,
            )}
        >
            <MdAddCircleOutline className="size-[19px]" />
            Add Item
        </button>
    );
}
