import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { PhotoPicker } from '@/components/fuelops/photo-picker';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import {
    type IconType,
    LoaderCircle,
    MdAttachFile,
    MdChevronRight,
    MdClose,
    MdDescriptionOutline,
    MdDirectionsCarFilledOutline,
    MdFolderOff,
    MdGroupsOutline,
    MdInfoOutline,
    MdLocationOnOutline,
    MdLockOutline,
    MdNotes,
    MdSave,
    MdSchedule,
    MdStarOutline,
    MdVisibilityOutline,
    MdWorkspaces,
    RefreshCw,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDate, fromDateInputValue, timeAgo, toDateInputValue, TRANSPORT_MODES, type Tone } from '@/lib/format';
import { dashboards, isProjectClosed, isProjectLedBy, projects, type DailyUpdateInput } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { type Project } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

/** A native select styled like the phone's filled inputs (48px tall, radius 14). */
export const selectClassName =
    'border-border bg-input text-foreground focus-visible:border-primary focus-visible:ring-primary flex h-12 w-full rounded-[14px] border px-3.5 py-2 text-base focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

/** Completion bar with its percentage, like the phone's 6px LinearProgressIndicator. */
export function CompletionBar({ percent, color = '#2178BD', className }: { percent: number; color?: string; className?: string }) {
    const value = Math.max(0, Math.min(100, percent));
    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-md bg-[#9e9e9e]/12 dark:bg-white/8">
                <div className="h-full rounded-md transition-[width]" style={{ width: `${value}%`, backgroundColor: color }} />
            </div>
            <span className="text-foreground text-[12.5px] font-bold tabular-nums">{value}%</span>
        </div>
    );
}

/**
 * The navy-to-blue hero banner at the top of the phone's Projects and Special Assignments
 * screens: a frosted icon square with a yellow icon, a bold title and a short blurb.
 */
export function HeroBanner({ icon: Icon, title, description }: { icon: IconType; title: string; description: string }) {
    return (
        <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#0B1B33_0%,#15315E_35%,#1F4788_70%,#2178BD_100%)] p-5 shadow-[0_8px_20px_rgb(31_71_136/0.3)]">
            <span
                className="pointer-events-none absolute -top-10 -right-[30px] size-[140px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.08),transparent_70%)]"
                aria-hidden="true"
            />
            <div className="relative flex items-center gap-3">
                <span className="text-brand-yellow flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-white/22 bg-white/14">
                    <Icon className="size-[22px]" />
                </span>
                <h2 className="text-xl font-bold tracking-[-0.2px] text-white">{title}</h2>
            </div>
            <p className="relative mt-2.5 max-w-2xl text-[13px] leading-[1.4] text-white/70">{description}</p>
        </div>
    );
}

