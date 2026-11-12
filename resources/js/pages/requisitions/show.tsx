import { Page } from '@/components/fuelops/page';
import { QueryView } from '@/components/fuelops/states';
import {
    type IconType,
    MdCancelOutline,
    MdCheck,
    MdEditNote,
    MdEvent,
    MdInventory2Outline,
    MdLocalShippingOutline,
    MdNotes,
    MdPersonOutline,
    MdVerifiedOutline,
    RefreshCw,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { requisitions } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type CctvRequisition } from '@/types/fuelops';
import { requisitionStatusColor, requisitionStatusLabel } from './index';

/** 0 = Requested, 1 = Approved, 2 = Issued. */
function stageIndex(status: string): number {
    switch (status.toLowerCase()) {
        case 'approved':
            return 1;
        case 'issued':
        case 'completed':
            return 2;
        default:
            return 0;
    }
}

/** Set when the requisition has stopped moving forward. */
function terminalLabel(status: string): string | null {
    switch (status.toLowerCase()) {
        case 'rejected':
            return 'This requisition was rejected and will not proceed further.';
        case 'cancelled':
            return 'This requisition was cancelled.';
        default:
            return null;
    }
}

type StepState = 'completed' | 'active' | 'upcoming';

function stepState(stepIndex: number, currentStage: number, terminal: string | null): StepState {
    if (terminal !== null) return stepIndex < currentStage ? 'completed' : 'upcoming';
    if (stepIndex < currentStage) return 'completed';
    if (stepIndex === currentStage) return 'active';
    return 'upcoming';
}

const STAGES: { title: string; description: string; icon: IconType }[] = [
    { title: 'Requested', description: 'Submitted and waiting for review', icon: MdEditNote },
    { title: 'Approved', description: 'Reviewed and approved by the store', icon: MdVerifiedOutline },
    { title: 'Issued', description: 'Items issued and ready for collection', icon: MdLocalShippingOutline },
];

/** A white card like the phone's tracker and items cards (radius 20, subtle border, soft shadow). */
function DetailCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
    return (
        <section className={cn('bg-card shadow-card rounded-[20px] border p-4 sm:p-5', className)}>
            <h2 className="text-muted-foreground text-[13px] font-bold tracking-[0.5px]">{title}</h2>
            {children}
        </section>
    );
}

export default function RequisitionShow({ requisitionId }: { requisitionId: string }) {
    const requisition = useApiQuery(() => requisitions.get(requisitionId), [requisitionId]);

    return (
        <Page
            title="Requisition Status"
            description={requisition.data?.reqNo}
            back={{ href: '/requisitions', label: 'Requisitions' }}
            actions={
                <Button variant="outline" size="sm" onClick={requisition.reload} disabled={requisition.isFetching}>
                    <RefreshCw className={requisition.isFetching ? 'animate-spin' : undefined} /> Refresh
                </Button>
            }
        >
            <QueryView query={requisition} loadingRows={3}>
                {(data) => <RequisitionDetail requisition={data} />}
            </QueryView>
        </Page>
    );
}

