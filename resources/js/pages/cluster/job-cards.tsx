import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { formatDate, type Tone } from '@/lib/format';
import { jobCards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { MdAssignmentOutline, MdAssignmentTurnedIn } from '@/components/icons';

function statusTone(status: string): Tone {
    const normalized = status.toUpperCase();
    if (normalized.includes('CLOSED') || normalized.includes('APPROVED')) return 'emerald';
    if (normalized.includes('REJECTED')) return 'red';
    return 'amber';
}

export default function ClusterJobCards() {
    const { auth } = usePage<SharedData>().props;
    const allowed = auth.user.isClusterLeader;
    const cards = useApiQuery(() => jobCards.cluster(), [], { enabled: allowed });

    return (
        <Page
            title="Cluster Job Cards"
            description="Work submitted across your team"
            back={{ href: '/dashboard', label: 'Dashboard' }}
            width="wide"
        >
            {!allowed ? (
                <EmptyState
                    icon={MdAssignmentOutline}
                    title="For Cluster Leaders"
                    description="Job cards across the cluster are a Cluster Leader module."
                />
            ) : (
                <QueryView
                    query={cards}
                    empty={(list) => list.length === 0 && <EmptyState icon={MdAssignmentTurnedIn} title="No job cards submitted by your team yet." />}
                >
                    {(list) => (
                        <ul className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                            {list.map((card) => (
                                <li key={card.ticketId}>
                                    <Link
                                        href={`/tickets/${encodeURIComponent(card.ticketId)}`}
                                        className="bg-card shadow-card hover:border-primary/40 focus-visible:ring-primary block rounded-[14px] border p-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-brand-ink min-w-0 text-sm font-semibold dark:text-white">{card.ticketId}</span>
                                            <Pill tone={statusTone(card.status)} className="rounded-full px-2 py-[3px] text-[10px] font-semibold">
                                                {card.status}
                                            </Pill>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {[card.technicianName, card.stationName, card.resolvedAt ? formatDate(card.resolvedAt) : null]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                        {card.workDescription && (
                                            <p className="text-muted-foreground mt-1.5 line-clamp-3 text-xs leading-relaxed">{card.workDescription}</p>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </QueryView>
            )}
        </Page>
    );
}
