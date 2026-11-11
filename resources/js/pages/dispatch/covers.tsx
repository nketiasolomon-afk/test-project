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
import { LoaderCircle, Plus, ShieldHalf, X } from 'lucide-react';
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
        <Page title="Leader Cover" back={{ href: '/dispatch/queue', label: 'Assignment Queue' }} width="narrow">
            <p className="text-muted-foreground text-sm">
                Going off duty or on leave? Hand dispatch for your cluster to someone for a set time. They get the assignment queue, the alerts and
                the right to assign until it ends.
            </p>

            <QueryView
                query={covers}
                empty={(clusters) =>
                    clusters.length === 0 && <EmptyState icon={ShieldHalf} title="Only a cluster's own leader can arrange cover for it." />
                }
            >
                {(clusters) => (
                    <div className="space-y-4">
                        {clusters.map((cluster) => (
                            <div key={cluster.clusterId} className="bg-card rounded-xl border p-4 shadow-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="font-semibold">
                                        {cluster.clusterCode} · {cluster.clusterName}
                                    </h2>
                                    <Button variant="ghost" size="sm" onClick={() => setAdding(cluster)}>
                                        <Plus /> Add cover
                                    </Button>
                                </div>
                                {cluster.covers.length === 0 ? (
                                    <p className="text-muted-foreground mt-2 text-sm">No cover arranged.</p>
                                ) : (
                                    <ul className="mt-2 divide-y">
                                        {cluster.covers.map((cover) => (
                                            <li key={cover.id} className="flex items-start gap-3 py-2.5">
                                                <ShieldHalf
                                                    className={cn(
                                                        'mt-0.5 size-5 shrink-0',
                                                        cover.isActive ? 'text-green-600' : 'text-muted-foreground',
                                                    )}
                                                />
                                                <div className="min-w-0 flex-1 text-sm">
                                                    <p className="font-medium">{cover.fullName}</p>
                                                    <p className="text-muted-foreground">
                                                        {formatDateTime(cover.startsAt)} → {formatDateTime(cover.endsAt)}
                                                        {cover.isActive && ' · active now'}
                                                    </p>
                                                    {cover.reason && <p className="text-muted-foreground">{cover.reason}</p>}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Cancel cover"
                                                    aria-label="Cancel cover"
                                                    onClick={() => setCancelling(cover)}
                                                >
                                                    <X />
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
                        className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                    >
                        <option value="">Select a person</option>
                        {cluster?.candidates.map((candidate) => (
                            <option key={candidate.userId} value={candidate.userId}>
                                {candidate.fullName} ({candidate.role})
                            </option>
                        ))}
                    </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
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
