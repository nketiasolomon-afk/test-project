import { Page } from '@/components/fuelops/page';
import { EmptyState, QueryView } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { ageLabel } from '@/lib/format';
import { inventoryRequests, notifications } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type AppNotification } from '@/types/fuelops';
import { router } from '@inertiajs/react';
import { Bell, BellOff, CheckCheck, TriangleAlert } from '@/components/icons';
import { useEffect, useState } from 'react';

/** The structured contents of a "Your items are ready to collect" notification. */
interface CollectionNotice {
    collectionCode: string;
    items: string[];
    requestId: string | null;
}

const CODE_PATTERN = /Collection code\s*:?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)/i;
// Item names contain dots ("0.75*2"), so stop at the closing sentence rather than at the first full stop.
const ITEMS_PATTERN = /Items issued\s*:\s*([\s\S]+?)\.?\s*(?:Give this code\b[\s\S]*)?$/i;
// Each item ends in its quantity ("... x13"), the only safe place to split: names may contain commas.
const ITEM_SPLIT = /(?<=\bx\s?\d+)\s*,\s*/i;

/**
 * Reads a collection notice from the notification's `data` payload when the ERP sends one,
 * otherwise from the message text. Null for any notification that isn't a collection notice.
 */
function parseCollectionNotice(n: AppNotification): CollectionNotice | null {
    const data = n.data;
    const code = String(data.collectionCode ?? data.collection_code ?? '') || n.message.match(CODE_PATTERN)?.[1] || '';
    if (code === '') return null;

    let items: string[];
    const rawItems = data.items;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
        items = rawItems
            .map((item) => {
                if (item && typeof item === 'object') {
                    const record = item as Record<string, unknown>;
                    const name = String(record.itemName ?? record.name ?? '');
                    const qty = record.quantity ?? record.quantityApproved;
                    return qty !== undefined && qty !== null ? `${name} x${qty}` : name;
                }
                return String(item);
            })
            .filter((text) => text.trim() !== '');
    } else {
        const itemsText = n.message.match(ITEMS_PATTERN)?.[1]?.trim() ?? '';
        items = itemsText === '' ? [] : itemsText.split(ITEM_SPLIT).map((s) => s.trim()).filter(Boolean);
    }

    const requestId = String(data.requestId ?? data.request_id ?? '');
    return { collectionCode: code, items, requestId: requestId === '' ? null : requestId };
}

export default function Notifications() {
    const query = useApiQuery(() => notifications.list());
    // Collection code -> the technician's request id, for notices whose text doesn't carry it.
    const [requestIdByCode, setRequestIdByCode] = useState<Record<string, string>>({});
    const [markingAll, setMarkingAll] = useState(false);

    const items = query.data?.items;
    const unread = query.data?.unreadCount ?? 0;

    // Best-effort: without it a collection notice just omits the Request ID row.
    useEffect(() => {
        if (!items) return;
        const needsLookup = items.some((n) => {
            const notice = parseCollectionNotice(n);
            return notice !== null && notice.requestId === null && !(notice.collectionCode.toUpperCase() in requestIdByCode);
        });
        if (!needsLookup) return;
        let cancelled = false;
        inventoryRequests
            .mine()
            .then((requests) => {
                const map: Record<string, string> = {};
                for (const request of requests) {
                    if (!request.requestId) continue;
                    request.collectionCodes.forEach((c) => (map[c.code.toUpperCase()] = request.requestId));
                    request.items.forEach((i) => {
                        if (i.collectionCode) map[i.collectionCode.toUpperCase()] = request.requestId;
                    });
                }
                if (!cancelled) setRequestIdByCode(map);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    const open = (item: AppNotification) => {
        if (!item.readAt) notifications.markRead(item.id).catch(() => undefined);
        if (item.ticketId) {
            router.visit(route('tickets.show', item.ticketId));
        } else {
            query.setData((current) =>
                current
                    ? {
                          unreadCount: item.readAt ? current.unreadCount : Math.max(0, current.unreadCount - 1),
                          items: current.items.map((n) => (n.id === item.id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
                      }
                    : current,
            );
        }
    };

    const markAllRead = async () => {
        setMarkingAll(true);
        try {
            await notifications.markAllRead();
            await query.reload();
        } catch (e) {
            toast.error(errorText(e));
        } finally {
            setMarkingAll(false);
        }
    };

    return (
        <Page
            title="Notifications"
            description={unread > 0 ? `${unread} unread` : undefined}
            width="narrow"
            actions={
                unread > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
                        <CheckCheck /> Mark all read
                    </Button>
                )
            }
        >
            <QueryView
                query={query}
                empty={(data) => data.items.length === 0 && <EmptyState icon={BellOff} title="No notifications yet." />}
            >
                {(data) => (
                    <ul className="bg-card divide-y rounded-xl border">
                        {data.items.map((n) => {
                            const parsed = parseCollectionNotice(n);
                            const notice = parsed && {
                                ...parsed,
                                requestId: parsed.requestId ?? requestIdByCode[parsed.collectionCode.toUpperCase()] ?? null,
                            };
                            const Icon = n.isOverride ? TriangleAlert : Bell;
                            return (
                                <li key={n.id}>
                                    <button type="button" onClick={() => open(n)} className="hover:bg-accent flex w-full gap-3 p-4 text-left">
                                        <Icon
                                            className={cn(
                                                'mt-0.5 size-5 shrink-0',
                                                n.readAt ? 'text-muted-foreground' : n.isOverride ? 'text-orange-700' : 'text-primary',
                                            )}
                                        />
                                        <span className="min-w-0 flex-1 space-y-1">
                                            <span className={cn('block text-sm', n.readAt ? 'font-medium' : 'font-bold')}>{n.title}</span>
                                            {notice ? (
                                                <span className="text-muted-foreground block text-sm">
                                                    <ul className="list-disc space-y-0.5 pl-4">
                                                        {notice.requestId && (
                                                            <li>
                                                                <span className="font-semibold">Request ID:</span> {notice.requestId}
                                                            </li>
                                                        )}
                                                        <li>
                                                            <span className="font-semibold">Collection Code:</span> {notice.collectionCode}
                                                        </li>
                                                        {notice.items.length === 1 ? (
                                                            <li>
                                                                <span className="font-semibold">Item Issued:</span> {notice.items[0]}
                                                            </li>
                                                        ) : (
                                                            notice.items.length > 1 && (
                                                                <li>
                                                                    <span className="font-semibold">Items Issued:</span>
                                                                    <ul className="list-[circle] pl-4">
                                                                        {notice.items.map((item, index) => (
                                                                            <li key={index}>{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                    <span className="mt-1 block">Give the collection code at the station to collect.</span>
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground block text-sm whitespace-pre-line">{n.message}</span>
                                            )}
                                            <span className="text-muted-foreground block text-xs">{ageLabel(n.createdAt)}</span>
                                        </span>
                                        {!n.readAt && <span className="bg-primary mt-2 size-2 shrink-0 rounded-full" aria-label="Unread" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </QueryView>
        </Page>
    );
}
