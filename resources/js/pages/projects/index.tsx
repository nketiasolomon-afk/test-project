import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { PhotoPicker } from '@/components/fuelops/photo-picker';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDate, fromDateInputValue, timeAgo, toDateInputValue, TRANSPORT_MODES } from '@/lib/format';
import { dashboards, isProjectClosed, isProjectLedBy, projects, type DailyUpdateInput } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type Project } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { Car, FileText, FolderKanban, LoaderCircle, Lock, MapPin, Plus, RefreshCw, Star, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export const selectClassName =
    'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:opacity-50';

/** Completion bar with its percentage. */
export function CompletionBar({ percent }: { percent: number }) {
    const value = Math.max(0, Math.min(100, percent));
    return (
        <div className="flex items-center gap-3">
            <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
            </div>
            <span className="text-sm font-semibold">{value}%</span>
        </div>
    );
}

interface CrewOptionRow {
    id: string;
    fullName: string;
    role?: string;
    onTeam: boolean;
}

/**
 * The shared "daily update" form (date, completion %, technicians with a mode of transport,
 * work summary, photos and optionally a report document), used for projects and special
 * assignments. Exported so the special assignments page can reuse it.
 */
export function DailyUpdateDialog({
    open,
    onOpenChange,
    formTitle,
    itemTitle,
    team,
    teamTag,
    currentCompletion,
    summaryLabel,
    allowReport = false,
    confirmCloseAtFullCompletion = false,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formTitle: string;
    itemTitle: string;
    /** Names of the item's own team, listed first in the technician picker. */
    team: string[];
    teamTag: string;
    currentCompletion: number;
    summaryLabel: string;
    allowReport?: boolean;
    confirmCloseAtFullCompletion?: boolean;
    onSubmit: (input: DailyUpdateInput & { report?: File | null }) => Promise<void>;
}) {
    const roster = useApiQuery(() => dashboards.technicianStats(), [], { enabled: open });
    const [date, setDate] = useState(() => toDateInputValue(new Date()));
    const [completion, setCompletion] = useState('');
    const [summary, setSummary] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [modes, setModes] = useState<Record<string, string>>({});
    const [photos, setPhotos] = useState<File[]>([]);
    const [report, setReport] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirmClose, setConfirmClose] = useState(false);
    const [saving, setSaving] = useState(false);
    const reportInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setDate(toDateInputValue(new Date()));
            setCompletion('');
            setSummary('');
            setSelected([]);
            setModes({});
            setPhotos([]);
            setReport(null);
            setErrors({});
            setConfirmClose(false);
        }
    }, [open]);

    // The roster with the item's team listed first, or just the team when the roster is unavailable.
    const options = useMemo<CrewOptionRow[]>(() => {
        const teamNames = team.filter((name) => name.trim() !== '').map((name) => name.trim().toLowerCase());
        const stats = (roster.data ?? []).filter((t) => t.technicianId !== '');
        if (stats.length === 0) {
            return team.filter((name) => name.trim() !== '').map((name) => ({ id: name, fullName: name, onTeam: true }));
        }
        return stats
            .map((t) => ({ id: t.technicianId, fullName: t.fullName, role: t.role, onTeam: teamNames.includes(t.fullName.trim().toLowerCase()) }))
            .sort((a, b) => Number(b.onTeam) - Number(a.onTeam) || a.fullName.localeCompare(b.fullName));
    }, [roster.data, team]);

    const toggle = (id: string) => {
        setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    };

    const validate = (): number | null => {
        const next: Record<string, string> = {};
        const n = Number(completion.trim());
        if (completion.trim() === '') next.completion = 'Required';
        else if (!Number.isInteger(n) || n < 0 || n > 100) next.completion = '0-100';
        if (!fromDateInputValue(date)) next.date = 'Required';
        if (summary.trim() === '') next.summary = 'Describe the work done';
        if (selected.length === 0) next.technicians = 'Select the technicians who worked today';
        else if (selected.some((id) => !modes[id])) next.technicians = 'Pick a mode of transport for each technician';
        setErrors(next);
        return Object.keys(next).length === 0 ? Math.max(0, Math.min(100, n)) : null;
    };

    const save = async (skipConfirm = false) => {
        const percent = validate();
        if (percent === null) return;
        if (percent === 100 && confirmCloseAtFullCompletion && !skipConfirm) {
            setConfirmClose(true);
            return;
        }
        setConfirmClose(false);
        setSaving(true);
        try {
            await onSubmit({
                updateDate: fromDateInputValue(date)!,
                completionPercentage: percent,
                workSummary: summary.trim(),
                technicians: selected.map((id) => ({ technician_id: id, transport_mode: modes[id] })),
                photos,
                report,
            });
            toast.success(`Update saved for ${itemTitle}`);
            onOpenChange(false);
        } catch (e) {
            toast.error(`Failed to save update: ${errorText(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const nameOf = (id: string) => options.find((o) => o.id === id)?.fullName ?? id;

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{formTitle}</DialogTitle>
                    <DialogDescription>{itemTitle}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date" htmlFor="update-date" error={errors.date} required>
                        <Input id="update-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <Field label="Completion (%)" htmlFor="update-completion" error={errors.completion} hint={`Now ${currentCompletion}%`} required>
                        <Input
                            id="update-completion"
                            type="number"
                            min={0}
                            max={100}
                            value={completion}
                            onChange={(e) => setCompletion(e.target.value)}
                        />
                    </Field>
                </div>

                <Field label="Technicians" error={errors.technicians} required>
                    <div className="max-h-48 overflow-y-auto rounded-md border">
                        {roster.isLoading ? (
                            <p className="text-muted-foreground p-3 text-sm">Loading technicians...</p>
                        ) : options.length === 0 ? (
                            <p className="text-muted-foreground p-3 text-sm">No technicians found.</p>
                        ) : (
                            options.map((option) => (
                                <label key={option.id} className="hover:bg-accent flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="accent-primary size-4"
                                        checked={selected.includes(option.id)}
                                        onChange={() => toggle(option.id)}
                                    />
                                    <span className="flex-1">{option.fullName}</span>
                                    {option.onTeam && <Pill tone="blue">{teamTag}</Pill>}
                                </label>
                            ))
                        )}
                    </div>
                </Field>

                <Field label="Mode of Transport per Technician">
                    {selected.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No technicians selected yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {selected.map((id) => (
                                <div key={id} className="flex items-center gap-3">
                                    <span className="w-1/2 truncate text-sm font-medium">{nameOf(id)}</span>
                                    <select
                                        aria-label={`Mode of transport for ${nameOf(id)}`}
                                        className={selectClassName}
                                        value={modes[id] ?? ''}
                                        onChange={(e) => setModes((current) => ({ ...current, [id]: e.target.value }))}
                                    >
                                        <option value="">Select mode</option>
                                        {TRANSPORT_MODES.map((mode) => (
                                            <option key={mode} value={mode}>
                                                {mode}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </Field>

                <Field label={summaryLabel} htmlFor="update-summary" error={errors.summary} required>
                    <Textarea
                        id="update-summary"
                        rows={4}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Describe today's progress..."
                    />
                </Field>

                <Field label="Photos">
                    <PhotoPicker files={photos} onChange={setPhotos} disabled={saving} />
                </Field>

                {allowReport && (
                    <Field label="Report">
                        <input
                            ref={reportInput}
                            type="file"
                            hidden
                            onChange={(e) => {
                                setReport(e.target.files?.[0] ?? null);
                                e.target.value = '';
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => reportInput.current?.click()}>
                                <FileText /> Attach Report
                            </Button>
                            <span className="text-muted-foreground truncate text-sm">{report ? report.name : 'No file chosen'}</span>
                            {report && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => setReport(null)} aria-label="Remove report">
                                    <X />
                                </Button>
                            )}
                        </div>
                    </Field>
                )}

                {confirmClose && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <p className="font-semibold">Mark as completed?</p>
                        <p className="text-muted-foreground">
                            Submitting 100% completes {itemTitle} and closes it. You won't be able to post any further updates.
                        </p>
                        <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setConfirmClose(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={() => save(true)}>
                                Complete &amp; close
                            </Button>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={() => save()} disabled={saving || confirmClose}>
                        {saving && <LoaderCircle className="animate-spin" />}
                        Save Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function statusTone(status: string) {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'green' as const;
        case 'active':
            return 'blue' as const;
        default:
            return 'amber' as const;
    }
}

export default function ProjectsIndex() {
    const { auth } = usePage<SharedData>().props;
    const list = useApiQuery(() => projects.mine());
    const [updating, setUpdating] = useState<Project | null>(null);

    const canUpdate = (project: Project) => !isProjectClosed(project) && isProjectLedBy(project, auth.user);

    return (
        <Page
            title="My Projects"
            description="Track project tasks, daily progress %, technician deployment, and manager approvals."
            back={{ href: '/tickets', label: 'Tickets' }}
            actions={
                <Button variant="outline" size="sm" onClick={list.reload} disabled={list.isFetching}>
                    <RefreshCw className={cn(list.isFetching && 'animate-spin')} /> Refresh
                </Button>
            }
        >
            <QueryView
                query={list}
                empty={(items) =>
                    items.length === 0 && (
                        <EmptyState icon={FolderKanban} title="No projects assigned" description="Projects you're deployed to will appear here." />
                    )
                }
            >
                {(items) => (
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-sm font-medium">My Projects ({items.length})</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            {items.map((project) => {
                                const closed = isProjectClosed(project);
                                const editable = canUpdate(project);
                                return (
                                    <article key={project.id} className="bg-card space-y-3 rounded-xl border p-4 shadow-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold">{project.name}</h3>
                                                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                                                    <MapPin className="size-3.5" /> {project.site || '-'}
                                                </p>
                                            </div>
                                            <Pill tone={statusTone(project.status)}>{project.status.toUpperCase()}</Pill>
                                        </div>
                                        <CompletionBar percent={project.completionPercent} />
                                        <dl className="text-muted-foreground space-y-1 text-sm">
                                            {project.teamLeaderName && (
                                                <div className="flex items-center gap-1.5">
                                                    <Star className="size-3.5" /> Team leader: {project.teamLeaderName}
                                                </div>
                                            )}
                                            {project.team.length > 0 && (
                                                <div className="flex items-start gap-1.5">
                                                    <Users className="mt-0.5 size-3.5 shrink-0" /> {project.team.join(', ')}
                                                </div>
                                            )}
                                            {project.modeOfTransport && (
                                                <div className="flex items-center gap-1.5">
                                                    <Car className="size-3.5" /> {project.modeOfTransport}
                                                </div>
                                            )}
                                            <div>
                                                {project.lastUpdate
                                                    ? `Updated ${timeAgo(project.lastUpdate)} (${formatDate(project.lastUpdate)})`
                                                    : 'No updates yet'}
                                            </div>
                                            {project.lastWorkSummary && (
                                                <p className="text-foreground">Latest work summary: {project.lastWorkSummary}</p>
                                            )}
                                        </dl>
                                        {editable ? (
                                            <Button size="sm" onClick={() => setUpdating(project)}>
                                                <Plus /> Add update
                                            </Button>
                                        ) : (
                                            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                                                <Lock className="mt-0.5 size-3.5 shrink-0" />
                                                {closed
                                                    ? 'This project is completed and closed. No further updates can be posted.'
                                                    : project.teamLeaderName
                                                      ? `Only the team leader (${project.teamLeaderName}) can post updates on this project.`
                                                      : 'View only'}
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                )}
            </QueryView>

            {updating && (
                <DailyUpdateDialog
                    open={updating !== null}
                    onOpenChange={(open) => !open && setUpdating(null)}
                    formTitle="Daily Project Update"
                    itemTitle={updating.name}
                    team={updating.team}
                    teamTag="Project team"
                    currentCompletion={updating.completionPercent}
                    summaryLabel="Work Done Summary"
                    allowReport
                    confirmCloseAtFullCompletion
                    onSubmit={async (input) => {
                        const updated = await projects.submitUpdate(updating.id, input);
                        list.setData((current) => current?.map((p) => (p.id === updated.id ? updated : p)));
                        list.reload();
                    }}
                />
            )}
        </Page>
    );
}
