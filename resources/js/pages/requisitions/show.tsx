import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { QueryView } from '@/components/fuelops/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { requisitions } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type CctvRequisition } from '@/types/fuelops';
import { Ban, CalendarDays, Check, Package, RefreshCw, UserRound } from 'lucide-react';
import { requisitionStatusLabel, requisitionStatusTone } from './index';

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

const STAGES = [
    { title: 'Requested', description: 'Submitted and waiting for review' },
    { title: 'Approved', description: 'Reviewed and approved by the store' },
    { title: 'Issued', description: 'Items issued and ready for collection' },
];

export default function RequisitionShow({ requisitionId }: { requisitionId: string }) {
    const requisition = useApiQuery(() => requisitions.get(requisitionId), [requisitionId]);

    return (
        <Page
            title="Requisition Status"
            back={{ href: '/requisitions', label: 'Requisitions' }}
            width="narrow"
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

    return (
        <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-[#1f4788] to-[#2a5db0] p-5 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <p className="flex-1 truncate text-lg font-bold">{requisition.reqNo}</p>
                    <Pill tone={requisitionStatusTone(requisition.status)} className="bg-white/90">
                        {requisitionStatusLabel(requisition.status)}
                    </Pill>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                    {[
                        [CalendarDays, 'Requested', requisition.dateOfRequest || '-'],
                        [UserRound, 'Technician', requisition.technicianName || '-'],
                        [Package, 'Items', String(requisition.items.length)],
                        ...(requisition.requiredByDate ? [[CalendarDays, 'Required by', requisition.requiredByDate] as const] : []),
                    ].map(([Icon, label, value]) => (
                        <div key={label as string} className="flex items-center gap-2">
                            <Icon className="size-4 text-white/70" />
                            <dt className="text-white/70">{label as string}:</dt>
                            <dd className="font-medium">{value as string}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            <Section title="Progress">
                {terminal ? (
                    <div className="flex items-start gap-3 rounded-xl border border-red-600/30 bg-red-600/5 p-4 text-sm">
                        <Ban className="mt-0.5 size-5 shrink-0 text-red-600" />
                        <p>{terminal}</p>
                    </div>
                ) : (
                    <ol className="bg-card rounded-xl border p-4">
                        {STAGES.map((stage, index) => {
                            const done = index <= currentStage;
                            const isLast = index === STAGES.length - 1;
                            return (
                                <li key={stage.title} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <span
                                            className={cn(
                                                'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                                                done ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground/30 text-muted-foreground',
                                            )}
                                        >
                                            {done ? <Check className="size-4" /> : index + 1}
                                        </span>
                                        {!isLast && <span className={cn('my-1 w-0.5 flex-1', index < currentStage ? 'bg-green-600' : 'bg-border')} />}
                                    </div>
                                    <div className={cn('pb-5', isLast && 'pb-0')}>
                                        <p className={cn('text-sm font-semibold', !done && 'text-muted-foreground')}>{stage.title}</p>
                                        <p className="text-muted-foreground text-xs">{stage.description}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </Section>

            <Section title="Items Requested">
                {requisition.items.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No items on this requisition.</p>
                ) : (
                    <ul className="bg-card divide-y rounded-xl border">
                        {requisition.items.map((item, index) => (
                            <li key={item.itemId || index} className="flex items-start gap-3 p-3">
                                <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
                                    {item.rowNumber || index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{item.itemName || '-'}</p>
                                    {item.specification && <p className="text-muted-foreground text-xs">{item.specification}</p>}
                                    {(item.qtyApproved > 0 || item.qtyIssued > 0) && (
                                        <p className="text-muted-foreground text-xs">
                                            Approved {item.qtyApproved} · Issued {item.qtyIssued}
                                        </p>
                                    )}
                                    {item.remarks && <p className="text-muted-foreground text-xs italic">{item.remarks}</p>}
                                </div>
                                <span className="shrink-0 text-sm font-semibold">
                                    {item.qtyRequested} {item.unit}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {requisition.notes && (
                <Section title="Notes / Justification">
                    <p className="bg-card rounded-xl border p-4 text-sm whitespace-pre-line">{requisition.notes}</p>
                </Section>
            )}
        </div>
    );
}
