import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { StatCard } from '@/components/fuelops/stat-card';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiQuery } from '@/hooks/use-api-query';
import { formatDate, formatDateTime, formatQuantity, fromDateInputValue, timeAgo, toDateInputValue, type Tone } from '@/lib/format';
import { reports } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Activity, CheckCircle2, ChevronRight, ClipboardList, Hourglass, Package, Pencil, ShieldCheck } from '@/components/icons';
import { useState } from 'react';

type Tab = 'activity' | 'job-cards' | 'items';
type Period = 'week' | 'month' | 'all' | 'custom';

const STAGE_LABELS: Record<string, string> = {
    awaiting_station: 'Awaiting station approval',
    awaiting_validation: 'Awaiting final validation',
    closed: 'Closed',
};

function stageTone(stage: string): Tone {
    return stage === 'closed' ? 'emerald' : stage === 'awaiting_validation' ? 'blue' : 'amber';
}

function periodStart(period: Period): Date | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') {
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        return monday;
    }
    if (period === 'month') return new Date(today.getFullYear(), today.getMonth(), 1);
    return null;
}

function ActivityTab() {
    const [date, setDate] = useState(() => toDateInputValue(new Date()));
    const activity = useApiQuery(() => reports.dailyActivity(fromDateInputValue(date)), [date]);

    return (
        <div className="space-y-4">
            <div className="grid max-w-xs gap-1.5">
                <Label htmlFor="activity-date">Date</Label>
                <Input id="activity-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <QueryView query={activity} empty={(items) => items.length === 0 && <EmptyState icon={Activity} title="No activity on this day." />}>
                {(items) => (
                    <ul className="space-y-2">
                        {items.map((entry, index) => (
                            <li key={index} className="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
                                <Activity className="text-primary size-5 shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{entry.title}</span>
                                    <span className="text-muted-foreground block text-xs">{entry.subtitle}</span>
                                </span>
                                <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(entry.occurredAt, '')}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </QueryView>
        </div>
    );
}

function JobCardsTab() {
    const [period, setPeriod] = useState<Period>('week');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const range =
        period === 'custom'
            ? { from: from ? fromDateInputValue(from) : null, to: to ? fromDateInputValue(to) : null }
            : { from: periodStart(period) };
    const jobCards = useApiQuery(() => reports.myJobCards(range), [period, from, to]);

    const periods: [Period, string][] = [
        ['week', 'This week'],
        ['month', 'This month'],
        ['all', 'All time'],
        ['custom', 'Custom'],
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="bg-muted inline-flex gap-1 rounded-lg p-1">
                    {periods.map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() => setPeriod(value)}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-medium',
                                period === value ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {period === 'custom' && (
                    <>
                        <div className="grid gap-1">
                            <Label htmlFor="from">From</Label>
                            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="to">To</Label>
                            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                        </div>
                    </>
                )}
            </div>

            <QueryView query={jobCards}>
                {({ summary, jobCards: list }) => (
                    <div className="space-y-6">
                        <Section title="Job Card Summary">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                                <StatCard label="Total" value={summary.total} icon={ClipboardList} />
                                <StatCard label="Awaiting station" value={summary.awaitingStation} icon={Hourglass} accent="text-amber-700" />
                                <StatCard label="Awaiting validation" value={summary.awaitingValidation} icon={ShieldCheck} accent="text-blue-800" />
                                <StatCard label="Closed" value={summary.closed} icon={CheckCircle2} accent="text-emerald-600" />
                                <StatCard label="Still editable" value={summary.editable} icon={Pencil} accent="text-violet-700" />
                            </div>
                            {summary.stations > 0 && <p className="text-muted-foreground text-sm">Across {summary.stations} station(s).</p>}
                            {summary.itemsUsed.length > 0 && (
                                <div className="bg-card rounded-xl border p-4">
                                    <p className="mb-2 text-sm font-semibold">Items used</p>
                                    <ul className="divide-y text-sm">
                                        {summary.itemsUsed.map((item) => (
                                            <li key={item.name} className="flex justify-between gap-2 py-1.5">
                                                <span>{item.name}</span>
                                                <span className="text-muted-foreground shrink-0">
                                                    {formatQuantity(item.quantity)} · {item.jobCards} job card{item.jobCards === 1 ? '' : 's'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Section>

                        {list.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No job cards submitted in this period." />
                        ) : (
                            <ul className="space-y-2">
                                {list.map((card) => (
                                    <li key={card.ticketId}>
                                        <Link
                                            href={route('tickets.show', card.ticketId)}
                                            className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-3 shadow-xs transition-colors"
                                        >
                                            <span className="min-w-0 flex-1 space-y-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">{card.ticketId}</span>
                                                    <Pill tone={stageTone(card.stage)}>{STAGE_LABELS[card.stage] ?? card.status}</Pill>
                                                    {card.canEdit && <Pill tone="purple">Editable</Pill>}
                                                </span>
                                                <span className="text-muted-foreground block text-sm">{card.stationName ?? '-'}</span>
                                                {card.workDescription && <span className="block truncate text-sm">{card.workDescription}</span>}
                                                <span className="text-muted-foreground block text-xs">
                                                    {card.itemsCount} item{card.itemsCount === 1 ? '' : 's'}
                                                    {card.resolvedAt ? ` · ${formatDate(card.resolvedAt)}` : ''}
                                                </span>
                                            </span>
                                            <ChevronRight className="text-muted-foreground size-4" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </QueryView>
        </div>
    );
}

function ItemsTab() {
    const consumed = useApiQuery(() => reports.itemsConsumed());
    return (
        <QueryView query={consumed} empty={(items) => items.length === 0 && <EmptyState icon={Package} title="No items consumed yet." />}>
            {(items) => (
                <ul className="space-y-2">
                    {items.map((item, index) => (
                        <li key={index} className="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
                            <Package className="size-5 shrink-0 text-amber-700" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{item.productName}</span>
                                <span className="text-muted-foreground block text-xs">
                                    {item.ticketId ? `Ticket ${item.ticketId}` : 'No ticket'}
                                    {item.consumedAt ? ` · ${timeAgo(item.consumedAt)}` : ''}
                                </span>
                            </span>
                            <span className="font-semibold">x{formatQuantity(item.quantity)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </QueryView>
    );
}

export default function ReportsIndex() {
    const [tab, setTab] = useState<Tab>('activity');
    const tabs: [Tab, string][] = [
        ['activity', 'Activity'],
        ['job-cards', 'Job Cards'],
        ['items', 'Items Used'],
    ];

    return (
        <Page title="My Reports" description="Your activity, job cards & usage">
            <div className="border-b" role="tablist">
                {tabs.map(([value, label]) => (
                    <button
                        key={value}
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={cn(
                            '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
                            tab === value ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground border-transparent',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'activity' && <ActivityTab />}
            {tab === 'job-cards' && <JobCardsTab />}
            {tab === 'items' && <ItemsTab />}
        </Page>
    );
}
