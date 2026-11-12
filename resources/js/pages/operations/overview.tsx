import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { dashboards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Fuel, Gauge, type IconType, Signpost, TriangleAlert, Zap } from '@/components/icons';

export default function OperationsOverview() {
    const { auth } = usePage<SharedData>().props;
    const allowed = auth.user.role === 'Operations Admin';
    const overview = useApiQuery(() => dashboards.operations(), [], { enabled: allowed });

    return (
        <Page title="Operations Overview" back={{ href: '/dashboard', label: 'Dashboard' }} width="wide">
            {!allowed ? (
                <EmptyState
                    icon={Gauge}
                    title="For Operations Admins"
                    description="The operations overview is available to Operations Admins only."
                />
            ) : (
                <QueryView query={overview}>
                    {(o) => (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                            <StatTile label="Total Outstanding" value={o.totalOutstanding} icon={Gauge} color="#2178BD" darkColor="#5AA3E0" />
                            <StatTile label="Nozzles Not Working" value={o.nozzlesNotWorking} icon={Fuel} color="#F44336" darkColor="#EF5350" />
                            <StatTile label="Gensets Not Working" value={o.gensetsNotWorking} icon={Zap} color="#FF9800" darkColor="#FFA726" />
                            <StatTile label="Signages Not Working" value={o.signagesNotWorking} icon={Signpost} color="#9C27B0" darkColor="#BA68C8" />
                            <StatTile label="Escalated Tickets" value={o.escalatedTickets} icon={TriangleAlert} color="#B71C1C" darkColor="#E57373" />
                        </div>
                    )}
                </QueryView>
            )}
        </Page>
    );
}

/**
 * The phone's _StatTile: a big number in the accent colour over a grey label, on a white
 * card edged with a faint tint of the accent. `darkColor` keeps the accent legible on the dark card.
 */
function StatTile({ label, value, icon, color, darkColor }: { label: string; value: number; icon: IconType; color: string; darkColor: string }) {
    return (
        <div
            className="bg-card shadow-card flex min-h-[132px] flex-col justify-center rounded-2xl border border-[color:var(--accent)]/15 p-4 text-[color:var(--accent)] dark:border-[color:var(--accent-dark)]/25 dark:text-[color:var(--accent-dark)]"
            style={{ '--accent': color, '--accent-dark': darkColor } as React.CSSProperties}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-[32px] leading-none font-bold">{value}</span>
                <IconTile icon={icon} size="sm" />
            </div>
            <span className="text-muted-foreground mt-2 line-clamp-2 text-[12.5px] font-medium">{label}</span>
        </div>
    );
}
