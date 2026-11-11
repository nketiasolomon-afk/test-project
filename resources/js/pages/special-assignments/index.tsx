import { ReasonDialog } from '@/components/fuelops/dialogs';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDateTime, type Tone } from '@/lib/format';
import { isPrimaryTechnicianFor, isSpecialAssignmentClosed, specialAssignments } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { CompletionBar, DailyUpdateDialog } from '@/pages/projects/index';
import { type SharedData } from '@/types';
import { type SpecialAssignment } from '@/types/fuelops';
import { Link, usePage } from '@inertiajs/react';
import { Car, CheckCircle2, Circle, LoaderCircle, Lock, MapPin, Plus, RefreshCw, Star } from '@/components/icons';
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

function TimelineStep({ label, at }: { label: string; at?: string | null }) {
    return (
        <div className="flex-1 text-center">
            {at ? <CheckCircle2 className="mx-auto size-4 text-green-600" /> : <Circle className="text-muted-foreground/50 mx-auto size-4" />}
            <p className="text-xs font-medium">{label}</p>
            <p className="text-muted-foreground text-[11px]">{at ? formatDateTime(at) : '–'}</p>
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
            description="One-off field tasks assigned by Operations, with travel start/stop tracking and manager sign-off."
            back={{ href: '/tickets', label: 'Tickets' }}
            actions={
                <>
                    <Button variant="outline" size="sm" onClick={list.reload} disabled={list.isFetching}>
                        <RefreshCw className={cn(list.isFetching && 'animate-spin')} /> Refresh
                    </Button>
                    {isClusterLeader && (
                        <Button size="sm" asChild>
                            <Link href={route('special-assignments.create')}>
                                <Plus /> New assignment
                            </Link>
                        </Button>
                    )}
                </>
            }
        >
            {isClusterLeader && (
                <div className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1" role="tablist">
                    {(['cluster', 'mine'] as const).map((value) => (
                        <button
                            key={value}
                            role="tab"
                            aria-selected={scope === value}
                            onClick={() => setScope(value)}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-medium',
                                scope === value ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground',
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
                            icon={Star}
                            title="No special assignments yet"
                            description="One-off tasks assigned to you by Operations will appear here."
                        />
                    )
                }
            >
                {(items) => (
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-sm font-medium">
                            {scope === 'cluster' ? 'Cluster Special Assignments' : 'My Special Assignments'} ({items.length})
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                            {items.map((assignment) => {
                                // Set off/close are a Cluster Leader's actions; sign-off is web-only for Operations Managers.
                                const canAdvance = isClusterLeader && (assignment.status === 'assigned' || assignment.status === 'in_transit');
                                const editable = canUpdate(assignment);
                                return (
                                    <article key={assignment.id} className="bg-card space-y-3 rounded-xl border p-4 shadow-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="flex items-center gap-1 font-semibold">
                                                    <MapPin className="size-4 shrink-0" /> {assignment.location || '-'}
                                                </h3>
                                                <p className="text-muted-foreground text-sm">{assignment.briefDescription}</p>
                                            </div>
                                            <Pill tone={statusTone(assignment.status)}>{statusLabel(assignment.status)}</Pill>
                                        </div>
                                        <div className="text-muted-foreground space-y-0.5 text-sm">
                                            <p>Primary technician: {assignment.assignedTo || '-'}</p>
                                            {assignment.additionalTechnicians.length > 0 && (
                                                <p>Additional: {assignment.additionalTechnicians.join(', ')}</p>
                                            )}
                                            <p>Status: {assignment.workStatus}</p>
                                            {assignment.transportMode && (
                                                <p className="flex items-center gap-1">
                                                    <Car className="size-3.5" /> {assignment.transportMode}
                                                </p>
                                            )}
                                        </div>
                                        <CompletionBar percent={assignment.completionPercent} />
                                        {assignment.lastWorkSummary && <p className="text-sm">Latest: {assignment.lastWorkSummary}</p>}
                                        <div className="flex border-t pt-3">
                                            <TimelineStep label="Set Off" at={assignment.setOffAt} />
                                            <TimelineStep label="Closed" at={assignment.closedAt} />
                                            <TimelineStep label="Sign-off" at={assignment.signedOffAt} />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {canAdvance && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={busyId === assignment.id}
                                                    onClick={() => (assignment.status === 'assigned' ? setOff(assignment) : setClosing(assignment))}
                                                >
                                                    {busyId === assignment.id && <LoaderCircle className="animate-spin" />}
                                                    {assignment.status === 'assigned' ? 'Set Off' : 'Mark Closed'}
                                                </Button>
                                            )}
                                            {editable ? (
                                                <Button size="sm" onClick={() => setUpdating(assignment)}>
                                                    <Plus /> Add update
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                                    <Lock className="size-3.5" />
                                                    {isSpecialAssignmentClosed(assignment) ? 'Signed off · Closed' : 'View only'}
                                                </span>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
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
