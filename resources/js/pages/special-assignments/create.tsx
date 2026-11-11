import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { EmptyState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
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
import { LoaderCircle, Lock } from '@/components/icons';
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
            <Page title="New Special Assignment" back={back} width="narrow">
                <EmptyState icon={Lock} title="Only Cluster Leaders can create special assignments." />
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

    return (
        <Page title="New Special Assignment" description="Assign work to your team" back={back} width="narrow">
            <form onSubmit={submit} className="bg-card space-y-4 rounded-xl border p-5 shadow-xs">
                <Field label="Location" htmlFor="location" error={errors.location} required>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Description" htmlFor="description" error={errors.description} required>
                    <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
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
                <Field label="Assign To" hint="The first technician you tick is the Primary Technician, who logs the daily updates.">
                    {technicians.isLoading ? (
                        <p className="text-muted-foreground text-sm">Loading technicians...</p>
                    ) : technicians.error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{technicians.error}</p>
                    ) : (technicians.data ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-sm">No technicians found in your cluster.</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto rounded-md border">
                            {technicians.data!.map((t) => (
                                <label key={t.userId} className="hover:bg-accent flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="accent-primary size-4"
                                        checked={selected.includes(t.userId)}
                                        onChange={(e) =>
                                            setSelected((current) =>
                                                e.target.checked ? [...current, t.userId] : current.filter((id) => id !== t.userId),
                                            )
                                        }
                                    />
                                    <span className="flex-1">{t.fullName}</span>
                                    {selected[0] === t.userId && <span className="text-muted-foreground text-xs">Primary</span>}
                                </label>
                            ))}
                        </div>
                    )}
                </Field>
                <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <LoaderCircle className="animate-spin" />}
                    Create Assignment
                </Button>
            </form>
        </Page>
    );
}
