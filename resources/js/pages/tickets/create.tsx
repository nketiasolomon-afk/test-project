import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { ErrorState, LoadingState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { stations, tickets } from '@/lib/fuelops-api';
import { router } from '@inertiajs/react';
import { LoaderCircle, Paperclip, X } from '@/components/icons';
import { FormEvent, useEffect, useRef, useState } from 'react';

const CATEGORIES = [
    'Canopy Repairs',
    'Lighting System',
    'Civil (Building)',
    'Civil (Forecourt)',
    'Signage',
    'Electrical',
    'Mechanical',
    'Generator',
    'Accidents',
    'Dispenser',
    'Sanitary',
    'Water-In-Tank',
    'Compliance Related',
    'IT Related',
    'Others',
];

const RELATED_ASSETS = ['Dispenser', 'Signage', 'Canopy', 'Generator', 'Underground Storage Tank (UST)', 'Office/Building'];

const PRIORITIES = ['Normal', 'High', 'Critical'];

const selectClass =
    'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden';

/**
 * Station Leader issue reporting, the counterpart of the ERP's "New Issue" page. Tickets are
 * routed by the cluster defaults; there is no manual technician picking here.
 */
export default function CreateTicket() {
    const myStations = useApiQuery(() => stations.mine());
    const [stationId, setStationId] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [relatedAsset, setRelatedAsset] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [priority, setPriority] = useState(PRIORITIES[0]);
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    // A Station Leader with a single station gets it preselected.
    useEffect(() => {
        if (myStations.data?.length === 1) setStationId(myStations.data[0].id);
    }, [myStations.data]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (stationId === '') {
            toast.error('Select a station');
            return;
        }
        if (description.trim() === '') {
            setDescriptionError('Describe the issue');
            return;
        }
        setIsSubmitting(true);
        try {
            const ticketNumber = await tickets.create({
                customerId: stationId,
                category,
                relatedAsset: relatedAsset || null,
                modelNumber: category === 'Dispenser' ? modelNumber.trim() || null : null,
                serialNumber: category === 'Dispenser' ? serialNumber.trim() || null : null,
                priority,
                description: description.trim(),
                attachment,
            });
            toast.success(`Issue reported — ticket ${ticketNumber}`);
            router.visit(route('tickets.index'));
        } catch (e) {
            toast.error(errorText(e));
            setIsSubmitting(false);
        }
    };

    return (
        <Page title="Report an Issue" back={{ href: route('tickets.index'), label: 'Tickets' }} width="narrow">
            {myStations.isLoading ? (
                <LoadingState rows={3} />
            ) : myStations.data === undefined ? (
                <ErrorState message={myStations.error ?? 'Failed to load stations'} onRetry={myStations.reload} />
            ) : (
                <form onSubmit={submit} className="bg-card space-y-5 rounded-xl border p-5 shadow-xs">
                    <Field label="Station" htmlFor="station" required>
                        <select id="station" className={selectClass} value={stationId} onChange={(e) => setStationId(e.target.value)}>
                            <option value="">Select station</option>
                            {myStations.data.map((station) => (
                                <option key={station.id} value={station.id}>
                                    {station.name}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Category" htmlFor="category" required>
                        <select id="category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                            {CATEGORIES.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Related Asset (optional)" htmlFor="related-asset">
                        <select id="related-asset" className={selectClass} value={relatedAsset} onChange={(e) => setRelatedAsset(e.target.value)}>
                            <option value="">Select asset</option>
                            {RELATED_ASSETS.map((a) => (
                                <option key={a}>{a}</option>
                            ))}
                        </select>
                    </Field>

                    {category === 'Dispenser' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Model Number" htmlFor="model-number">
                                <Input id="model-number" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
                            </Field>
                            <Field label="Serial Number" htmlFor="serial-number">
                                <Input id="serial-number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                            </Field>
                        </div>
                    )}

                    <Field label="Priority" htmlFor="priority" required>
                        <select id="priority" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                            {PRIORITIES.map((p) => (
                                <option key={p}>{p}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Description" htmlFor="description" error={descriptionError} required>
                        <Textarea
                            id="description"
                            rows={5}
                            value={description}
                            placeholder="Describe the issue..."
                            onChange={(e) => {
                                setDescription(e.target.value);
                                setDescriptionError(null);
                            }}
                        />
                    </Field>

                    <Field label="Photo (optional)">
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                setAttachment(e.target.files?.[0] ?? null);
                                e.target.value = '';
                            }}
                        />
                        {attachment ? (
                            <div className="flex items-center gap-2 text-sm">
                                <Paperclip className="text-muted-foreground size-4" />
                                <span className="truncate">{attachment.name}</span>
                                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove photo" className="hover:text-destructive">
                                    <X className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => fileInput.current?.click()}>
                                <Paperclip /> Attach Photo
                            </Button>
                        )}
                    </Field>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting && <LoaderCircle className="animate-spin" />}
                        Submit Issue
                    </Button>
                </form>
            )}
        </Page>
    );
}
