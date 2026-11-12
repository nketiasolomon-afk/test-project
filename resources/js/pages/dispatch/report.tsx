import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { QueryView } from '@/components/fuelops/states';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { fromDateInputValue, toDateInputValue } from '@/lib/format';
import { dispatch } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { Check } from '@/components/icons';
import { useMemo, useState } from 'react';

type Json = Record<string, unknown>;

const PRESETS = [7, 30, 90];

function record(value: unknown): Json {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function records(value: unknown): Json[] {
    return Array.isArray(value) ? value.filter((item): item is Json => !!item && typeof item === 'object') : [];
}

function toNumber(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
}

function pct(rate: unknown): string {
    const value = toNumber(rate);
    return value === null ? '-' : `${Math.round(value * 100)}%`;
}

function minutes(value: number): string {
    if (value < 60) return `${value}m`;
    const hours = Math.floor(value / 60);
    return value % 60 === 0 ? `${hours}h` : `${hours}h ${value % 60}m`;
}

interface BreakdownRow {
    label: string;
    value: number;
    trailing: string;
}

function countRows(list: unknown): BreakdownRow[] {
    return records(list).map((e) => ({ label: String(e.label ?? ''), value: toNumber(e.count) ?? 0, trailing: String(e.count ?? 0) }));
}

function rateRows(list: unknown): BreakdownRow[] {
    return records(list)
        .filter((e) => (toNumber(e.count) ?? 0) > 0)
        .map((e) => ({
            label: String(e.label ?? ''),
            value: toNumber(e.count) ?? 0,
            trailing: `${e.count} of ${e.total} (${pct(e.rate)})`,
        }));
}

export default function DispatchReport() {
    const [days, setDays] = useState<number | null>(30);
    const today = useMemo(() => new Date(), []);
    const [from, setFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 86_400_000)));
    const [to, setTo] = useState(() => toDateInputValue(today));

    const choosePreset = (preset: number) => {
        setDays(preset);
        setFrom(toDateInputValue(new Date(Date.now() - preset * 86_400_000)));
        setTo(toDateInputValue(new Date()));
    };

    const report = useApiQuery(() => dispatch.report({ from: fromDateInputValue(from), to: fromDateInputValue(to) }), [from, to]);

    return (
        <Page title="Dispatch Report" back={{ href: '/dispatch/queue', label: 'Assignment Queue' }} width="wide">
            <div className="flex flex-wrap items-end gap-3">
                {/* The phone's SegmentedButton: outlined segments, the chosen one tinted blue with a check. */}
                <div className="bg-card flex w-full overflow-hidden rounded-full border sm:w-auto" role="group" aria-label="Period">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            aria-pressed={days === preset}
                            onClick={() => choosePreset(preset)}
                            className={cn(
                                'flex h-11 flex-1 items-center justify-center gap-1.5 border-l px-4 text-sm font-semibold transition-colors first:border-l-0 sm:flex-none sm:px-5',
                                days === preset ? 'bg-primary/12 text-primary dark:bg-primary/25' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {days === preset && <Check className="size-4" />}
                            {preset} days
                        </button>
                    ))}
                </div>
                <Field label="From" htmlFor="report-from" className="min-w-0 flex-1 sm:flex-none">
                    <Input
                        id="report-from"
                        type="date"
                        value={from}
                        max={to}
                        onChange={(event) => {
                            setDays(null);
                            setFrom(event.target.value);
                        }}
                    />
                </Field>
                <Field label="To" htmlFor="report-to" className="min-w-0 flex-1 sm:flex-none">
                    <Input
                        id="report-to"
                        type="date"
                        value={to}
                        min={from}
                        onChange={(event) => {
                            setDays(null);
                            setTo(event.target.value);
                        }}
                    />
                </Field>
            </div>

            <QueryView query={report}>{(data) => <ReportBody report={data} />}</QueryView>
        </Page>
    );
}

