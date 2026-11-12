import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { LoaderCircle, MdErrorOutline, MdGroupsOutline, MdLockOutline } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { fromDateInputValue, TRANSPORT_MODES } from '@/lib/format';
import { specialAssignments } from '@/lib/fuelops-api';
import { selectClassName } from '@/pages/projects/index';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function CreateSpecialAssignment() {
    const { auth } = usePage<SharedData>().props;
    const isClusterLeader = auth.user.isClusterLeader;
    const technicians = useApiQuery(() => specialAssignments.eligibleTechnicians(), [], { enabled: isClusterLeader });
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [transportMode, setTransportMode] = useState('');
    const [expected, setExpected] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const back = { href: route('special-assignments.index'), label: 'Special Assignments' };

    if (!isClusterLeader) {
        return (
            <Page title="New Special Assignment" description="Assign work to your team" back={back} width="narrow">
                <EmptyState icon={MdLockOutline} title="Only Cluster Leaders can create special assignments." />
            </Page>
        );
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (location.trim() === '') next.location = 'Location is required';
        if (description.trim() === '') next.description = 'Description is required';
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        if (selected.length === 0) {
            toast.error('Select at least one technician');
            return;
        }
        setSubmitting(true);
        try {
            await specialAssignments.create({
                location: location.trim(),
                description: description.trim(),
                technicianUserIds: selected,
                transportMode: transportMode || null,
                expectedCompletionDate: expected ? fromDateInputValue(expected) : null,
            });
            toast.success('Special assignment created');
            router.visit(route('special-assignments.index'));
        } catch (e) {
            toast.error(errorText(e));
            setSubmitting(false);
        }
    };

    const list = technicians.data ?? [];

    return (
        <Page title="New Special Assignment" description="Assign work to your team" back={back} width="narrow">
            <form onSubmit={submit} className="bg-card shadow-card space-y-4 rounded-[18px] border p-5" noValidate>
                <Field label="Location" htmlFor="location" error={errors.location} required>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Description" htmlFor="description" error={errors.description} required>
                    <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Transport Mode (optional)" htmlFor="transport">
                        <select id="transport" className={selectClassName} value={transportMode} onChange={(e) => setTransportMode(e.target.value)}>
                            <option value="">-</option>
                            {TRANSPORT_MODES.map((mode) => (
                                <option key={mode} value={mode}>
                                    {mode}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Expected Completion (optional)" htmlFor="expected">
                        <Input id="expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
                    </Field>
                </div>

                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground text-sm font-semibold">Assign To</p>
                        {selected.length > 0 && <span className="text-primary text-xs font-semibold">{selected.length} selected</span>}
                    </div>
                    <p className="text-muted-foreground text-xs">The first technician you tick is the Primary Technician, who logs the daily updates.</p>
                    {technicians.isLoading ? (
                        <div className="flex justify-center py-4">
                            <LoaderCircle className="text-primary size-6 animate-spin" />
                        </div>
                    ) : technicians.error ? (
                        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                            <MdErrorOutline className="size-4 shrink-0" /> {technicians.error}
                        </p>
                    ) : list.length === 0 ? (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
                            <MdGroupsOutline className="size-4 shrink-0" /> No technicians found in your cluster.
                        </p>
                    ) : (
                        <div className="bg-input max-h-72 overflow-y-auto rounded-[14px] border p-1">
                            {list.map((t) => (
                                <label key={t.userId} className="hover:bg-primary/6 flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm">
                                    <input
                                        type="checkbox"
                                        className="accent-primary size-[18px] shrink-0"
                                        checked={selected.includes(t.userId)}
                                        onChange={(e) =>
                                            setSelected((current) =>
                                                e.target.checked ? [...current, t.userId] : current.filter((id) => id !== t.userId),
                                            )
                                        }
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium">{t.fullName}</span>
                                    {selected[0] === t.userId && <Pill tone="blue">Primary</Pill>}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
                    {submitting && <LoaderCircle className="animate-spin" />}
                    Create Assignment
                </Button>
            </form>
        </Page>
    );
}
