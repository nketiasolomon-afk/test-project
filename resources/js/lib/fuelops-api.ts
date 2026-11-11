/**
 * Every FuelOps ERP endpoint the app uses, one function each. Pages call these
 * rather than `api` directly, so request and response shapes live in one place.
 *
 * Functions throw `ApiError` (see lib/api.ts) on failure.
 */

import { api, ApiError, formData, listOf } from '@/lib/api';
import type { User } from '@/types';
import type {
    ActivityEntry,
    AppNotification,
    CctvRequisition,
    CctvRequisitionSubmission,
    ClusterCovers,
    ClusterInventoryRequest,
    ClusterJobCardSummary,
    ClusterMiniStoreEntry,
    ClusterOverview,
    ComplianceCertificateSummary,
    ComplianceRequestSummary,
    ConsumedItem,
    CrewOptions,
    DailyUpdateCrewInput,
    DispatchReasons,
    EligibleTechnician,
    HomeOverview,
    InventoryRequest,
    JobCard,
    JobCardCrewInput,
    JobCardItemTotal,
    JobCardsOverview,
    JobCardStock,
    JobItemInput,
    MiniStoreItem,
    MyDispatchStatus,
    MyJobCardSummary,
    MyStock,
    MyStockItem,
    OperationsManagerOverview,
    PendingRestockApproval,
    Project,
    RestockRequest,
    SpecialAssignment,
    StationOption,
    TechnicianAvailability,
    TechnicianStats,
    Ticket,
    TicketEvent,
    TicketSummary,
    WarehouseProduct,
} from '@/types/fuelops';

type Json = Record<string, unknown>;

/** The ERP validates ids as integers where they are numeric, so send them that way. */
function idValue(id: string): string | number {
    return /^\d+$/.test(id) ? Number(id) : id;
}

function str(value: unknown, fallback = ''): string {
    return value === null || value === undefined ? fallback : String(value);
}

function strOrNull(value: unknown): string | null {
    return value === null || value === undefined ? null : String(value);
}