function RequisitionDetail({ requisition }: { requisition: CctvRequisition }) {
    const terminal = terminalLabel(requisition.status);
    const currentStage = stageIndex(requisition.status);
    const statusColor = requisitionStatusColor(requisition.status);

    const summary: [IconType, string, string][] = [
        [MdEvent, 'Requested', requisition.dateOfRequest || '-'],
        [MdPersonOutline, 'Technician', requisition.technicianName || '-'],
        [MdInventory2Outline, 'Items', String(requisition.items.length)],
        ...(requisition.requiredByDate ? ([[MdEvent, 'Required by', requisition.requiredByDate]] as [IconType, string, string][]) : []),
    ];

    return (
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <div className="space-y-5 sm:space-y-6">
                {/* Summary: the phone's navy gradient card. */}
                <div className="rounded-[20px] bg-gradient-to-br from-[#1F4788] via-[#2A5DB0] to-[#1F4788] p-5 text-white shadow-[0_10px_20px_rgb(33_120_189/0.24)]">
                    <div className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-lg font-bold">{requisition.reqNo}</p>
                        <span
                            className="shrink-0 rounded-full border-[1.2px] bg-white/16 px-2.5 py-[5px] text-[11px] leading-none font-bold"
                            style={{ borderColor: statusColor, color: statusColor }}
                        >
                            {requisitionStatusLabel(requisition.status)}
                        </span>
                    </div>
                    <dl className="mt-3.5 space-y-2 text-[12.5px]">
                        {summary.map(([Icon, label, value]) => (
                            <div key={label} className="flex min-w-0 items-center gap-2">
                                <Icon className="size-[15px] shrink-0 text-white/70" />
                                <dt className="shrink-0 text-white/70">{label}:</dt>
                                <dd className="min-w-0 truncate font-semibold">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <DetailCard title="Progress" className="sm:p-5">
                    <ol className="mt-[18px]">
                        {STAGES.map((stage, index) => {
                            const state = stepState(index, currentStage, terminal);
                            const isLast = index === STAGES.length - 1;
                            const Icon = state === 'completed' ? MdCheck : stage.icon;
                            return (
                                <li key={stage.title} className="flex gap-3.5">
                                    <div className="flex flex-col items-center">
                                        <span
                                            className={cn(
                                                'relative flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.4px] border-current',
                                                state === 'completed' && 'text-[#66BB6A]',
                                                state === 'active' && 'text-[#FFA726]',
                                                state === 'upcoming' && 'text-gray-300 dark:text-gray-700',
                                            )}
                                        >
                                            <span
                                                className={cn('absolute inset-0 bg-current', state === 'upcoming' ? 'opacity-12' : 'opacity-16')}
                                                aria-hidden="true"
                                            />
                                            <Icon className="relative size-4" />
                                        </span>
                                        {!isLast && (
                                            <span
                                                className={cn(
                                                    'my-1 w-0.5 flex-1',
                                                    state === 'completed' ? 'bg-[#66BB6A]/40' : 'bg-gray-200 dark:bg-gray-800',
                                                )}
                                            />
                                        )}
                                    </div>
                                    <div className={cn('min-w-0 pt-1.5', isLast ? 'pb-0' : 'pb-[22px]')}>
                                        <p
                                            className={cn(
                                                'text-[14.5px] font-bold',
                                                state === 'upcoming' ? 'text-gray-400 dark:text-gray-600' : 'text-foreground',
                                            )}
                                        >
                                            {stage.title}
                                        </p>
                                        <p className="text-muted-foreground mt-0.5 text-xs">{stage.description}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    {terminal && (
                        <div className="mt-3.5 flex items-center gap-2.5 rounded-xl bg-[#EF4444]/8 p-3 text-[12.5px] font-semibold text-[#EF4444]">
                            <MdCancelOutline className="size-[18px] shrink-0" />
                            <p>{terminal}</p>
                        </div>
                    )}
                </DetailCard>
            </div>

            <div className="space-y-5 sm:space-y-6">
                <DetailCard title="Items Requested">
                    {requisition.items.length === 0 ? (
                        <p className="text-muted-foreground mt-3 text-[13px]">No items on this requisition.</p>
                    ) : (
                        <ul className="mt-3 divide-y">
                            {requisition.items.map((item, index) => (
                                <li key={item.itemId || index} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0">
                                    <span className="bg-primary/10 text-primary flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold dark:bg-primary/20 dark:text-[#6fb3e8]">
                                        {item.rowNumber || index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <p className="text-foreground text-[13.5px] font-medium">{item.itemName || '-'}</p>
                                        {item.specification && <p className="text-muted-foreground text-xs">{item.specification}</p>}
                                        {(item.qtyApproved > 0 || item.qtyIssued > 0) && (
                                            <p className="text-muted-foreground text-xs">
                                                Approved {item.qtyApproved} · Issued {item.qtyIssued}
                                            </p>
                                        )}
                                        {item.remarks && <p className="text-muted-foreground text-xs italic">{item.remarks}</p>}
                                    </div>
                                    <span className="text-muted-foreground shrink-0 pt-0.5 text-[12.5px]">
                                        {item.qtyRequested} {item.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </DetailCard>

                {requisition.notes && (
                    <DetailCard title="Notes / Justification">
                        <div className="mt-3 flex gap-2.5">
                            <MdNotes className="text-primary mt-0.5 size-[17px] shrink-0" />
                            <p className="text-foreground text-[13.5px] whitespace-pre-line">{requisition.notes}</p>
                        </div>
                    </DetailCard>
                )}
            </div>
        </div>
    );
}
