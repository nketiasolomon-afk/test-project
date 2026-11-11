import { Page } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { formatDate, type Tone } from '@/lib/format';
import { jobCards } from '@/lib/fuelops-api';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ClipboardList } from '@/components/icons';

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
        <Page title="Cluster Job Cards" description="Work submitted across your team" back={{ href: '/dashboard', label: 'Dashboard' }}>
            {!allowed ? (
                <EmptyState
                    icon={ClipboardList}
                    title="For Cluster Leaders"
                    description="Job cards across the cluster are a Cluster Leader module."
                />
            ) : (
                <QueryView
                    query={cards}
                    empty={(list) => list.length === 0 && <EmptyState icon={ClipboardList} title="No job cards submitted by your team yet." />}
                >
                    {(list) => (
                        <ul className="space-y-3">
                            {list.map((card) => (
                                <li key={card.ticketId}>
                                    <Link
                                        href={`/tickets/${encodeURIComponent(card.ticketId)}`}
                                        className="bg-card hover:bg-accent/40 block rounded-xl border p-4 shadow-xs transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-semibold">{card.ticketId}</span>
                                            <Pill tone={statusTone(card.status)}>{card.status}</Pill>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {[card.technicianName, card.stationName, card.resolvedAt ? formatDate(card.resolvedAt) : null]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                        {card.workDescription && (
                                            <p className="text-muted-foreground mt-1.5 line-clamp-3 text-sm">{card.workDescription}</p>
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
