import { Page } from '@/components/fuelops/page';
import { StatCard } from '@/components/fuelops/stat-card';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { dashboards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Fuel, Gauge, Signpost, TriangleAlert, Zap } from 'lucide-react';

export default function OperationsOverview() {
    const { auth } = usePage<SharedData>().props;
    const allowed = auth.user.role === 'Operations Admin';
    const overview = useApiQuery(() => dashboards.operations(), [], { enabled: allowed });

    return (
        <Page title="Operations Overview" back={{ href: '/dashboard', label: 'Dashboard' }}>
            {!allowed ? (
                <EmptyState
                    icon={Gauge}
                    title="For Operations Admins"
                    description="The operations overview is available to Operations Admins only."
                />
            ) : (
                <QueryView query={overview}>
                    {(o) => (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <StatCard label="Total Outstanding" value={o.totalOutstanding} icon={Gauge} accent="text-primary" />
                            <StatCard label="Nozzles Not Working" value={o.nozzlesNotWorking} icon={Fuel} accent="text-red-600" />
                            <StatCard label="Gensets Not Working" value={o.gensetsNotWorking} icon={Zap} accent="text-orange-600" />
                            <StatCard label="Signages Not Working" value={o.signagesNotWorking} icon={Signpost} accent="text-violet-700" />
                            <StatCard
                                label="Escalated Tickets"
                                value={o.escalatedTickets}
                                icon={TriangleAlert}
                                accent="text-red-900 dark:text-red-400"
                            />
                        </div>
                    )}
                </QueryView>
            )}
        </Page>
    );
}