function num(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function day(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Unwraps single-record responses the ERP sends either bare or as `{ data: {...} }`. */
function recordOf<T>(response: unknown): T {
    const wrapped = (response as Json | null)?.data;
    return (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) ? wrapped : response) as T;
}

// ==================== Tickets ====================

export interface NewTicketInput {
    customerId: string;
    category: string;
    relatedAsset?: string | null;
    modelNumber?: string | null;
    serialNumber?: string | null;
    priority: string;
    description: string;
    attachment?: File | null;
}

export const tickets = {
    /** The caller's assigned tickets (the Tickets list). */
    assigned: async (): Promise<Ticket[]> => listOf<Ticket>(await api.get('/tickets/assigned')),

    get: (ticketId: string): Promise<Ticket> => api.get<Ticket>(`/tickets/${encodeURIComponent(ticketId)}`),

    /** A Station Leader reports a new issue. Resolves to the new ticket number. */
    create: async (input: NewTicketInput): Promise<string> => {
        const fields = {
            customer_id: input.customerId,
            category: input.category,
            related_asset: input.relatedAsset || null,
            model_number: input.modelNumber || null,
            serial_number: input.serialNumber || null,
            priority: input.priority,
            description: input.description,
        };
        const response = input.attachment
            ? await api.post<Json>('/tickets', formData({ ...fields, attachment: input.attachment }))
            : await api.post<Json>('/tickets', fields);
        return str(response.ticket_number);
    },

    /** Pre-dispatch free-text decline, only for tickets outside the dispatch flow. */
    reject: (ticketId: string, reason?: string | null): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/reject`, { reason: reason || null }),

    /** A Station Leader approves or rejects the technician's resolution. */
    stationValidate: (ticketId: string, approve: boolean, note?: string | null): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/station-validate`, {
            decision: approve ? 'approve' : 'reject',
            note: note || null,
        }),

    /** A Cluster Engineer/Manager validates and closes the ticket. */
    validate: (ticketId: string, note?: string | null): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/validate`, { note: note || null }),

    events: async (ticketId: string): Promise<TicketEvent[]> =>
        listOf<TicketEvent>(await api.get(`/tickets/${encodeURIComponent(ticketId)}/events`)),
};

// ==================== Job cards ====================

export interface JobCardInput {
    workDescription: string;
    items: JobItemInput[];
    /** The submitter's own mode of transport. */
    transportMode?: string | null;
    /** Teammates who worked the ticket with the submitter. */
    technicians?: JobCardCrewInput[];
}

export const jobCards = {
    /** Null when no job card has been submitted for the ticket yet. */
    get: async (ticketId: string): Promise<JobCard | null> => {
        try {
            return await api.get<JobCard>(`/job-cards/${encodeURIComponent(ticketId)}`);
        } catch (error) {
            if (error instanceof ApiError && error.isNotFound) return null;
            throw error;
        }
    },

    submit: async (ticketId: string, input: JobCardInput): Promise<JobCard> =>
        recordOf<JobCard>(
            await api.post('/job-cards', {
                ticket_id: ticketId,
                work_description: input.workDescription,
                items: input.items,
                transport_mode: input.transportMode ?? null,
                technicians: input.technicians ?? [],
            }),
        ),

    /** Edits a submitted job card; the ERP allows it until the station leader approves it. */
    update: async (ticketId: string, input: JobCardInput): Promise<JobCard> =>
        recordOf<JobCard>(
            await api.patch(`/job-cards/${encodeURIComponent(ticketId)}`, {
                work_description: input.workDescription,
                items: input.items,
                transport_mode: input.transportMode ?? null,
                technicians: input.technicians ?? [],
            }),
        ),

    /** Uploads "proof of work" photos for a ticket. Resolves to their URLs. */
    uploadPhotos: async (ticketId: string, photos: File[]): Promise<string[]> => {
        const response = await api.post<Json>('/job-cards/photos', formData({ ticket_id: ticketId, photos }));
        return Array.isArray(response.urls) ? (response.urls as string[]) : [];
    },

    crewOptions: async (ticketId: string): Promise<CrewOptions> => {
        const response = await api.get<Json>(`/job-cards/${encodeURIComponent(ticketId)}/crew-options`);
        return {
            technicians: Array.isArray(response.technicians) ? (response.technicians as CrewOptions['technicians']) : [],
            transportModes: Array.isArray(response.transportModes) ? response.transportModes.map(String) : [],
        };
    },

    /** Resolves to the URL of the job card's PDF. */
    pdfUrl: async (ticketId: string): Promise<string> =>
        str((await api.get<Json>(`/job-cards/${encodeURIComponent(ticketId)}/pdf`)).pdf_url),

    /** Cluster Leader only: job cards across the cluster. */
    cluster: async (): Promise<ClusterJobCardSummary[]> => listOf<ClusterJobCardSummary>(await api.get('/job-cards/cluster')),
};

// ==================== Dispatch (ticket assignment & acceptance flow) ====================

/**
 * An idempotency key per intent, derived from the ticket's current assignment rather
 * than random: a second click, or a retry after a dropped connection, sends the same
 * key, so the ERP replays its first answer instead of acting twice.
 */
function idempotency(action: string, ticket: Ticket, extra?: string): Record<string, string> {
    const stamp = Date.parse(ticket.assignedAt ?? ticket.reportedAt ?? '') || 0;
    const key = [action, ticket.ticketId, ticket.dispatchState ?? '', String(stamp), ...(extra ? [extra] : [])].join(':');
    return { 'Idempotency-Key': key.slice(0, 100) };
}

export interface AssignOptions {
    isOverride?: boolean;
    overrideReasonCode?: string | null;
    overrideNote?: string | null;
    /** Required when taking the ticket off a technician who holds it. */
    reassignReason?: string | null;
}

let cachedReasons: DispatchReasons | null = null;

export const dispatch = {
    /** NEW, DECLINED and REOPENED tickets awaiting dispatch, sorted by the ERP. */
    queue: async (cluster = 'mine'): Promise<Ticket[]> => listOf<Ticket>(await api.get(`/clusters/${encodeURIComponent(cluster)}/queue`)),

    /** The technician picker for one ticket: its cluster's roster with live availability. */
    pickerRoster: async (ticketId: string): Promise<TechnicianAvailability[]> =>
        listOf<TechnicianAvailability>(await api.get('/tickets/eligible-technicians', { ticket_id: ticketId })),

    roster: async (cluster = 'mine'): Promise<TechnicianAvailability[]> =>
        listOf<TechnicianAvailability>(await api.get(`/clusters/${encodeURIComponent(cluster)}/technicians`)),

    /** Assign or reassign. Throws a conflict (`error.isConflict`) if another leader got there first. */
    assign: (ticket: Ticket, technicianId: string, options: AssignOptions = {}): Promise<Ticket> =>
        api.post<Ticket>(
            `/tickets/${encodeURIComponent(ticket.ticketId)}/assign`,
            {
                technician_id: idValue(technicianId),
                expected_state: ticket.dispatchState ?? null,
                is_override: options.isOverride ?? false,
                override_reason_code: options.overrideReasonCode ?? null,
                override_note: options.overrideNote ?? null,
                reason: options.reassignReason ?? null,
            },
            { headers: idempotency('assign', ticket, technicianId) },
        ),

    cancel: (ticket: Ticket, reason: string): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticket.ticketId)}/cancel`, { reason }, { headers: idempotency('cancel', ticket) }),

    reopen: (ticket: Ticket, reason: string): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticket.ticketId)}/reopen`, { reason }, { headers: idempotency('reopen', ticket) }),

    /** Metrics for the leader's reporting view; shown as-is. */
    report: (range: { from?: Date | null; to?: Date | null } = {}, cluster = 'mine'): Promise<Json> =>
        api.get<Json>(`/clusters/${encodeURIComponent(cluster)}/dispatch-report`, {
            from: range.from ? day(range.from) : null,
            to: range.to ? day(range.to) : null,
        }),

    covers: async (): Promise<ClusterCovers[]> => listOf<ClusterCovers>(await api.get('/dispatch/covers')),

    createCover: (input: { clusterId: string; userId: string; startsAt: Date; endsAt: Date; reason?: string | null }): Promise<unknown> =>
        api.post('/dispatch/covers', {
            cluster_id: idValue(input.clusterId),
            user_id: idValue(input.userId),
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            reason: input.reason || null,
        }),

    cancelCover: (coverId: string): Promise<unknown> => api.post(`/dispatch/covers/${encodeURIComponent(coverId)}/cancel`),

    /** "Assigned to me": pending responses first, then in-progress, then accepted. */
    myAssignments: async (): Promise<Ticket[]> => listOf<Ticket>(await api.get('/technicians/me/assignments')),

    accept: (ticket: Ticket, geoLocation?: string | null): Promise<Ticket> =>
        api.post<Ticket>(
            `/tickets/${encodeURIComponent(ticket.ticketId)}/accept`,
            { geo_location: geoLocation ?? null },
            { headers: idempotency('accept', ticket) },
        ),

    decline: (ticket: Ticket, reasonCode: string, note?: string | null): Promise<Ticket> =>
        api.post<Ticket>(
            `/tickets/${encodeURIComponent(ticket.ticketId)}/decline`,
            { reason_code: reasonCode, note: note || null },
            { headers: idempotency('decline', ticket) },
        ),

    start: (ticket: Ticket): Promise<Ticket> =>
        api.post<Ticket>(`/tickets/${encodeURIComponent(ticket.ticketId)}/start`, {}, { headers: idempotency('start', ticket) }),

    myStatus: (): Promise<MyDispatchStatus> => api.get<MyDispatchStatus>('/technicians/me/status'),

    setDutyStatus: (onDuty: boolean): Promise<MyDispatchStatus> =>
        api.patch<MyDispatchStatus>('/technicians/me/duty-status', { duty_status: onDuty ? 'on_duty' : 'off_duty' }),

    /** The controlled override/decline reason lists; cached, as they only change on an ERP deploy. */
    reasons: async (): Promise<DispatchReasons> => {
        if (cachedReasons) return cachedReasons;
        const response = await api.get<Json>('/dispatch/reasons');
        cachedReasons = {
            override: Array.isArray(response.override) ? (response.override as DispatchReasons['override']) : [],
            decline: Array.isArray(response.decline) ? (response.decline as DispatchReasons['decline']) : [],
        };
        return cachedReasons;
    },
};

// ==================== Notifications ====================

export const notifications = {
    list: async (unreadOnly = false): Promise<{ items: AppNotification[]; unreadCount: number }> => {
        const response = await api.get<Json>('/notifications', { unread: unreadOnly ? 1 : null });
        return {
            items: listOf<Json>(response).map((n) => ({
                id: str(n.id),
                type: strOrNull(n.type),
                title: str(n.title, 'Notification'),
                message: str(n.message),
                ticketId: strOrNull(n.ticketId),
                isOverride: n.isOverride === true,
                readAt: strOrNull(n.readAt),
                createdAt: strOrNull(n.createdAt),
                data: n.data && typeof n.data === 'object' && !Array.isArray(n.data) ? (n.data as Record<string, unknown>) : {},
            })),
            unreadCount: num(response.unreadCount),
        };
    },

    markRead: (id: string): Promise<unknown> => api.post(`/notifications/${encodeURIComponent(id)}/read`),

    markAllRead: (): Promise<unknown> => api.post('/notifications/read-all'),
};

// ==================== Dashboards ====================

function ticketSummary(json: Json): TicketSummary {
    return {
        ticketId: str(json.ticketId),
        stationName: str(json.stationName),
        issueType: str(json.issueType),
        rawStatus: str(json.rawStatus ?? json.status),
        dispatchState: strOrNull(json.dispatchState),
        assigneeName: strOrNull((json.assignee as Json | null)?.fullName),
        canAssign: json.canAssign === true,
        isOverrideAssignment: json.isOverrideAssignment === true,
    };
}

export const dashboards = {
    home: async (): Promise<HomeOverview> => {
        const response = await api.get<Json>('/dashboard/mine');
        return {
            activeIssues: num(response.activeIssues),
            pendingIssues: num(response.pendingIssues),
            completedIssues: num(response.completedIssues),
            recentActivity: Array.isArray(response.recentActivity) ? (response.recentActivity as HomeOverview['recentActivity']) : [],
        };
    },

    cluster: async (): Promise<ClusterOverview> => {
        const response = await api.get<Json>('/cluster-manager/overview');
        return {
            ticketCountsByStatus: (response.ticketCountsByStatus as Record<string, number>) ?? {},
            outstandingTickets: Array.isArray(response.outstandingTickets) ? (response.outstandingTickets as Json[]).map(ticketSummary) : [],
            assetsServicingDue: Array.isArray(response.assetsServicingDue)
                ? (response.assetsServicingDue as ClusterOverview['assetsServicingDue'])
                : [],
        };
    },

    operations: async (): Promise<OperationsManagerOverview> => {
        const response = await api.get<Json>('/operations-manager/overview');
        return {
            totalOutstanding: num(response.totalOutstanding),
            nozzlesNotWorking: num(response.nozzlesNotWorking),
            gensetsNotWorking: num(response.gensetsNotWorking),
            signagesNotWorking: num(response.signagesNotWorking),
            escalatedTickets: num(response.escalatedTickets),
        };
    },

    /** Per-technician distance, issues resolved and parts consumed. Also the crew roster for daily updates. */
    technicianStats: async (): Promise<TechnicianStats[]> =>
        listOf<Json>(await api.get('/technicians/stats')).map((t) => ({
            technicianId: str(t.technicianId ?? t.userId),
            fullName: str(t.fullName ?? t.name),
            role: str(t.role),
            distanceCoveredKm: num(t.distanceCoveredKm),
            issuesResolved: num(t.issuesResolved),
            partsConsumed: num(t.partsConsumed),
        })),
};

// ==================== Products & stations ====================

export const products = {
    /** `warehouse` restricts results to one warehouse (e.g. 'IT' for CCTV and network equipment). */
    search: async (query: string, warehouse?: string | null, signal?: AbortSignal): Promise<WarehouseProduct[]> =>
        listOf<Json>(await api.get('/products', { search: query, warehouse: warehouse ?? null }, { signal })).map((p) => ({
            productId: str(p.productId),
            productName: str(p.productName, 'Unknown item'),
            warehouseId: str(p.warehouseId),
            quantity: num(p.quantity),
            myHolding: num(p.myHolding),
        })),
};

function station(json: Json): StationOption {
    // Accepts numbers or numeric strings; treats 0 and junk as "no location".
    const coord = (value: unknown): number | null => {
        const parsed = typeof value === 'number' ? value : parseFloat(str(value));
        return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
    };
    return {
        id: str(json.id),
        name: str(json.name),
        latitude: coord(json.latitude ?? json.lat),
        longitude: coord(json.longitude ?? json.lng ?? json.lon),
    };
}

export const stations = {
    mine: async (): Promise<StationOption[]> => listOf<Json>(await api.get('/stations/mine')).map(station),

    /** Any station by name, not limited to the ones the current user supervises. */
    search: async (query: string, signal?: AbortSignal): Promise<StationOption[]> =>
        listOf<Json>(await api.get('/stations/search', { search: query }, { signal })).map(station),
};

// ==================== Inventory requests ====================

export const inventoryRequests = {
    /** A unique, human-readable request id the app owns; the Inventory System links its ticket numbers back to it. */
    generateRequestId: (): string => `OPS-REQ-${Date.now()}`,

    submit: (input: {
        requestId: string;
        department?: string | null;
        station?: string | null;
        reason: string;
        items: { productId: string; quantity: number }[];
    }): Promise<{ requestId: string; inventoryTickets: string[] }> =>
        api.post('/inventory-requests', {
            request_id: input.requestId,
            department: input.department || null,
            station: input.station || null,
            reason: input.reason,
            items: input.items.map((item) => ({ product_id: idValue(item.productId), quantity: item.quantity })),
        }),

    mine: async (): Promise<InventoryRequest[]> =>
        listOf<Json>(await api.get('/inventory-requests/mine')).map((r) => ({
            requestId: str(r.requestId),
            department: strOrNull(r.department),
            station: strOrNull(r.station),
            reason: strOrNull(r.reason),
            submittedAt: strOrNull(r.submittedAt),
            items: Array.isArray(r.items) ? (r.items as InventoryRequest['items']) : [],
            collectionCodes: Array.isArray(r.collectionCodes) ? (r.collectionCodes as InventoryRequest['collectionCodes']) : [],
        })),

    /** The requester confirms they physically received an ISSUED item. */
    confirmReceived: (ticketNumber: string): Promise<unknown> =>
        api.post(`/inventory-requests/${encodeURIComponent(ticketNumber)}/confirm-received`),

    // Cluster Leader only: fulfilling the stock requests raised by technicians in their cluster.

    pendingApprovals: async (): Promise<ClusterInventoryRequest[]> =>
        listOf<ClusterInventoryRequest>(await api.get('/inventory-requests/pending-approvals')),

    approve: (ticketNumber: string, quantityApproved: number, approvalNote?: string | null): Promise<ClusterInventoryRequest> =>
        api.post(`/inventory-requests/${encodeURIComponent(ticketNumber)}/approve`, {
            quantity_approved: quantityApproved,
            approval_note: approvalNote || null,
        }),

    reject: (ticketNumber: string, approvalNote: string): Promise<ClusterInventoryRequest> =>
        api.post(`/inventory-requests/${encodeURIComponent(ticketNumber)}/reject`, { approval_note: approvalNote }),

    issue: (ticketNumber: string): Promise<ClusterInventoryRequest> => api.post(`/inventory-requests/${encodeURIComponent(ticketNumber)}/issue`),
};

// ==================== Mini store & own stock ====================

export const miniStore = {
    myItems: async (): Promise<MiniStoreItem[]> => listOf<MiniStoreItem>(await api.get('/mini-store/items')),

    /** Cluster Leader only: everything held in the cluster, by technician. */
    cluster: async (): Promise<ClusterMiniStoreEntry[]> => listOf<ClusterMiniStoreEntry>(await api.get('/mini-store/cluster')),

    submitRestock: (input: { productId: string; quantity: number; note?: string | null }): Promise<RestockRequest> =>
        api.post('/mini-store/restock', {
            product_id: idValue(input.productId),
            requested_quantity: input.quantity,
            note: input.note || null,
        }),

    myRestocks: async (): Promise<RestockRequest[]> => listOf<RestockRequest>(await api.get('/mini-store/restock/mine')),

    /** Cluster Leader only: technicians' restock requests awaiting a decision. */
    pendingRestockApprovals: async (): Promise<PendingRestockApproval[]> =>
        listOf<PendingRestockApproval>(await api.get('/mini-store/restock/pending-approvals')),

    approveRestock: (id: string): Promise<RestockRequest> => api.post(`/mini-store/restock/${encodeURIComponent(id)}/approve`),

    rejectRestock: (id: string, clusterDecisionNote: string): Promise<RestockRequest> =>
        api.post(`/mini-store/restock/${encodeURIComponent(id)}/reject`, { cluster_decision_note: clusterDecisionNote }),

    receiveRestock: (id: string, receivedQuantity: number, transitVarianceNote?: string | null): Promise<RestockRequest> =>
        api.post(`/mini-store/restock/${encodeURIComponent(id)}/receive`, {
            received_quantity: receivedQuantity,
            transit_variance_note: transitVarianceNote || null,
        }),
};

function myStockItem(json: Json): MyStockItem {
    return {
        productId: str(json.productId),
        productName: str(json.productName, 'Unknown item'),
        productCode: strOrNull(json.productCode),
        unit: strOrNull(json.unit),
        quantity: num(json.quantity),
    };
}

/**
 * The stock line a job-card item draws from: its mini-store line, or the product in
 * the technician's own stock. Null for items that draw no stock.
 */
export function stockLineKey(source?: string | null, miniStoreItemId?: string | null, productId?: string | null): string | null {
    if (source === 'mini_store' && miniStoreItemId) return miniStoreItemId;
    if (source === 'my_stock' && productId) return `p:${productId}`;
    return null;
}

export const myStock = {
    get: async (): Promise<MyStock> => {
        const response = await api.get<Json>('/my-stock');
        return { live: response.live === true, items: listOf<Json>(response).map(myStockItem) };
    },

    /**
     * Where a job card's items come from right now: the technician's own stock once it
     * is live (keyed by productId), otherwise the cluster mini store (keyed by
     * miniStoreItemId). An ERP without the endpoint is treated as not live.
     */
    forJobCard: async (): Promise<JobCardStock> => {
        let response: Json | null = null;
        try {
            response = await api.get<Json>('/my-stock');
        } catch (error) {
            if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) throw error;
        }
        if (response?.live === true) {
            return {
                source: 'my_stock',
                items: listOf<Json>(response)
                    .map(myStockItem)
                    .map((item) => ({ miniStoreItemId: '', productId: item.productId, productName: item.productName, quantity: item.quantity })),
            };
        }
        return { source: 'mini_store', items: await miniStore.myItems() };
    },

    /** Records usage outside a job card. The ERP refuses more than the technician holds. */
    recordConsumption: (input: {
        productId: string;
        quantity: number;
        consumedOn: Date;
        ticketNumber?: string | null;
        note?: string | null;
    }): Promise<unknown> =>
        api.post('/my-stock/consumptions', {
            product_id: idValue(input.productId),
            quantity: input.quantity,
            consumed_on: day(input.consumedOn),
            ticket_number: input.ticketNumber?.trim() || null,
            note: input.note?.trim() || null,
        }),
};

// ==================== CCTV requisitions ====================

export const requisitions = {
    /** The ERP's next official requisition number, or null if it can't be reached. */
    nextNumber: async (): Promise<string | null> => {
        try {
            const response = await api.get<unknown>('/cctv-requisitions/next-number');
            const value = response && typeof response === 'object' ? (response as Json).reqNo : response;
            return value ? String(value) : null;
        } catch {
            return null;
        }
    },

    submit: (submission: CctvRequisitionSubmission): Promise<CctvRequisition> => api.post<CctvRequisition>('/cctv-requisitions', submission),

    mine: async (): Promise<CctvRequisition[]> => listOf<CctvRequisition>(await api.get('/cctv-requisitions/my')),

    get: (id: string): Promise<CctvRequisition> => api.get<CctvRequisition>(`/cctv-requisitions/${encodeURIComponent(id)}`),
};

// ==================== Compliance ====================

export const compliance = {
    /** Resolves to the new ticket number. */
    submitRequest: async (input: {
        customerId: string;
        requestClass: string;
        itemName: string;
        requestedQuantity: number;
        priority: string;
        description?: string | null;
    }): Promise<string> => {
        const response = await api.post<Json>('/compliance/requests', {
            customer_id: input.customerId,
            request_class: input.requestClass,
            item_name: input.itemName,
            requested_quantity: input.requestedQuantity,
            priority: input.priority,
            description: input.description || null,
        });
        return str(response.ticketNumber);
    },

    myRequests: async (): Promise<ComplianceRequestSummary[]> => listOf<ComplianceRequestSummary>(await api.get('/compliance/requests/mine')),

    certificates: async (): Promise<ComplianceCertificateSummary[]> =>
        listOf<ComplianceCertificateSummary>(await api.get('/compliance/certificates')),
};

// ==================== Projects ====================

function project(json: Json): Project {
    const leader = json.teamLeader ?? json.team_leader;
    const leaderMap = leader && typeof leader === 'object' ? (leader as Json) : null;
    const isTeamLeader = json.isTeamLeader ?? json.is_team_leader;
    return {
        id: str(json.id),
        name: str(json.name),
        site: str(json.site),
        team: Array.isArray(json.team) ? json.team.map(String) : [],
        teamLeaderId: strOrNull(json.teamLeaderId ?? json.team_leader_id ?? leaderMap?.userId ?? leaderMap?.id),
        teamLeaderName: strOrNull(
            json.teamLeaderName ??
                json.team_leader_name ??
                leaderMap?.fullName ??
                leaderMap?.name ??
                (typeof leader === 'string' ? leader : null),
        ),
        isTeamLeader: typeof isTeamLeader === 'boolean' ? isTeamLeader : null,
        completionPercent: num(json.completionPercent),
        status: str(json.status, 'pending'),
        modeOfTransport: strOrNull(json.modeOfTransport),
        lastWorkSummary: strOrNull(json.lastWorkSummary),
        lastUpdate: strOrNull(json.lastUpdate),
    };
}

export interface DailyUpdateInput {
    updateDate: Date;
    completionPercentage: number;
    workSummary: string;
    /** The crew who worked that day, each with their mode of transport. */
    technicians?: DailyUpdateCrewInput[];
    photos?: File[];
}

/** Daily-update fields; `technicians` is a JSON string so the shape is the same with or without attachments. */
function dailyUpdateFields(input: DailyUpdateInput) {
    return {
        update_date: input.updateDate.toISOString(),
        completion_percentage: input.completionPercentage,
        work_summary: input.workSummary,
        technicians: JSON.stringify(input.technicians ?? []),
    };
}

export const projects = {
    mine: async (): Promise<Project[]> => listOf<Json>(await api.get('/projects/mine')).map(project),

    /** Posts a daily update; photos and the report document go up in the same request. */
    submitUpdate: async (projectId: string, input: DailyUpdateInput & { report?: File | null }): Promise<Project> => {
        const fields = dailyUpdateFields(input);
        const photos = input.photos ?? [];
        const path = `/projects/${encodeURIComponent(projectId)}/updates`;
        const response =
            photos.length === 0 && !input.report
                ? await api.post(path, fields)
                : await api.post(path, formData({ ...fields, photos: photos.length > 0 ? photos : null, report: input.report ?? null }));
        return project(recordOf<Json>(response));
    },
};

/** Whether the given user may post daily updates on this project: the ERP's flag, else the team leader by id, then name. */
export function isProjectLedBy(p: Project, user: Pick<User, 'userId' | 'fullName'>): boolean {
    if (p.isTeamLeader !== null) return p.isTeamLeader;
    if (p.teamLeaderId) return p.teamLeaderId === user.userId;
    const leaderName = p.teamLeaderName?.trim().toLowerCase();
    return !!leaderName && leaderName === user.fullName.trim().toLowerCase();
}

/** A completed project is closed: no more daily updates can be posted. */
export function isProjectClosed(p: Project): boolean {
    return p.status.trim().toLowerCase() === 'completed' || p.completionPercent >= 100;
}

// ==================== Special assignments ====================

function specialAssignment(json: Json): SpecialAssignment {
    const primary = json.primaryTechnician ?? json.primary_technician;
    const primaryMap = primary && typeof primary === 'object' ? (primary as Json) : null;
    const additional = json.additionalTechnicians ?? json.additional_technicians;
    const isPrimary = json.isPrimaryTechnician ?? json.is_primary_technician;
    return {
        id: str(json.id),
        location: str(json.location),
        assignedTo: str(
            primaryMap?.fullName ?? primaryMap?.name ?? (typeof primary === 'string' ? primary : null) ?? json.primaryTechnicianName ?? json.assignedTo,
        ),
        assignedToUserId: strOrNull(
            primaryMap?.userId ??
                primaryMap?.id ??
                json.primaryTechnicianId ??
                json.primary_technician_id ??
                json.assignedToUserId ??
                json.assigned_to_user_id,
        ),
        isPrimaryTechnician: typeof isPrimary === 'boolean' ? isPrimary : null,
        additionalTechnicians: (Array.isArray(additional) ? additional : [])
            .map((t) => str(t && typeof t === 'object' ? ((t as Json).fullName ?? (t as Json).name) : t))
            .filter((name) => name.trim() !== ''),
        transportMode: str(json.transportMode),
        briefDescription: str(json.briefDescription),
        completionPercent: num(json.completionPercent),
        lastWorkSummary: strOrNull(json.lastWorkSummary),
        lastUpdate: strOrNull(json.lastUpdate),
        status: str(json.status, 'assigned'),
        workStatus: str(json.workStatus, 'Assigned'),
        setOffAt: strOrNull(json.setOffAt),
        closedAt: strOrNull(json.closedAt),
        signedOffAt: strOrNull(json.signedOffAt),
    };
}

export const specialAssignments = {
    mine: async (): Promise<SpecialAssignment[]> => listOf<Json>(await api.get('/special-assignments/mine')).map(specialAssignment),

    /** Cluster Leader only: every assignment belonging to a technician in a cluster the caller leads. */
    cluster: async (): Promise<SpecialAssignment[]> => listOf<Json>(await api.get('/special-assignments/cluster')).map(specialAssignment),

    submitUpdate: async (assignmentId: string, input: DailyUpdateInput): Promise<SpecialAssignment> => {
        const fields = dailyUpdateFields(input);
        const photos = input.photos ?? [];
        const path = `/special-assignments/${encodeURIComponent(assignmentId)}/updates`;
        const response = photos.length === 0 ? await api.post<Json>(path, fields) : await api.post<Json>(path, formData({ ...fields, photos }));
        return specialAssignment(response);
    },

    setOff: async (assignmentId: string): Promise<SpecialAssignment> =>
        specialAssignment(await api.post<Json>(`/special-assignments/${encodeURIComponent(assignmentId)}/set-off`)),

    close: async (assignmentId: string, description?: string | null): Promise<SpecialAssignment> =>
        specialAssignment(
            await api.post<Json>(`/special-assignments/${encodeURIComponent(assignmentId)}/close`, { description: description || null }),
        ),

    /** Cluster Leader only: technicians in the clusters the caller leads. */
    eligibleTechnicians: async (): Promise<EligibleTechnician[]> =>
        listOf<Json>(await api.get('/special-assignments/eligible-technicians')).map((t) => ({
            userId: str(t.userId),
            fullName: str(t.fullName),
        })),

    /** Cluster Leader only. The first technician is the Primary Technician. */
    create: async (input: {
        location: string;
        description: string;
        technicianUserIds: string[];
        transportMode?: string | null;
        expectedCompletionDate?: Date | null;
    }): Promise<SpecialAssignment> =>
        specialAssignment(
            await api.post<Json>('/special-assignments', {
                location: input.location,
                description: input.description,
                assigned_to_user_id: idValue(input.technicianUserIds[0]),
                technician_user_ids: input.technicianUserIds.map(idValue),
                transport_mode: input.transportMode || null,
                expected_completion_date: input.expectedCompletionDate ? input.expectedCompletionDate.toISOString() : null,
            }),
        ),
};

/** Whether the user is the assignment's Primary Technician, the only one who may log daily updates. */
export function isPrimaryTechnicianFor(a: SpecialAssignment, user: Pick<User, 'userId' | 'fullName'>): boolean {
    if (a.isPrimaryTechnician !== null) return a.isPrimaryTechnician;
    if (a.assignedToUserId) return a.assignedToUserId === user.userId;
    return a.assignedTo.trim().toLowerCase() === user.fullName.trim().toLowerCase();
}

/** Closed once the Cluster Engineer signs it off in the ERP; reaching 100% or being marked closed does not close it. */
export function isSpecialAssignmentClosed(a: SpecialAssignment): boolean {
    return a.status.trim().toLowerCase() === 'signed_off' || !!a.signedOffAt;
}

// ==================== Reports ====================

export const reports = {
    /** The caller's job cards submitted in the period (both ends optional), plus totals. */
    myJobCards: async (range: { from?: Date | null; to?: Date | null } = {}): Promise<{ summary: JobCardsOverview; jobCards: MyJobCardSummary[] }> => {
        const response = await api.get<Json>('/reports/my-job-cards', {
            from: range.from ? day(range.from) : null,
            to: range.to ? day(range.to) : null,
        });
        const jobCards = listOf<Json>(response).map((j) => ({
            ticketId: str(j.ticketId),
            stationName: strOrNull(j.stationName),
            workDescription: strOrNull(j.workDescription),
            status: str(j.status),
            stage: str(j.stage, 'in_progress'),
            canEdit: j.canEdit === true,
            itemsCount: num(j.itemsCount),
            resolvedAt: strOrNull(j.resolvedAt),
        }));
        const summary = response.summary && typeof response.summary === 'object' ? (response.summary as Json) : null;
        return {
            jobCards,
            summary: {
                total: summary ? num(summary.total) : jobCards.length,
                awaitingStation: num(summary?.awaitingStation),
                awaitingValidation: num(summary?.awaitingValidation),
                closed: num(summary?.closed),
                editable: num(summary?.editable),
                stations: num(summary?.stations),
                itemsUsed: Array.isArray(summary?.itemsUsed)
                    ? (summary.itemsUsed as Json[]).map(
                          (i): JobCardItemTotal => ({ name: str(i.name, 'Unknown item'), quantity: num(i.quantity), jobCards: num(i.jobCards) }),
                      )
                    : [],
            },
        };
    },

    itemsConsumed: async (): Promise<ConsumedItem[]> => listOf<ConsumedItem>(await api.get('/reports/items-consumed')),

    dailyActivity: async (date?: Date | null): Promise<ActivityEntry[]> =>
        listOf<ActivityEntry>(await api.get('/reports/daily-activity', { date: date ? day(date) : null })),
};

// ==================== Profile ====================

export const profile = {
    /**
     * Updates the signed-in user's profile; send only the fields that changed. The
     * session's copy of the user is refreshed by the gateway, so follow with
     * `router.reload({ only: ['auth'] })` to pick it up.
     */
    update: (changes: { full_name?: string; phone?: string; email?: string; profile_pic_url?: string }): Promise<{ user: Json }> =>
        api.patch('/users/profile', changes),

    /** Uploads a profile picture. Resolves to its URL, to pass to `update` as `profile_pic_url`. */
    uploadPicture: async (picture: File): Promise<string> =>
        str((await api.post<Json>('/users/profile/picture', formData({ profile_pic: picture }))).url),
};
