import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import {
    LoaderCircle,
    MdAdd,
    MdAssignmentLateOutline,
    MdChevronRight,
    MdDirectionsCarFilledOutline,
    MdFlagOutline,
    MdGroupsOutline,
    MdLocalShipping,
    MdLocationOnOutline,
    MdLockOutline,
    MdNotes,
    MdPersonOutline,
    MdVisibilityOutline,
    RefreshCw,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDateTime, type Tone } from '@/lib/format';
import { isPrimaryTechnicianFor, isSpecialAssignmentClosed, specialAssignments } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { CompletionBar, DailyUpdateDialog, HeroBanner, InfoRow } from '@/pages/projects/index';
import { type SharedData } from '@/types';
import { type SpecialAssignment } from '@/types/fuelops';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

function statusTone(status: string): Tone {
    switch (status) {
        case 'in_transit':
            return 'blue';
        case 'closed':
            return 'orange';
        case 'signed_off':
            return 'green';
        default:
            return 'slate';
    }
}

/** The phone's accent per status, used for the advance button. */
function statusAccent(status: string): string {
    switch (status) {
        case 'in_transit':
            return '#2178BD';
        case 'closed':
            return '#FFA726';
        case 'signed_off':
            return '#66BB6A';
        default:
            return '#9E9E9E';
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case 'in_transit':
            return 'IN TRANSIT';
        case 'closed':
            return 'AWAITING SIGN-OFF';
        case 'signed_off':
            return 'SIGNED OFF';
        default:
            return 'ASSIGNED';
    }
}

