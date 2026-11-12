import { Field } from '@/components/fuelops/field';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { LoaderCircle, MdDescription, MdHealthAndSafety, MdInventory2Outline, MdSend, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { type Tone } from '@/lib/format';
import { compliance, stations } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { selectClassName } from '@/pages/projects/index';
import { type ComplianceCertificateSummary } from '@/types/fuelops';
import { FormEvent, useEffect, useState } from 'react';

const ITEM_CATALOG: Record<string, string[]> = {
    PPEs: ['Safety Boots', 'Rain Coats', 'Helmet', 'Reflective Vests', 'Goggles', 'Gas Masks', 'Uniforms'],
    'Safety and Emergency Equipment': [
        'Fire Alarm',
        'Smoke Detector',
        'Breaker',
        'CCTV',
        'Metal Cone',
        'Caution Sign',
        'No Parking / Stopping Stand',
        'First Aid Box',
        'Sand Box',
        'Warning Tapes',
        'DP - 9KG',
        'DP - 25KG',
        'CO2 - 5KG',
        'CO2 - 10KG',
    ],
    'Regulatory Document': [
        'NPA',
        'EPA',
        'GNFS',
        'GNFS Training',
        'Factorate & Inspectorate',
        'BOP',
        'Property Rate',
        'Signage Bill',
        'Ground Rent',
        'Environmental and Sustainability',
        'Tank Cleaning, Integrity & Calibration',
    ],
    'Compliance Stationery and Equipment': [
        'Sampling Can',
        'Thermometer',
        '10L Can',
        'CSA Record Book',
        'Notice Boards',
        'Water Paste',
        'Dipping Paste',
        'T-Bar',
        'Money Counter',
        'Station Stamp',
        'Fuel Filter',
        'Mattress',
        'Office Tables',
        'Office Chairs',
        'Visitors Chairs',
        'Forecourt Bin',
        'Zoomlion Bin',
        'Receipt Booklets',
    ],
    'Stickers and Boards': [
        'Emergency Assembly Point',
        'Emergency Response Plan',
        'Highly Inflammable',
        'Disclaimer',
        'Dispenser Warning Stickers',
        'Dispenser Label Stickers (RON 91)',
        'Dispenser Label Stickers (RON 95)',
        'Dispenser Label Stickers (Diesel)',
        'Car Tank Stickers',
        'Complain & Suggestion Board',
        'Product Spillage & Control',
    ],
    Others: ['Sponsorship', 'Symposium'],
};
const CATEGORIES = Object.keys(ITEM_CATALOG);
const PRIORITIES = ['Normal', 'High'];


type Tab = 'request' | 'mine' | 'certificates';

/** Matches the web dashboard's colour rule: past expiry is red, within the alert window amber, otherwise green. */
function certificateState(certificate: ComplianceCertificateSummary): 'expired' | 'due' | 'ok' {
    if (certificate.daysLeft < 0) return 'expired';
    const window = certificate.alertRule.includes('60') ? 60 : 30;
    return certificate.daysLeft <= window ? 'due' : 'ok';
}

const CERTIFICATE_COLORS = { expired: '#EF4444', due: '#FFA726', ok: '#43A047' } as const;

/** A badge colour for a request's status text; unknown statuses stay grey. */
function requestTone(status: string): Tone {
    const s = status.toLowerCase();
    if (/(reject|declin|cancel)/.test(s)) return 'red';
    if (/(supplied|complete|closed|deliver|fulfil)/.test(s)) return 'green';
    if (/(approv|progress|process)/.test(s)) return 'blue';
    if (/(pending|new|open|await|submitted)/.test(s)) return 'amber';
    return 'slate';
}

export default function ComplianceIndex() {
    const [tab, setTab] = useState<Tab>('request');
    const myRequests = useApiQuery(() => compliance.myRequests());
    const certificates = useApiQuery(() => compliance.certificates());

    const tabs: [Tab, string][] = [
        ['request', 'Request Item'],
        ['mine', 'My Requests'],
        ['certificates', 'Certificates'],
    ];

    const activeQuery = tab === 'mine' ? myRequests : tab === 'certificates' ? certificates : null;

    return (
        <Page
            title="Compliance"
            back={{ href: '/tickets', label: 'Tickets' }}
            actions={
                activeQuery && (
                    <Button variant="secondary" size="sm" onClick={activeQuery.reload} disabled={activeQuery.isFetching}>
                        <RefreshCw className={cn(activeQuery.isFetching && 'animate-spin')} /> Refresh
                    </Button>
                )
            }
        >
            {/* The phone's TabBar: blue label and underline on the active tab, grey otherwise. */}
            <div role="tablist" className="-mx-4 flex border-b sm:mx-0">
                {tabs.map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={cn(
                            'relative flex-1 px-2 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-6',
                            tab === value ? 'text-primary dark:text-[#6fb3e8]' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {label}
                        {tab === value && <span className="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full" aria-hidden="true" />}
                    </button>
                ))}
            </div>

            {tab === 'request' && (
                <RequestForm
                    onSubmitted={() => {
                        myRequests.reload();
                        setTab('mine');
                    }}
                />
            )}

            {tab === 'mine' && (
                <QueryView
                    query={myRequests}
                    empty={(data) =>
                        data.length === 0 && (
                            <EmptyState
                                icon={MdInventory2Outline}
                                title="No compliance requests yet."
                                description="Items you request from the Request Item tab will appear here."
                            />
                        )
                    }
                >
                    {(data) => (
                        <ul className="grid gap-2.5 md:grid-cols-2">
                            {data.map((request) => (
                                <li key={request.requestId} className="bg-card shadow-card flex items-center gap-3 rounded-[14px] border p-3.5">
                                    <IconTile icon={MdInventory2Outline} color="#2178BD" />
                                    <span className="min-w-0 flex-1">
                                        <span className="text-foreground block truncate text-[14.5px] font-bold">
                                            {request.itemName} × {request.requestedQuantity}
                                        </span>
                                        <span className="text-muted-foreground block truncate text-[12.5px]">
                                            {request.ticketNumber} · {request.requestClass}
                                        </span>
                                        {request.suppliedQuantity != null && (
                                            <span className="text-muted-foreground block text-[12px]">Supplied: {request.suppliedQuantity}</span>
                                        )}
                                    </span>
                                    <Pill tone={requestTone(request.status)}>{request.status}</Pill>
                                </li>
                            ))}
                        </ul>
                    )}
                </QueryView>
            )}

            {tab === 'certificates' && (
                <QueryView
                    query={certificates}
                    empty={(data) => data.length === 0 && <EmptyState icon={MdDescription} title="No certificates tracked for your station." />}
                >
                    {(data) => (
                        <ul className="grid gap-2.5 md:grid-cols-2">
                            {data.map((certificate) => {
                                const state = certificateState(certificate);
                                const color = CERTIFICATE_COLORS[state];
                                return (
                                    <li
                                        key={certificate.id}
                                        className="bg-card shadow-card relative flex items-center gap-3 overflow-hidden rounded-[14px] border p-3.5 pl-4"
                                    >
                                        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
                                        <IconTile icon={MdDescription} color={color} className="rounded-full" />
                                        <span className="min-w-0 flex-1">
                                            <span className="text-foreground block truncate text-[14.5px] font-bold">{certificate.documentType}</span>
                                            <span className="text-muted-foreground block text-[12.5px]">
                                                Expires {certificate.expiryDate ?? '—'} ({certificate.daysLeft} days left)
                                            </span>
                                        </span>
                                        <Pill tone={state === 'expired' ? 'red' : state === 'due' ? 'orange' : 'green'}>
                                            {state === 'expired' ? 'EXPIRED' : state === 'due' ? 'DUE SOON' : 'VALID'}
                                        </Pill>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </QueryView>
            )}
        </Page>
    );
}

function RequestForm({ onSubmitted }: { onSubmitted: () => void }) {
    const myStations = useApiQuery(() => stations.mine());
    const [stationId, setStationId] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [priority, setPriority] = useState(PRIORITIES[0]);
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Preselect when the user supervises a single station.
    useEffect(() => {
        if (myStations.data?.length === 1) setStationId(myStations.data[0].id);
    }, [myStations.data]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const found: Record<string, string> = {};
        if (stationId === '') found.station = 'Select a station';
        if (itemName === '') found.item = 'Select an item';
        if (!/^\d+$/.test(quantity.trim()) || Number(quantity) < 1) found.quantity = 'Enter a valid quantity';
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setIsSubmitting(true);
        try {
            const ticketNumber = await compliance.submitRequest({
                customerId: stationId,
                requestClass: category,
                itemName,
                requestedQuantity: Number(quantity),
                priority,
                description: description.trim() || null,
            });
            toast.success(`Request submitted — ticket ${ticketNumber}`);
            setQuantity('');
            setDescription('');
            setItemName('');
            onSubmitted();
        } catch (e) {
            toast.error(errorText(e, 'Failed to submit compliance request'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={submit} className="bg-card shadow-card space-y-4 rounded-[18px] border p-4 sm:p-6" noValidate>
            <div className="flex items-center gap-3 pb-1">
                <IconTile icon={MdHealthAndSafety} color="#2178BD" />
                <div className="min-w-0">
                    <p className="text-foreground text-[15px] font-bold">Request a compliance item</p>
                    <p className="text-muted-foreground text-[12.5px]">PPEs, safety equipment, documents, stationery and signage.</p>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Field
                    label="Station"
                    htmlFor="station"
                    error={errors.station ?? (myStations.error && !myStations.data ? myStations.error : null)}
                    required
                    className="md:col-span-2"
                >
                    <select id="station" value={stationId} onChange={(event) => setStationId(event.target.value)} className={selectClassName}>
                        <option value="">{myStations.isLoading ? 'Loading stations...' : 'Select station'}</option>
                        {(myStations.data ?? []).map((station) => (
                            <option key={station.id} value={station.id}>
                                {station.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Category" htmlFor="category">
                    <select
                        id="category"
                        value={category}
                        onChange={(event) => {
                            setCategory(event.target.value);
                            setItemName('');
                        }}
                        className={selectClassName}
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Item" htmlFor="item" error={errors.item} required>
                    <select id="item" value={itemName} onChange={(event) => setItemName(event.target.value)} className={selectClassName}>
                        <option value="">Select item</option>
                        {ITEM_CATALOG[category].map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Quantity" htmlFor="quantity" error={errors.quantity} required>
                    <Input
                        id="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                    />
                </Field>
                <Field label="Priority" htmlFor="priority">
                    <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)} className={selectClassName}>
                        {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Description (optional)" htmlFor="description" className="md:col-span-2">
                    <Textarea
                        id="description"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="What necessitates this request?"
                    />
                </Field>
            </div>
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : <MdSend />}
                Submit Request
            </Button>
        </form>
    );
}
