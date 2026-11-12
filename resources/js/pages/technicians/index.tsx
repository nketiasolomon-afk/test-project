import { Page, Section } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { initials } from '@/lib/format';
import { dashboards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { type TechnicianStats } from '@/types/fuelops';
import { usePage } from '@inertiajs/react';
import { type IconType, MdCheckCircle, MdEngineering, MdGroups2, MdInventory2, MdRoute } from '@/components/icons';

export default function TechnicianDashboard() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const allowed = user.isClusterLeader || user.role === 'Cluster Engineer' || user.role === 'Operations Admin';
    const stats = useApiQuery(() => dashboards.technicianStats(), [], { enabled: allowed });

    return (
        <Page title="Technician Dashboard" description="Performance overview" back={{ href: '/dashboard', label: 'Dashboard' }} width="wide">
            {!allowed ? (
                <EmptyState
                    icon={MdGroups2}
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
                            <div className="space-y-[26px]">
                                {/* The phone's navy-to-blue Team Overview hero. */}
                                <div className="rounded-[20px] bg-[linear-gradient(135deg,#0B1B33_0%,#15315E_35%,#1F4788_70%,#2178BD_100%)] p-5 text-white sm:p-6">
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-base font-bold">Team Overview</p>
                                            <p className="mt-1 text-xs text-white/70">
                                                {technicians.length} technician{technicians.length === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center lg:min-w-[440px]">
                                            <Summary icon={MdRoute} label="Distance" value={`${totalDistance.toFixed(1)} km`} />
                                            <Summary icon={MdCheckCircle} label="Resolved" value={String(totalIssues)} />
                                            <Summary icon={MdInventory2} label="Parts Used" value={String(totalParts)} />
                                        </div>
                                    </div>
                                </div>

                                <Section title="Technicians">
                                    {technicians.length === 0 ? (
                                        <EmptyState icon={MdEngineering} title="No technician data available yet." className="py-8" />
                                    ) : (
                                        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="flex min-w-0 flex-col items-center">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/16 bg-white/12">
                <Icon className="size-5" />
            </span>
            <span className="mt-2 truncate text-base font-bold">{value}</span>
            <span className="mt-0.5 text-[11px] text-white/70">{label}</span>
        </div>
    );
}

/** The phone's _TechnicianStatsCard: initials tile, name and role, then three tinted stat chips. */
function TechnicianCard({ technician }: { technician: TechnicianStats }) {
    const chips: [IconType, string, string, string][] = [
        [MdRoute, `${technician.distanceCoveredKm.toFixed(1)} km`, 'Distance', 'text-[#B45309] dark:text-[#F59E0B]'],
        [MdCheckCircle, String(technician.issuesResolved), 'Resolved', 'text-[#059669] dark:text-[#34D399]'],
        [MdInventory2, String(technician.partsConsumed), 'Parts', 'text-[#6D28D9] dark:text-[#A78BFA]'],
    ];
    return (
        <div className="bg-card shadow-card rounded-2xl border p-4">
            <div className="flex items-center gap-3">
                <span className="bg-primary/12 text-primary dark:bg-primary/25 flex size-[42px] shrink-0 items-center justify-center rounded-xl text-[15px] font-bold dark:text-[#64B5F6]">
                    {initials(technician.fullName) || '?'}
                </span>
                <span className="min-w-0">
                    <span className="text-brand-ink block truncate text-[14.5px] font-semibold dark:text-white">{technician.fullName}</span>
                    {technician.role && <span className="text-muted-foreground mt-0.5 block text-xs">{technician.role}</span>}
                </span>
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-2">
                {chips.map(([Icon, value, label, color]) => (
                    <div key={label} className={`relative flex flex-col items-center overflow-hidden rounded-xl px-2 py-2.5 ${color}`}>
                        <span className="absolute inset-0 bg-current/8 dark:bg-current/14" aria-hidden="true" />
                        <Icon className="relative size-4" />
                        <span className="text-brand-ink relative mt-1.5 text-[13px] font-bold dark:text-white">{value}</span>
                        <span className="text-muted-foreground relative mt-0.5 text-[10px]">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
