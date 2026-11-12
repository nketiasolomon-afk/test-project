import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/fuelops/states';
import { type IconType, MdAdd, MdCheckCircle, MdFlagOutline, MdHourglassTop, MdInventory2, MdInventory2Outline, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { timeAgo, type Tone } from '@/lib/format';
import { requisitions } from '@/lib/fuelops-api';
import { type CctvRequisition } from '@/types/fuelops';
import { Link } from '@inertiajs/react';

const APPROVED_STATUSES = ['approved', 'issued', 'completed'];

export function requisitionStatusTone(status: string): Tone {
    switch (status.toLowerCase()) {
        case 'approved':
        case 'issued':
        case 'completed':
            return 'green';
        case 'pending':
        case 'in_review':
            return 'orange';
        case 'rejected':
        case 'cancelled':
            return 'red';
        default:
            return 'blue';
    }
}

/** The phone's requisition status colours, used for the card strip and tracker accents. */
export function requisitionStatusColor(status: string): string {
    switch (requisitionStatusTone(status)) {
        case 'green':
            return '#66BB6A';
        case 'orange':
            return '#FFA726';
        case 'red':
            return '#EF4444';
        default:
            return '#2196F3';
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
                list.data === undefined
                    ? undefined
                    : all.length === 0
                      ? 'No requisitions yet'
                      : `${all.length} submitted${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
            }
            actions={
                <Button variant="outline" size="sm" onClick={list.reload} disabled={list.isFetching}>
                    <RefreshCw className={list.isFetching ? 'animate-spin' : undefined} /> Refresh
                </Button>
            }
        >
            {list.isLoading ? (
                <LoadingState rows={4} className="grid gap-3 space-y-0 lg:grid-cols-2" />
            ) : list.data === undefined ? (
                <ErrorState
                    title="Couldn't load requisitions"
                    message={list.error ?? 'Check your connection and try again.'}
                    onRetry={list.reload}
                    className="flex-1 justify-center"
                />
            ) : (
                <>
                    {list.error && <ErrorState title="Couldn't load requisitions" message={list.error} onRetry={list.reload} className="py-4" />}
                    {all.length === 0 ? (
                        <EmptyState
                            icon={MdInventory2Outline}
                            title="No requisitions yet"
                            description={'Tap "New Requisition" below to submit your first CCTV or network equipment request.'}
                            className="flex-1 justify-center"
                        />
                    ) : (
                        <div className="space-y-4 pb-20 lg:pb-16">
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <RequisitionStatCard icon={MdInventory2} label="Total" value={all.length} color="#2178BD" />
                                <RequisitionStatCard icon={MdHourglassTop} label="Pending" value={pendingCount} color="#FFA726" />
                                <RequisitionStatCard icon={MdCheckCircle} label="Approved" value={approvedCount} color="#66BB6A" />
                            </div>
                            <ul className="grid gap-3 lg:grid-cols-2">
                                {all.map((requisition) => (
                                    <li key={requisition.requisitionId || requisition.reqNo}>
                                        <RequisitionCard requisition={requisition} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {/* The phone's extended FAB, lifted above the bottom tab bar on small screens. */}
            <Link
                href="/requisitions/create"
                className="bg-primary hover:bg-primary/90 fixed right-4 bottom-[calc(108px+env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center gap-2 rounded-2xl pr-5 pl-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgb(33_120_189/0.35)] transition-colors lg:right-8 lg:bottom-8"
            >
                <MdAdd className="size-6" />
                New Requisition
            </Link>
        </Page>
    );
}

function RequisitionStatCard({ icon: Icon, label, value, color }: { icon: IconType; label: string; value: number; color: string }) {
    return (
        <div className="bg-card shadow-card flex min-w-0 items-center gap-2 rounded-[14px] border p-3 sm:gap-3 sm:p-4">
            <span
                className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] sm:size-10 sm:rounded-xl"
                style={{ color }}
            >
                <span className="absolute inset-0 bg-current/12 dark:bg-current/20" aria-hidden="true" />
                <Icon className="relative size-4 sm:size-5" />
            </span>
            <span className="min-w-0">
                <span className="text-foreground block text-base leading-none font-bold sm:text-xl">{value}</span>
                <span className="text-muted-foreground mt-0.5 block truncate text-[10px] font-medium sm:text-xs">{label}</span>
            </span>
        </div>
    );
}

function RequisitionCard({ requisition }: { requisition: CctvRequisition }) {
    const itemCount = requisition.items.length;
    const dateLabel = requisition.createdAt ? timeAgo(requisition.createdAt) : requisition.dateOfRequest;
    return (
        <Link
            href={detailHref(requisition)}
            className="bg-card shadow-card hover:border-primary/30 flex h-full overflow-hidden rounded-2xl border transition-colors"
        >
            <span className="w-1 shrink-0" style={{ backgroundColor: requisitionStatusColor(requisition.status) }} aria-hidden="true" />
            <span className="block min-w-0 flex-1 p-3.5">
                <span className="flex items-center gap-2">
                    <span className="text-foreground min-w-0 flex-1 truncate text-[14.5px] font-bold">{requisition.reqNo || 'Requisition'}</span>
                    <Pill tone={requisitionStatusTone(requisition.status)} className="text-[10.5px]">
                        {requisitionStatusLabel(requisition.status)}
                    </Pill>
                </span>
                <span className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                    <MdInventory2Outline className="size-[13px] shrink-0" />
                    <span>
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                    </span>
                    {requisition.priority && (
                        <>
                            <MdFlagOutline className="ml-2.5 size-[13px] shrink-0" />
                            <span className="truncate">{requisition.priority}</span>
                        </>
                    )}
                    {dateLabel && <span className="text-muted-foreground/80 ml-auto shrink-0 pl-2 text-[11.5px]">{dateLabel}</span>}
                </span>
                {requisition.jobRef && <span className="text-muted-foreground/80 mt-1.5 block text-[11.5px]">Job ref: {requisition.jobRef}</span>}
            </span>
        </Link>
    );
}
