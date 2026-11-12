import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { ErrorState, LoadingState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { LoaderCircle, MdArrowDropDown, MdCameraAltOutline, MdClose, MdPhotoLibraryOutline, MdSend } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { stations, tickets } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

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

/** A native select dressed as the phone's filled dropdown field. */
function SelectField({ className, children, ...props }: React.ComponentProps<'select'>) {
    return (
        <div className="relative">
            <select
                {...props}
                className={cn(
                    'border-border bg-input focus-visible:border-primary focus-visible:ring-primary h-12 w-full appearance-none rounded-[14px] border pr-10 pl-4 text-base outline-hidden focus-visible:ring-1 md:text-sm',
                    className,
                )}
            >
                {children}
            </select>
            <MdArrowDropDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2" />
        </div>
    );
}

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
    const cameraInput = useRef<HTMLInputElement>(null);
    const galleryInput = useRef<HTMLInputElement>(null);
    const preview = useMemo(() => (attachment ? URL.createObjectURL(attachment) : null), [attachment]);

    useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

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

    const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAttachment(e.target.files?.[0] ?? null);
        e.target.value = '';
    };

    return (
        <Page title="Report an Issue" back={{ href: route('tickets.index'), label: 'Tickets' }} width="narrow">
            {myStations.isLoading ? (
                <LoadingState rows={3} />
            ) : myStations.data === undefined ? (
                <ErrorState message={myStations.error ?? 'Failed to load stations'} onRetry={myStations.reload} />
            ) : (
                <form onSubmit={submit} className="bg-card shadow-card space-y-4 rounded-[18px] border p-4 sm:p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Station" htmlFor="station" required>
                            <SelectField id="station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                                <option value="">Select station</option>
                                {myStations.data.map((station) => (
                                    <option key={station.id} value={station.id}>
                                        {station.name}
                                    </option>
                                ))}
                            </SelectField>
                        </Field>

                        <Field label="Category" htmlFor="category" required>
                            <SelectField id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                                {CATEGORIES.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </SelectField>
                        </Field>

                        <Field label="Related Asset (optional)" htmlFor="related-asset">
                            <SelectField id="related-asset" value={relatedAsset} onChange={(e) => setRelatedAsset(e.target.value)}>
                                <option value="">Select asset</option>
                                {RELATED_ASSETS.map((a) => (
                                    <option key={a}>{a}</option>
                                ))}
                            </SelectField>
                        </Field>

                        <Field label="Priority" htmlFor="priority" required>
                            <SelectField id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                                {PRIORITIES.map((p) => (
                                    <option key={p}>{p}</option>
                                ))}
                            </SelectField>
                        </Field>

                        {category === 'Dispenser' && (
                            <>
                                <Field label="Model Number" htmlFor="model-number">
                                    <Input id="model-number" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
                                </Field>
                                <Field label="Serial Number" htmlFor="serial-number">
                                    <Input id="serial-number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                                </Field>
                            </>
                        )}
                    </div>

                    <Field label="Description" htmlFor="description" error={descriptionError} required>
                        <Textarea
                            id="description"
                            rows={4}
                            value={description}
                            placeholder="Describe the issue..."
                            onChange={(e) => {
                                setDescription(e.target.value);
                                setDescriptionError(null);
                            }}
                        />
                    </Field>

                    <Field label="Photo (optional)">
                        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
                        <input ref={galleryInput} type="file" accept="image/*" hidden onChange={pickFile} />
                        <div className="flex flex-wrap gap-2.5">
                            <Button type="button" variant="outline" size="sm" onClick={() => cameraInput.current?.click()}>
                                <MdCameraAltOutline /> Take Photo
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => galleryInput.current?.click()}>
                                <MdPhotoLibraryOutline /> Gallery
                            </Button>
                        </div>
                        {attachment && preview && (
                            <div className="relative mt-1 overflow-hidden rounded-xl border">
                                <img src={preview} alt={attachment.name} className="h-[140px] w-full object-cover sm:h-[200px]" />
                                <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                                    {attachment.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setAttachment(null)}
                                    aria-label="Remove photo"
                                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
                                >
                                    <MdClose className="size-4" />
                                </button>
                            </div>
                        )}
                    </Field>

                    <Button type="submit" className="mt-2 h-12 w-full" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : <MdSend />}
                        Submit Issue
                    </Button>
                </form>
            )}
        </Page>
    );
}
