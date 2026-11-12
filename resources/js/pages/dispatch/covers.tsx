import { ConfirmDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { dispatch } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type ClusterCovers, type LeaderCover } from '@/types/fuelops';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Pill } from '@/components/fuelops/pill';
import { LoaderCircle, MdAdd, MdClose, MdShieldMoon, MdWorkspaces } from '@/components/icons';
import { useEffect, useState } from 'react';

/** The value for an `<input type="datetime-local">`, in local time. */
function toDateTimeInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LeaderCoverPage() {
    const covers = useApiQuery(() => dispatch.covers());
    const [adding, setAdding] = useState<ClusterCovers | null>(null);
    const [cancelling, setCancelling] = useState<LeaderCover | null>(null);

    return (
        <Page title="Leader Cover" back={{ href: '/dispatch/queue', label: 'Assignment Queue' }}>
            <p className="text-muted-foreground max-w-3xl text-[13px] leading-relaxed">
                Going off duty or on leave? Hand dispatch for your cluster to someone for a set time. They get the assignment queue, the alerts and
                the right to assign until it ends.
            </p>

            <QueryView
                query={covers}
                empty={(clusters) =>
                    clusters.length === 0 && <EmptyState icon={MdShieldMoon} title="Only a cluster's own leader can arrange cover for it." />
                }
            >
                {(clusters) => (
                    <div className="grid items-start gap-4 md:grid-cols-2">
                        {clusters.map((cluster) => (
                            <div key={cluster.clusterId} className="bg-card shadow-card rounded-[18px] border p-4">
                                <div className="flex items-center gap-3">
                                    <IconTile icon={MdWorkspaces} size="md" className="text-primary" />
                                    <h2 className="text-brand-ink min-w-0 flex-1 text-[15px] leading-snug font-bold dark:text-white">
                                        {cluster.clusterCode} · {cluster.clusterName}
                                    </h2>
                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary shrink-0" onClick={() => setAdding(cluster)}>
                                        <MdAdd /> Add cover
                                    </Button>
                                </div>
                                {cluster.covers.length === 0 ? (
                                    <p className="text-muted-foreground mt-3 text-[13px]">No cover arranged.</p>
                                ) : (
                                    <ul className="mt-2 divide-y">
                                        {cluster.covers.map((cover) => (
                                            <li key={cover.id} className="flex items-start gap-3 py-3 last:pb-0">
                                                <MdShieldMoon
                                                    className={cn(
                                                        'mt-0.5 size-6 shrink-0',
                                                        cover.isActive ? 'text-[#43A047]' : 'text-muted-foreground/70',
                                                    )}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
                                                        {cover.fullName}
                                                        {cover.isActive && <Pill tone="green">Active now</Pill>}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                                                        {formatDateTime(cover.startsAt)} → {formatDateTime(cover.endsAt)}
                                                    </p>
                                                    {cover.reason && <p className="text-muted-foreground text-[12.5px]">{cover.reason}</p>}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Cancel cover"
                                                    aria-label="Cancel cover"
                                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                                    onClick={() => setCancelling(cover)}
                                                >
                                                    <MdClose />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </QueryView>

            <AddCoverDialog
                cluster={adding}
                onOpenChange={(open) => !open && setAdding(null)}
                onAdded={() => {
                    toast.success('Cover arranged. They have been notified.');
                    covers.reload();
                }}
            />

            <ConfirmDialog
                open={cancelling !== null}
                onOpenChange={(open) => !open && setCancelling(null)}
                title="Cancel cover?"
                description={
                    cancelling
                        ? `${cancelling.fullName} will lose dispatch rights for this cluster${cancelling.isActive ? ' straight away' : ''}.`
                        : ''
                }
                confirmLabel="Cancel cover"
                destructive
                onConfirm={async () => {
                    if (!cancelling) return;
                    await dispatch.cancelCover(cancelling.id);
                    covers.reload();
                }}
            />
        </Page>
    );
}

function AddCoverDialog({
    cluster,
    onOpenChange,
    onAdded,
}: {
    cluster: ClusterCovers | null;
    onOpenChange: (open: boolean) => void;
    onAdded: () => void;
}) {
    const [userId, setUserId] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (cluster) {
            const now = new Date();
            setUserId('');
            setStartsAt(toDateTimeInput(now));
            setEndsAt(toDateTimeInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
            setReason('');
            setError(null);
        }
    }, [cluster]);

    const save = async () => {
        if (!cluster) return;
        if (userId === '') {
            setError('Choose who will cover.');
            return;
        }
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            setError('Choose when the cover starts and ends.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            await dispatch.createCover({ clusterId: cluster.clusterId, userId, startsAt: start, endsAt: end, reason: reason.trim() || null });
            onAdded();
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={cluster !== null} onOpenChange={(open) => !isSaving && onOpenChange(open)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cover for {cluster?.clusterName}</DialogTitle>
                </DialogHeader>
                <Field label="Who covers" htmlFor="cover-user">
                    <select
                        id="cover-user"
                        value={userId}
                        onChange={(event) => setUserId(event.target.value)}
                        className="border-border bg-input focus-visible:border-primary focus-visible:ring-primary h-12 w-full rounded-[14px] border px-4 text-base focus-visible:ring-1 focus-visible:outline-hidden md:text-sm"
                    >
                        <option value="">Select a person</option>
                        {cluster?.candidates.map((candidate) => (
                            <option key={candidate.userId} value={candidate.userId}>
                                {candidate.fullName} ({candidate.role})
                            </option>
                        ))}
                    </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="From" htmlFor="cover-from">
                        <Input id="cover-from" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                    </Field>
                    <Field label="To" htmlFor="cover-to">
                        <Input id="cover-to" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                    </Field>
                </div>
                <Field label="Reason (optional)" htmlFor="cover-reason">
                    <Input id="cover-reason" value={reason} placeholder="e.g. Annual leave" onChange={(event) => setReason(event.target.value)} />
                </Field>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <DialogFooter>
                    <Button className="w-full" onClick={save} disabled={isSaving}>
                        {isSaving && <LoaderCircle className="animate-spin" />}
                        {isSaving ? 'Saving...' : 'Arrange cover'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
