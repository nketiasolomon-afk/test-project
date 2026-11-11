import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { compliance, stations } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type ComplianceCertificateSummary } from '@/types/fuelops';
import { FileText, LoaderCircle, Send, ShieldCheck } from 'lucide-react';
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

const selectClass = 'border-input bg-background h-10 w-full rounded-md border px-3 text-sm';

/** Matches the web dashboard's colour rule: past expiry is red, within the alert window amber, otherwise green. */
function certificateState(certificate: ComplianceCertificateSummary): 'expired' | 'due' | 'ok' {
    if (certificate.daysLeft < 0) return 'expired';
    const window = certificate.alertRule.includes('60') ? 60 : 30;
    return certificate.daysLeft <= window ? 'due' : 'ok';
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

    return (
        <Page title="Compliance" back={{ href: '/tickets', label: 'Tickets' }} width="narrow">
            <div role="tablist" className="bg-muted inline-flex w-full gap-1 rounded-lg p-1">
                {tabs.map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={cn(
                            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            tab === value ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {label}
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
                    empty={(data) => data.length === 0 && <EmptyState icon={ShieldCheck} title="No compliance requests yet." />}
                >
                    {(data) => (
                        <ul className="space-y-2">
                            {data.map((request) => (
                                <li key={request.requestId} className="bg-card flex items-center gap-3 rounded-xl border p-3">
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium">
                                            {request.itemName} × {request.requestedQuantity}
                                        </span>
                                        <span className="text-muted-foreground block text-xs">
                                            {request.ticketNumber} · {request.requestClass}
                                        </span>
                                        {request.suppliedQuantity != null && (
                                            <span className="text-muted-foreground block text-xs">Supplied: {request.suppliedQuantity}</span>
                                        )}
                                    </span>
                                    <Pill>{request.status}</Pill>
                                </li>
                            ))}
                        </ul>
                    )}
                </QueryView>
            )}

            {tab === 'certificates' && (
                <QueryView
                    query={certificates}
                    empty={(data) => data.length === 0 && <EmptyState icon={FileText} title="No certificates tracked for your station." />}
                >
                    {(data) => (
                        <ul className="space-y-2">
                            {data.map((certificate) => {
                                const state = certificateState(certificate);
                                const color =
                                    state === 'expired'
                                        ? 'bg-red-600/15 text-red-600'
                                        : state === 'due'
                                          ? 'bg-orange-500/15 text-orange-600'
                                          : 'bg-green-600/15 text-green-600';
                                return (
                                    <li key={certificate.id} className="bg-card flex items-center gap-3 rounded-xl border p-3">
                                        <span className={cn('flex size-10 items-center justify-center rounded-full', color)}>
                                            <FileText className="size-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{certificate.documentType}</span>
                                            <span className="text-muted-foreground block text-xs">
                                                Expires {certificate.expiryDate ?? '—'} ({certificate.daysLeft} days left)
                                            </span>
                                        </span>
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
        <form onSubmit={submit} className="bg-card space-y-4 rounded-xl border p-4" noValidate>
            <Field
                label="Station"
                htmlFor="station"
                error={errors.station ?? (myStations.error && !myStations.data ? myStations.error : null)}
                required
            >
                <select id="station" value={stationId} onChange={(event) => setStationId(event.target.value)} className={selectClass}>
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
                    className={selectClass}
                >
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Item" htmlFor="item" error={errors.item} required>
                <select id="item" value={itemName} onChange={(event) => setItemName(event.target.value)} className={selectClass}>
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
                <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)} className={selectClass}>
                    {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Description (optional)" htmlFor="description">
                <Textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What necessitates this request?"
                />
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
                Submit Request
            </Button>
        </form>
    );
}
