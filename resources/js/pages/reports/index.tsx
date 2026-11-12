import { Page } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiQuery } from '@/hooks/use-api-query';
import { formatDate, formatDateTime, formatQuantity, fromDateInputValue, timeAgo, toDateInputValue } from '@/lib/format';
import { reports } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Activity, ChevronRight, ClipboardList, MdEdit, Package } from '@/components/icons';
import { useState } from 'react';

type Tab = 'activity' | 'job-cards' | 'items';
type Period = 'week' | 'month' | 'all' | 'custom';

const STAGE_LABELS: Record<string, string> = {
    awaiting_station: 'Awaiting station approval',
    awaiting_validation: 'Awaiting final validation',
    closed: 'Closed',
};

/** The phone's stage colours: amber while at the station, navy-blue awaiting validation, green closed. */
function stageColor(stage: string): { hex: string; text: string } {
    if (stage === 'closed') return { hex: '#059669', text: 'text-[#059669] dark:text-emerald-300' };
    if (stage === 'awaiting_validation') return { hex: '#1F4788', text: 'text-[#1F4788] dark:text-[#8DB4EE]' };
    return { hex: '#B45309', text: 'text-[#B45309] dark:text-amber-300' };
}

/** The phone's report card: white, radius 14, hairline border. */
const CARD = 'bg-card rounded-[14px] border border-border/70 shadow-card';

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
            <div className="grid gap-1.5 sm:max-w-xs">
                <Label htmlFor="activity-date">Date</Label>
                <Input id="activity-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <QueryView query={activity} empty={(items) => items.length === 0 && <EmptyState icon={Activity} title="No activity on this day." />}>
                {(items) => (
                    <ul className="grid gap-2.5 lg:grid-cols-2">
                        {items.map((entry, index) => (
                            <li key={index} className={cn(CARD, 'flex items-start gap-3 p-3.5')}>
                                <span className="min-w-0 flex-1">
                                    <span className="text-foreground block text-[13px] font-semibold">{entry.title}</span>
                                    {entry.subtitle && <span className="text-muted-foreground mt-0.5 block text-xs">{entry.subtitle}</span>}
                                </span>
                                <span className="text-muted-foreground shrink-0 text-[11px]">{formatDateTime(entry.occurredAt, '')}</span>
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
                {/* The phone's ChoiceChips. */}
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Period">
                    {periods.map(([value, label]) => {
                        const selected = period === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setPeriod(value)}
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors',
                                    selected
                                        ? 'border-primary/30 bg-primary/12 text-primary dark:bg-primary/20'
                                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {selected && <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />}
                                {label}
                            </button>
                        );
                    })}
                </div>
                {period === 'custom' && (
                    <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
                        <div className="grid gap-1">
                            <Label htmlFor="from">From</Label>
                            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="to">To</Label>
                            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                        </div>
                    </div>
                )}
            </div>

            <QueryView query={jobCards}>
                {({ summary, jobCards: list }) => (
                    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                        {/* _buildJobCardsSummary */}
                        <section className={cn(CARD, 'p-4 lg:sticky lg:top-6')} aria-label="Job Card Summary">
                            <h2 className="text-foreground text-[15px] font-bold">Job Card Summary</h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                {summary.total} submitted · {summary.stations} station{summary.stations === 1 ? '' : 's'}
                                {summary.editable > 0 ? ` · ${summary.editable} still editable` : ''}
                            </p>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {(
                                    [
                                        ['Awaiting station', summary.awaitingStation, 'awaiting_station'],
                                        ['Awaiting validation', summary.awaitingValidation, 'awaiting_validation'],
                                        ['Closed', summary.closed, 'closed'],
                                    ] as const
                                ).map(([label, value, stage]) => {
                                    const color = stageColor(stage);
                                    return (
                                        <div
                                            key={stage}
                                            className="min-w-0 rounded-xl px-2.5 py-3"
                                            style={{ backgroundColor: `color-mix(in srgb, ${color.hex} 9%, transparent)` }}
                                        >
                                            <p className={cn('text-xl leading-tight font-bold', color.text)}>{value}</p>
                                            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">{label}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            {summary.itemsUsed.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-foreground text-[13px] font-semibold">Items used</p>
                                    <ul className="mt-1.5">
                                        {summary.itemsUsed.map((item) => (
                                            <li key={item.name} className="flex items-baseline gap-2 py-1 text-[12.5px]">
                                                <span className="text-foreground min-w-0 flex-1 break-words">{item.name}</span>
                                                <span className="text-foreground shrink-0 font-semibold">×{formatQuantity(item.quantity)}</span>
                                                <span className="text-muted-foreground w-[68px] shrink-0 text-right text-[11px]">
                                                    {item.jobCards} card{item.jobCards === 1 ? '' : 's'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>

                        {list.length === 0 ? (
                            <EmptyState icon={ClipboardList} title="No job cards submitted in this period." className="py-8" />
                        ) : (
                            <ul className="grid gap-2.5 xl:grid-cols-2">
                                {list.map((card) => {
                                    const color = stageColor(card.stage);
                                    return (
                                        <li key={card.ticketId}>
                                            <Link
                                                href={route('tickets.show', card.ticketId)}
                                                className={cn(CARD, 'hover:border-primary/40 group flex h-full items-center gap-2 p-3.5 transition-colors')}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">{card.ticketId}</span>
                                                        {card.canEdit && <MdEdit className="text-muted-foreground size-[15px] shrink-0" aria-label="Still editable" />}
                                                        <span
                                                            className={cn('shrink-0 rounded-full px-2 py-[3px] text-[10px] leading-tight font-semibold', color.text)}
                                                            style={{ backgroundColor: `color-mix(in srgb, ${color.hex} 11%, transparent)` }}
                                                        >
                                                            {STAGE_LABELS[card.stage] ?? card.status}
                                                        </span>
                                                    </span>
                                                    <span className="text-muted-foreground mt-1 block text-xs">
                                                        {[
                                                            card.stationName,
                                                            card.resolvedAt ? formatDate(card.resolvedAt) : null,
                                                            `${card.itemsCount} item${card.itemsCount === 1 ? '' : 's'}`,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </span>
                                                    {card.workDescription && (
                                                        <span className="text-muted-foreground mt-1.5 line-clamp-2 block text-xs">{card.workDescription}</span>
                                                    )}
                                                </span>
                                                <ChevronRight className="text-muted-foreground group-hover:text-primary size-5 shrink-0" />
                                            </Link>
                                        </li>
                                    );
                                })}
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
                <ul className="grid gap-2.5 lg:grid-cols-2">
                    {items.map((item, index) => (
                        <li key={index} className={cn(CARD, 'flex items-center gap-3 p-3.5')}>
                            <span className="min-w-0 flex-1">
                                <span className="text-foreground block text-[13px] font-semibold break-words">{item.productName}</span>
                                <span className="text-muted-foreground mt-0.5 block text-[11px]">
                                    {item.ticketId ? `Ticket ${item.ticketId}` : 'No ticket'}
                                    {item.consumedAt ? ` · ${timeAgo(item.consumedAt)}` : ''}
                                </span>
                            </span>
                            <span className="text-muted-foreground shrink-0 font-semibold">×{formatQuantity(item.quantity)}</span>
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
        <Page title="My Reports" description="Your activity, job cards & usage" width="wide">
            {/* The phone's TabBar under the app bar: equal-width tabs with a primary underline. */}
            <div className="border-border/70 -mx-4 -mt-5 border-b sm:-mx-5 sm:-mt-6 lg:mx-0 lg:mt-0" role="tablist">
                <div className="flex lg:max-w-md">
                    {tabs.map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={cn(
                                '-mb-px flex-1 border-b-[3px] px-2 py-3 text-sm font-semibold transition-colors',
                                tab === value ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground border-transparent',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {tab === 'activity' && <ActivityTab />}
            {tab === 'job-cards' && <JobCardsTab />}
            {tab === 'items' && <ItemsTab />}
        </Page>
    );
}
