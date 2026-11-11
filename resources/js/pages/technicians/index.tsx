import { Page, Section } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { initials } from '@/lib/format';
import { dashboards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type TechnicianStats } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { CircleCheck, type IconType, Package, Route, Users } from '@/components/icons';

export default function TechnicianDashboard() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const allowed = user.isClusterLeader || user.role === 'Cluster Engineer' || user.role === 'Operations Admin';
    const stats = useApiQuery(() => dashboards.technicianStats(), [], { enabled: allowed });

    return (
        <Page title="Technician Dashboard" description="Performance overview" back={{ href: '/dashboard', label: 'Dashboard' }}>
            {!allowed ? (
                <EmptyState
                    icon={Users}
                    title="For cluster and operations staff"
                    description="Team performance is available to Cluster Leaders, Cluster Engineers and Operations Admins."
                />
            ) : (
                <QueryView query={stats}>
                    {(technicians) => {
                        const totalDistance = technicians.reduce((sum, t) => sum + t.distanceCoveredKm, 0);
                        const totalIssues = technicians.reduce((sum, t) => sum + t.issuesResolved, 0);
                        const totalParts = technicians.reduce((sum, t) => sum + t.partsConsumed, 0);
                        return (
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-gradient-to-br from-[#0b1b33] via-[#1f4788] to-[#2178bd] p-6 text-white shadow-lg">
                                    <p className="text-lg font-bold">Team Overview</p>
                                    <p className="text-sm text-white/70">
                                        {technicians.length} technician{technicians.length === 1 ? '' : 's'}
                                    </p>
                                    <div className="mt-5 grid grid-cols-3 gap-4 text-center">
                                        <Summary icon={Route} label="Distance" value={`${totalDistance.toFixed(1)} km`} />
                                        <Summary icon={CircleCheck} label="Resolved" value={String(totalIssues)} />
                                        <Summary icon={Package} label="Parts Used" value={String(totalParts)} />
                                    </div>
                                </div>

                                <Section title="Technicians">
                                    {technicians.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">No technician data available yet.</p>
                                    ) : (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {technicians.map((technician) => (
                                                <TechnicianCard key={technician.technicianId || technician.fullName} technician={technician} />
                                            ))}
                                        </div>
                                    )}
                                </Section>
                            </div>
                        );
                    }}
                </QueryView>
            )}
        </Page>
    );
}

function Summary({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <Icon className="size-5" />
            </span>
            <span className="text-lg font-bold">{value}</span>
            <span className="text-xs text-white/70">{label}</span>
        </div>
    );
}

function TechnicianCard({ technician }: { technician: TechnicianStats }) {
    const chips: [IconType, string, string, string][] = [
        [Route, `${technician.distanceCoveredKm.toFixed(1)} km`, 'Distance', 'text-primary'],
        [CircleCheck, String(technician.issuesResolved), 'Resolved', 'text-emerald-600'],
        [Package, String(technician.partsConsumed), 'Parts', 'text-amber-700'],
    ];
    return (
        <div className="bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full font-bold">
                    {initials(technician.fullName) || '?'}
                </span>
                <span className="min-w-0">
                    <span className="block truncate font-semibold">{technician.fullName}</span>
                    {technician.role && <span className="text-muted-foreground block text-xs">{technician.role}</span>}
                </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                {chips.map(([Icon, value, label, color]) => (
                    <div key={label} className="bg-muted flex flex-col items-center rounded-lg p-2">
                        <Icon className={`size-4 ${color}`} />
                        <span className="text-sm font-bold">{value}</span>
                        <span className="text-muted-foreground text-xs">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