function ReportBody({ report }: { report: Json }) {
    const latency = record(report.latencyMinutes);
    const declines = record(report.declines);
    const overrides = record(report.overrides);

    const latencyTile = (label: string, detail: string, stats: unknown) => {
        const m = record(stats);
        const median = toNumber(m.median);
        const avg = toNumber(m.avg);
        return (
            <StatTile
                key={label}
                label={label}
                value={median === null ? '-' : minutes(Math.round(median))}
                detail={median === null ? 'no data yet' : `median · avg ${minutes(Math.round(avg ?? 0))} · n=${m.count ?? 0}\n${detail}`}
            />
        );
    };

    const distribution: BreakdownRow[] = records(report.distribution).map((d) => ({
        label: String(d.technicianName ?? ''),
        value: toNumber(d.assigned) ?? 0,
        trailing: `${d.assigned ?? 0} assigned · ${d.declined ?? 0} declined${(toNumber(d.overrides) ?? 0) > 0 ? ` · ${d.overrides} override` : ''}`,
    }));

    return (
        <div className="space-y-6">
            <p className="text-muted-foreground text-[12.5px]">
                {String(report.ticketCount ?? 0)} tickets raised · {String(report.from ?? '')} to {String(report.to ?? '')}
            </p>

            <Section title="Response times">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    {latencyTile('Raised → assigned', 'Leader dispatch', latency.dispatch)}
                    {latencyTile('Assigned → accepted', 'Technician acknowledgement', latency.acknowledgement)}
                    {latencyTile('Accepted → on site', 'Travel / mobilisation', latency.acceptedToOnSite)}
                    {latencyTile('On site → job card', 'Time on the job', latency.onSiteToJobCard)}
                </div>
            </Section>

            <Section title="Rates">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    <StatTile label="Decline rate" value={pct(declines.rate)} detail={`${declines.count ?? 0} declines`} />
                    <StatTile label="Override rate" value={pct(overrides.rate)} detail={`${overrides.count ?? 0} overrides`} />
                    <StatTile label="Reassignment rate" value={pct(report.reassignRate)} detail="tickets reassigned at least once" />
                    <StatTile label="Reopen rate" value={pct(report.reopenRate)} detail="job cards not confirmed" />
                </div>
            </Section>

            <div className="grid items-start gap-4 lg:grid-cols-2">
                <Breakdown title="Assignment distribution" rows={distribution} />
                <Breakdown title="Declines by technician" rows={rateRows(declines.byTechnician)} />
                <Breakdown title="Declines by station" rows={rateRows(declines.byStation)} />
                <Breakdown title="Decline reasons" rows={countRows(declines.byReason)} />
                <Breakdown title="Overrides by leader" rows={rateRows(overrides.byLeader)} />
                <Breakdown title="Override reasons" rows={countRows(overrides.byReason)} />
            </div>
        </div>
    );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="bg-card shadow-card min-w-0 rounded-[14px] border p-3 sm:p-4">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-brand-ink mt-1 text-[22px] leading-tight font-bold dark:text-white">{value}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug whitespace-pre-line">{detail}</p>
        </div>
    );
}

/** A ranked list with a thin single-hue meter per row; the number is always printed beside it. */
function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
    const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0);
    return (
        <Section title={title} className="bg-card shadow-card rounded-[18px] border p-4">
            {rows.length === 0 ? (
                <p className="text-muted-foreground text-[12.5px]">Nothing recorded in this period.</p>
            ) : (
                <ul className="space-y-2.5">
                    {rows.map((row, index) => (
                        <li key={`${row.label}-${index}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-[13px]">{row.label}</span>
                                <span className="text-muted-foreground shrink-0 text-xs">{row.trailing}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-500/14 dark:bg-slate-400/22">
                                <div
                                    className="bg-primary h-full rounded dark:bg-[#5AA3E0]"
                                    style={{ width: `${max === 0 ? 0 : (row.value / max) * 100}%` }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}