/** One grey icon + text line on a phone list card (14px icon, 12.5px medium text). */
export function InfoRow({ icon: Icon, children, className }: { icon: IconType; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-start gap-1 text-[12.5px] font-medium text-[#9e9e9e]', className)}>
            <Icon className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{children}</span>
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
            <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-lg font-bold">{formTitle}</DialogTitle>
                            <DialogDescription className="mt-1 text-[13px] font-semibold">{itemTitle}</DialogDescription>
                        </div>
                        {allowReport && (
                            <>
                                <input
                                    ref={reportInput}
                                    type="file"
                                    hidden
                                    onChange={(e) => {
                                        setReport(e.target.files?.[0] ?? null);
                                        e.target.value = '';
                                    }}
                                />
                                <Button type="button" variant="secondary" size="sm" onClick={() => reportInput.current?.click()} disabled={saving}>
                                    <MdAttachFile /> Attach Report
                                </Button>
                            </>
                        )}
                    </div>
                </DialogHeader>

                {allowReport && report && (
                    <div className="bg-primary/8 flex items-center gap-2 rounded-[10px] py-1 pr-1 pl-3">
                        <MdDescriptionOutline className="text-primary size-[18px] shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{report.name}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-8"
                            onClick={() => setReport(null)}
                            disabled={saving}
                            aria-label="Remove report"
                        >
                            <MdClose />
                        </Button>
                    </div>
                )}

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
                            placeholder="0-100"
                            value={completion}
                            onChange={(e) => setCompletion(e.target.value)}
                        />
                    </Field>
                </div>

                <Field label="Technicians" error={errors.technicians} required>
                    <div className="bg-input max-h-52 overflow-y-auto rounded-[14px] border p-1">
                        {roster.isLoading ? (
                            <p className="text-muted-foreground flex items-center gap-2 p-3 text-[13px]">
                                <LoaderCircle className="size-4 animate-spin" /> Loading technicians...
                            </p>
                        ) : options.length === 0 ? (
                            <p className="text-muted-foreground p-3 text-[13px]">No technicians found.</p>
                        ) : (
                            options.map((option) => (
                                <label
                                    key={option.id}
                                    className="hover:bg-primary/6 flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        className="accent-primary size-[18px] shrink-0"
                                        checked={selected.includes(option.id)}
                                        onChange={() => toggle(option.id)}
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium">{option.fullName}</span>
                                    {option.onTeam && <Pill tone="blue">{teamTag}</Pill>}
                                </label>
                            ))
                        )}
                    </div>
                </Field>

                <Field label="Mode of Transport per Technician">
                    {selected.length === 0 ? (
                        <p className="text-[12.5px] text-[#9e9e9e]">No technicians selected yet.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {selected.map((id) => (
                                <div key={id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                                    <span className="truncate text-[13.5px] font-semibold sm:w-2/5">{nameOf(id)}</span>
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

                {confirmClose && (
                    <div className="rounded-[14px] border border-[#FFA726]/40 bg-[#FFA726]/10 p-3.5 text-sm">
                        <p className="font-bold">Mark as completed?</p>
                        <p className="text-muted-foreground mt-0.5 text-[13px]">
                            Submitting 100% completes {itemTitle} and closes it. You won't be able to post any further updates.
                        </p>
                        <div className="mt-3 flex gap-2">
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
                    <Button
                        onClick={() => save()}
                        disabled={saving || confirmClose}
                        className="bg-brand-yellow text-brand-ink hover:bg-brand-yellow/90 px-6 font-bold shadow-none"
                    >
                        {saving ? <LoaderCircle className="animate-spin" /> : <MdSave />}
                        Save Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function statusTone(status: string): Tone {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'green';
        case 'active':
            return 'blue';
        default:
            return 'slate';
    }
}

/** The phone's progress colour per status: blue while active, green once completed, grey otherwise. */
function statusAccent(status: string): string {
    switch (status.toLowerCase()) {
        case 'completed':
            return '#66BB6A';
        case 'active':
            return '#2178BD';
        default:
            return '#9E9E9E';
    }
}

function lockMessage(project: Project): string {
    if (isProjectClosed(project)) return 'This project is completed and closed. No further updates can be posted.';
    return project.teamLeaderName
        ? `Only the team leader (${project.teamLeaderName}) can post updates on this project.`
        : "Only the project's team leader can post updates on this project.";
}

/** Mirrors the phone's _ProjectCard: tapping opens the update form (team leader) or the details sheet. */
function ProjectCard({ project, canUpdate, onOpen }: { project: Project; canUpdate: boolean; onOpen: () => void }) {
    const closed = isProjectClosed(project);
    return (
        <button
            type="button"
            onClick={onOpen}
            className="bg-card shadow-card hover:border-primary/30 focus-visible:ring-primary/40 flex w-full flex-col rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
        >
            <div className="flex w-full items-start gap-2">
                <h3 className="text-foreground min-w-0 flex-1 text-[15px] leading-snug font-bold">{project.name}</h3>
                <Pill tone={statusTone(project.status)} className="tracking-[0.3px]">
                    {project.status.toUpperCase()}
                </Pill>
            </div>
            <div className="mt-2 w-full space-y-1.5">
                <InfoRow icon={MdLocationOnOutline}>{project.site || '-'}</InfoRow>
                {project.teamLeaderName && (
                    <InfoRow icon={MdStarOutline}>
                        <span className="block truncate">Team leader: {project.teamLeaderName}</span>
                    </InfoRow>
                )}
                {project.team.length > 0 && <InfoRow icon={MdGroupsOutline}>{project.team.join(', ')}</InfoRow>}
            </div>
            <CompletionBar percent={project.completionPercent} color={statusAccent(project.status)} className="mt-3.5 w-full" />
            {project.lastWorkSummary && (
                <p className="text-muted-foreground mt-3 line-clamp-2 w-full text-[12.5px] leading-snug">
                    <span className="text-foreground font-semibold">Latest: </span>
                    {project.lastWorkSummary}
                </p>
            )}
            <div className="mt-auto w-full pt-3">
                <div className="flex items-center gap-1 border-t pt-2.5 text-[11.5px] font-medium text-[#9e9e9e]">
                    <MdSchedule className="size-[13px] shrink-0" />
                    <span className="shrink-0" title={project.lastUpdate ? formatDate(project.lastUpdate) : undefined}>
                        {project.lastUpdate ? `Updated ${timeAgo(project.lastUpdate)}` : 'No updates yet'}
                    </span>
                    {project.modeOfTransport ? (
                        <>
                            <MdDirectionsCarFilledOutline className="ml-2.5 size-[13px] shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{project.modeOfTransport}</span>
                        </>
                    ) : (
                        <span className="flex-1" />
                    )}
                    {canUpdate ? (
                        <span className="text-primary ml-2 flex shrink-0 items-center font-semibold">
                            Add update <MdChevronRight className="size-4" />
                        </span>
                    ) : (
                        <span className="ml-2 flex shrink-0 items-center gap-1 font-semibold">
                            {closed ? <MdLockOutline className="size-[13px]" /> : <MdVisibilityOutline className="size-[13px]" />}
                            {closed ? 'Closed' : 'View only'}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

/** Read-only view of a project for members who aren't its team leader (the phone's details sheet). */
function ProjectDetailsDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
    const detail = (Icon: IconType, label: string, value: string) => (
        <div className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-[18px] shrink-0 text-[#9e9e9e]" />
            <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-[#9e9e9e]">{label}</p>
                <p className="text-foreground mt-0.5 text-sm leading-[1.35] font-medium">{value}</p>
            </div>
        </div>
    );
    return (
        <Dialog open={project !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                {project && (
                    <>
                        <DialogHeader>
                            <div className="flex items-start gap-2 pr-6">
                                <DialogTitle className="min-w-0 flex-1 text-lg font-bold">{project.name}</DialogTitle>
                                <Pill tone={statusTone(project.status)} className="tracking-[0.3px]">
                                    {project.status.toUpperCase()}
                                </Pill>
                            </div>
                            <DialogDescription className="sr-only">Project details</DialogDescription>
                        </DialogHeader>
                        <CompletionBar percent={project.completionPercent} color={statusAccent(project.status)} />
                        <div className="space-y-3 pt-1">
                            {project.site && detail(MdLocationOnOutline, 'Site', project.site)}
                            {project.teamLeaderName && detail(MdStarOutline, 'Team leader', project.teamLeaderName)}
                            {project.team.length > 0 && detail(MdGroupsOutline, 'Team', project.team.join(', '))}
                            {project.modeOfTransport && detail(MdDirectionsCarFilledOutline, 'Mode of transport', project.modeOfTransport)}
                            {detail(
                                MdSchedule,
                                'Last update',
                                project.lastUpdate ? `${formatDate(project.lastUpdate)} (${timeAgo(project.lastUpdate)})` : 'No updates yet',
                            )}
                            {project.lastWorkSummary?.trim() && detail(MdNotes, 'Latest work summary', project.lastWorkSummary)}
                        </div>
                        <div className="bg-primary/8 flex items-start gap-2.5 rounded-xl p-3">
                            {isProjectClosed(project) ? (
                                <MdLockOutline className="text-primary size-[18px] shrink-0" />
                            ) : (
                                <MdInfoOutline className="text-primary size-[18px] shrink-0" />
                            )}
                            <p className="text-foreground text-[12.5px] leading-[1.35]">{lockMessage(project)}</p>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default function ProjectsIndex() {
    const { auth } = usePage<SharedData>().props;
    const list = useApiQuery(() => projects.mine());
    const [updating, setUpdating] = useState<Project | null>(null);
    const [viewing, setViewing] = useState<Project | null>(null);

    const canUpdate = (project: Project) => !isProjectClosed(project) && isProjectLedBy(project, auth.user);

    return (
        <Page
            title="My Projects"
            back={{ href: '/tickets', label: 'Tickets' }}
            width="wide"
            actions={
                <Button variant="secondary" size="sm" onClick={list.reload} disabled={list.isFetching}>
                    <RefreshCw className={cn(list.isFetching && 'animate-spin')} /> Refresh
                </Button>
            }
        >
            <HeroBanner
                icon={MdWorkspaces}
                title="Projects Workspace"
                description="Track project tasks, daily progress %, technician deployment, and manager approvals."
            />

            <QueryView
                query={list}
                empty={(items) =>
                    items.length === 0 && (
                        <EmptyState icon={MdFolderOff} title="No projects assigned" description="Projects you're deployed to will appear here." />
                    )
                }
            >
                {(items) => (
                    <section className="space-y-3">
                        <h2 className="text-foreground px-0.5 text-base font-bold">My Projects ({items.length})</h2>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((project) => {
                                const editable = canUpdate(project);
                                return (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        canUpdate={editable}
                                        onOpen={() => (editable ? setUpdating(project) : setViewing(project))}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}
            </QueryView>

            <ProjectDetailsDialog project={viewing} onClose={() => setViewing(null)} />

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