/** One step of the Set Off / Closed / Sign-off strip: small grey caps label over a blue time. */
function TimelineStep({ label, at }: { label: string; at?: string | null }) {
    return (
        <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-semibold tracking-[0.3px] text-[#bdbdbd] uppercase dark:text-[#757575]">{label}</p>
            <p className={cn('mt-0.5 text-[12.5px] leading-tight font-semibold', at ? 'text-primary dark:text-[#6fb3e8]' : 'text-[#bdbdbd] dark:text-[#757575]')}>
                {at ? formatDateTime(at) : '–'}
            </p>
        </div>
    );
}

export default function SpecialAssignmentsIndex() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const isClusterLeader = user.isClusterLeader;
    // A Cluster Leader sees (and can act on) their whole team's assignments, not just their own.
    const [scope, setScope] = useState<'mine' | 'cluster'>(isClusterLeader ? 'cluster' : 'mine');
    const list = useApiQuery(() => (scope === 'cluster' ? specialAssignments.cluster() : specialAssignments.mine()), [scope]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [closing, setClosing] = useState<SpecialAssignment | null>(null);
    const [updating, setUpdating] = useState<SpecialAssignment | null>(null);

    const replace = (updated: SpecialAssignment) => list.setData((current) => current?.map((a) => (a.id === updated.id ? updated : a)));

    const setOff = async (assignment: SpecialAssignment) => {
        setBusyId(assignment.id);
        try {
            replace(await specialAssignments.setOff(assignment.id));
            toast.success('Set off recorded');
        } catch (e) {
            toast.error(`Failed to update assignment: ${errorText(e)}`);
        } finally {
            setBusyId(null);
        }
    };

    const canUpdate = (assignment: SpecialAssignment) => !isSpecialAssignmentClosed(assignment) && isPrimaryTechnicianFor(assignment, user);

    return (
        <Page
            title="Special Assignments"
            back={{ href: '/tickets', label: 'Tickets' }}
            width="wide"
            actions={
                <>
                    <Button variant="secondary" size="sm" onClick={list.reload} disabled={list.isFetching}>
                        <RefreshCw className={cn(list.isFetching && 'animate-spin')} /> Refresh
                    </Button>
                    {isClusterLeader && (
                        <Button size="sm" asChild>
                            <Link href={route('special-assignments.create')}>
                                <MdAdd /> New assignment
                            </Link>
                        </Button>
                    )}
                </>
            }
        >
            <HeroBanner
                icon={MdLocalShipping}
                title="Special Assignments"
                description="One-off field tasks assigned by Operations, with travel start/stop tracking and manager sign-off."
            />

            {isClusterLeader && (
                <div className="bg-card shadow-card flex w-full gap-1 rounded-[14px] border p-1 sm:w-fit" role="tablist">
                    {(['cluster', 'mine'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={scope === value}
                            onClick={() => setScope(value)}
                            className={cn(
                                'flex-1 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors sm:flex-none',
                                scope === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {value === 'cluster' ? 'My Cluster' : 'Mine'}
                        </button>
                    ))}
                </div>
            )}

            <QueryView
                query={list}
                empty={(items) =>
                    items.length === 0 && (
                        <EmptyState
                            icon={MdAssignmentLateOutline}
                            title="No special assignments yet"
                            description="One-off tasks assigned to you by Operations will appear here."
                        />
                    )
                }
            >
                {(items) => (
                    <section className="space-y-3">
                        <h2 className="text-foreground px-0.5 text-base font-bold">
                            {scope === 'cluster' ? 'Cluster Special Assignments' : 'My Special Assignments'} ({items.length})
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((assignment) => {
                                // Set off/close are a Cluster Leader's actions; sign-off is web-only for Operations Managers.
                                const canAdvance = isClusterLeader && (assignment.status === 'assigned' || assignment.status === 'in_transit');
                                const editable = canUpdate(assignment);
                                const accent = statusAccent(assignment.status);
                                const busy = busyId === assignment.id;
                                return (
                                    <article key={assignment.id} className="bg-card shadow-card flex flex-col rounded-2xl border p-4">
                                        <div className="flex items-start gap-2">
                                            <h3 className="text-foreground line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug font-bold">
                                                {assignment.briefDescription || assignment.location || '-'}
                                            </h3>
                                            <Pill tone={statusTone(assignment.status)} className="tracking-[0.3px]">
                                                {statusLabel(assignment.status)}
                                            </Pill>
                                        </div>
                                        <div className="mt-2 space-y-1.5">
                                            <InfoRow icon={MdLocationOnOutline}>
                                                <span className="block truncate">{assignment.location || '-'}</span>
                                            </InfoRow>
                                            <InfoRow icon={MdPersonOutline}>Primary technician: {assignment.assignedTo || '-'}</InfoRow>
                                            {assignment.additionalTechnicians.length > 0 && (
                                                <InfoRow icon={MdGroupsOutline}>Additional: {assignment.additionalTechnicians.join(', ')}</InfoRow>
                                            )}
                                            <InfoRow icon={MdFlagOutline}>Status: {assignment.workStatus}</InfoRow>
                                        </div>
                                        <CompletionBar percent={assignment.completionPercent} className="mt-3" />
                                        {assignment.transportMode && (
                                            <InfoRow icon={MdDirectionsCarFilledOutline} className="mt-1.5">
                                                {assignment.transportMode}
                                            </InfoRow>
                                        )}
                                        {assignment.lastWorkSummary && (
                                            <InfoRow icon={MdNotes} className="mt-1.5">
                                                <span className="line-clamp-2">Latest: {assignment.lastWorkSummary}</span>
                                            </InfoRow>
                                        )}
                                        <div className="mt-auto pt-3">
                                            <div className="flex gap-2 border-t pt-2.5">
                                                <TimelineStep label="Set Off" at={assignment.setOffAt} />
                                                <TimelineStep label="Closed" at={assignment.closedAt} />
                                                <TimelineStep label="Sign-off" at={assignment.signedOffAt} />
                                            </div>
                                            {canAdvance && (
                                                <Button
                                                    variant="outline"
                                                    className="mt-3.5 h-10 w-full rounded-[10px] bg-transparent text-[13px]"
                                                    style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 40%, transparent)` }}
                                                    disabled={busy}
                                                    onClick={() => (assignment.status === 'assigned' ? setOff(assignment) : setClosing(assignment))}
                                                >
                                                    {busy ? <LoaderCircle className="animate-spin" /> : assignment.status === 'assigned' ? 'Set Off' : 'Mark Closed'}
                                                </Button>
                                            )}
                                            <div className="mt-3 flex justify-end">
                                                {editable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUpdating(assignment)}
                                                        className="text-primary flex items-center rounded-md text-[11.5px] font-semibold hover:underline"
                                                    >
                                                        Add update <MdChevronRight className="size-4" />
                                                    </button>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#9e9e9e]">
                                                        {isSpecialAssignmentClosed(assignment) ? (
                                                            <MdLockOutline className="size-[13px]" />
                                                        ) : (
                                                            <MdVisibilityOutline className="size-[13px]" />
                                                        )}
                                                        {isSpecialAssignmentClosed(assignment) ? 'Signed off · Closed' : 'View only'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}
            </QueryView>

            <ReasonDialog
                open={closing !== null}
                onOpenChange={(open) => !open && setClosing(null)}
                title="Mark assignment closed"
                description="The assignment then awaits sign-off by an Operations Manager."
                confirmLabel="Mark Closed"
                placeholder="Closing note (optional)"
                required={false}
                onConfirm={async (description) => {
                    if (!closing) return;
                    replace(await specialAssignments.close(closing.id, description || null));
                    toast.success('Assignment marked closed');
                }}
            />

            {updating && (
                <DailyUpdateDialog
                    open={updating !== null}
                    onOpenChange={(open) => !open && setUpdating(null)}
                    formTitle="Log a Daily Update"
                    itemTitle={updating.location || updating.briefDescription}
                    team={[updating.assignedTo, ...updating.additionalTechnicians]}
                    teamTag="On this assignment"
                    currentCompletion={updating.completionPercent}
                    summaryLabel="Work Summary"
                    onSubmit={async (input) => {
                        replace(await specialAssignments.submitUpdate(updating.id, input));
                        list.reload();
                    }}
                />
            )}
        </Page>
    );
}
