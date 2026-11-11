import { TicketTypeTag } from '@/components/dispatch/chips';
import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { StatCard } from '@/components/fuelops/stat-card';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { timeAgo, type Tone } from '@/lib/format';
import { requisitions } from '@/lib/fuelops-api';
import { type CctvRequisition } from '@/types/fuelops';
import { Link } from '@inertiajs/react';
import { CircleCheck, ClipboardList, Flag, Hourglass, Plus, RefreshCw, Video } from 'lucide-react';

const APPROVED_STATUSES = ['approved', 'issued', 'completed'];

export function requisitionStatusTone(status: string): Tone {
    switch (status.toLowerCase()) {
        case 'approved':
        case 'issued':
        case 'completed':
            return 'green';
        case 'pending':
        case 'in_review':
            return 'amber';
        case 'rejected':
        case 'cancelled':
            return 'red';
        default:
            return 'blue';
    }
}

export function requisitionStatusLabel(status: string): string {
    if (status === '') return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/** The detail page is keyed by the ERP's id when it sent one, else by the requisition number. */
function detailHref(requisition: CctvRequisition): string {
    return `/requisitions/${encodeURIComponent(requisition.requisitionId || requisition.reqNo)}`;
}

export default function RequisitionsIndex() {
    const list = useApiQuery(() => requisitions.mine());
    const all = list.data ?? [];
    const pendingCount = all.filter((r) => r.status.toLowerCase() === 'pending').length;
    const approvedCount = all.filter((r) => APPROVED_STATUSES.includes(r.status.toLowerCase())).length;

    return (
        <Page
            title="Requisition"
            description={
                all.length === 0 ? 'No requisitions yet' : `${all.length} submitted${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
            }
            actions={
                <>
                    <Button variant="outline" size="sm" onClick={list.reload} disabled={list.isFetching}>
                        <RefreshCw className={list.isFetching ? 'animate-spin' : undefined} /> Refresh
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/requisitions/create">
                            <Plus /> New Requisition
                        </Link>
                    </Button>
                </>
            }
        >
            <QueryView
                query={list}
                empty={(data) =>
                    data.length === 0 && (
                        <EmptyState
                            icon={Video}
                            title="No requisitions yet"
                            description="Request CCTV and network equipment for a job."
                            action={
                                <Button asChild>
                                    <Link href="/requisitions/create">
                                        <Plus /> New Requisition
                                    </Link>
                                </Button>
                            }
                        />
                    )
                }
            >
                {(data) => (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <StatCard label="Total" value={data.length} icon={ClipboardList} accent="text-primary" />
                            <StatCard label="Pending" value={pendingCount} icon={Hourglass} accent="text-amber-600" />
                            <StatCard label="Approved" value={approvedCount} icon={CircleCheck} accent="text-green-600" />
                        </div>
                        <ul className="space-y-3">
                            {data.map((requisition) => (
                                <li key={requisition.requisitionId || requisition.reqNo}>
                                    <RequisitionCard requisition={requisition} />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </QueryView>
        </Page>
    );
}

function RequisitionCard({ requisition }: { requisition: CctvRequisition }) {
    const itemCount = requisition.items.length;
    return (
        <Link href={detailHref(requisition)} className="bg-card hover:bg-accent block rounded-xl border p-4 shadow-xs transition-colors">
            <div className="flex flex-wrap items-center gap-2">
                <TicketTypeTag type="cctv-requisition" />
                <span className="flex-1 truncate font-semibold">{requisition.reqNo || 'Requisition'}</span>
                <Pill tone={requisitionStatusTone(requisition.status)}>{requisitionStatusLabel(requisition.status)}</Pill>
            </div>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                </span>
                {requisition.priority && (
                    <span className="inline-flex items-center gap-1">
                        <Flag className="size-3" /> {requisition.priority}
                    </span>
                )}
                {requisition.createdAt && <span>{timeAgo(requisition.createdAt)}</span>}
            </div>
            {requisition.jobRef && <p className="text-muted-foreground mt-1 text-xs">Job ref: {requisition.jobRef}</p>}
        </Link>
    );
}
