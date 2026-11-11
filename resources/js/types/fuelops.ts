/**
 * Shapes of the FuelOps ERP API responses, as the pages use them.
 *
 * Dates are ISO 8601 strings. Ids are strings (lib/fuelops-api.ts normalises
 * the ones the ERP may send as numbers).
 */

// ==================== Tickets & job cards ====================

export interface TicketPerson {
    userId: string;
    fullName: string;
    phone?: string | null;
}

/** Why the last technician declined (shown on the leader's queue card). */
export interface TicketDecline {
    technicianId: string;
    technicianName: string;
    reasonCode?: string | null;
    reason?: string | null;
    note?: string | null;
    declinedAt?: string | null;
}

export type DispatchState =
    | 'NEW'
    | 'ASSIGNED'
    | 'DECLINED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'JOB_CARD_SUBMITTED'
    | 'CLOSED'
    | 'REOPENED'
    | 'CANCELLED';

export interface Ticket {
    ticketId: string;
    stationId: string;
    stationName: string;
    clusterId: string;
    clusterName: string;
    issueType: string;
    description: string;
    /** Collapsed status for colour/label: 'assigned' | 'done' | 'confirmed' | 'rejected' | other. */
    status: string;
    /** The precise ERP workflow status, e.g. 'Pending Station Validation'. */
    rawStatus?: string | null;
    /** The current user's own acceptance timestamp on this ticket. */
    acceptedAt?: string | null;
    canAccept: boolean;
    canStationValidate: boolean;
    canValidate: boolean;
    reportedDate?: string | null;
    reportedAt?: string | null;
    reportedBy: string;
    assignedTechId: string;
    submittedAt?: string | null;
    jobCard?: JobCard | null;
    /** Set when status is 'rejected': the Station Leader's reason. */
    rejectionReason?: string | null;
    priority?: string | null;
    /** Origin the API tags the ticket with, e.g. 'fms_cctv'. */
    source?: string | null;
    /** Null for tickets outside the dispatch flow. */
    dispatchState?: DispatchState | string | null;
    isDispatchManaged: boolean;
    /** The caller is this ticket's single active assignee. */
    isMine: boolean;
    assignee?: TicketPerson | null;
    assignedBy?: TicketPerson | null;
    assignedAt?: string | null;
    startedAt?: string | null;
    jobCardSubmittedAt?: string | null;
    isOverrideAssignment: boolean;
    overrideReason?: string | null;
    overrideNote?: string | null;
    responseOverdue: boolean;
    lastDecline?: TicketDecline | null;
    canDecline: boolean;
    canStart: boolean;
    canSubmitJobCard: boolean;
    canAssign: boolean;
    canCancel: boolean;
    canReopen: boolean;
}

export type JobItemSource = 'mini_store' | 'my_stock' | 'warehouse' | 'station';

export interface JobItem {
    itemId: string;
    jobCardId: string;
    itemName: string;
    quantity: number;
    unit: string;
    partNumber?: string | null;
    source: JobItemSource | string;
    miniStoreItemId?: string | null;
    productId?: string | null;
}

/** A material line as submitted on a job card (same keys the ERP expects). */
export interface JobItemInput {
    itemName: string;
    quantity: number;
    unit: string;
    partNumber?: string | null;
    source: JobItemSource | string;
    miniStoreItemId?: string | null;
    productId?: string | null;
    warehouseId?: string | null;
}

export interface JobCardTechnician {
    userId: string;
    fullName: string;
    transportMode?: string | null;
    isPrimary: boolean;
}

export interface JobCard {
    jobCardId: string;
    ticketId: string;
    technicianId: string;
    workDescription: string;
    submittedAt?: string | null;
    items: JobItem[];
    photoUrls: string[];
    technicians: JobCardTechnician[];
    /** True while the submitter can still edit it (the station leader hasn't approved it). */
    canEdit: boolean;
    stage?: 'awaiting_station' | 'awaiting_validation' | 'closed' | 'in_progress' | string | null;
}

export interface CrewOption {
    userId: string;
    fullName: string;
    role?: string | null;
    clusterName?: string | null;
}

export interface CrewOptions {
    technicians: CrewOption[];
    transportModes: string[];
}

/** A crew member on a job card submission. */
export interface JobCardCrewInput {
    user_id: string | number;
    transport_mode: string | null;
}

export interface ClusterJobCardSummary {
    ticketId: string;
    stationName?: string | null;
    technicianName?: string | null;
    workDescription?: string | null;
    status: string;
    resolvedAt?: string | null;
}

// ==================== Dispatch ====================

export interface BusyTicket {
    ticketId: string;
    stationName?: string | null;
    state?: string | null;
    priority?: string | null;
    since?: string | null;
    minutesOnIt?: number | null;
    isOverride: boolean;
}

export type AvailabilityStatus = 'available' | 'busy' | 'off_duty';

export interface TechnicianAvailability {
    userId: string;
    fullName: string;
    phone?: string | null;
    role?: string | null;
    clusterName?: string | null;
    status: AvailabilityStatus | string;
    dutyStatus: 'on_duty' | 'off_duty' | string;
    busyWith: BusyTicket[];
    openTicketCount: number;
    pendingResponseCount: number;
}

export interface MyDispatchStatus extends Omit<TechnicianAvailability, 'userId' | 'fullName'> {
    isFieldStaff: boolean;
}

export interface DispatchReason {
    code: string;
    label: string;
    requiresNote: boolean;
}

export interface DispatchReasons {
    override: DispatchReason[];
    decline: DispatchReason[];
}

export interface TicketEvent {
    id: string;
    type: string;
    fromState?: string | null;
    toState?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
    technicianName?: string | null;
    reason?: string | null;
    note?: string | null;
    createdAt?: string | null;
}

export interface AppNotification {
    id: string;
    type?: string | null;
    title: string;
    message: string;
    ticketId?: string | null;
    isOverride: boolean;
    readAt?: string | null;
    createdAt?: string | null;
    /** Extra structured fields the backend attaches (e.g. requestId, collectionCode). */
    data: Record<string, unknown>;
}

export interface LeaderCover {
    id: string;
    userId: string;
    fullName: string;
    startsAt: string;
    endsAt: string;
    reason?: string | null;
    createdBy?: string | null;
    isActive: boolean;
}

export interface CoverCandidate {
    userId: string;
    fullName: string;
    role: string;
}

export interface ClusterCovers {
    clusterId: string;
    clusterCode: string;
    clusterName: string;
    covers: LeaderCover[];
    candidates: CoverCandidate[];
}

// ==================== Dashboards ====================

export interface HomeActivity {
    type: string;
    title: string;
    subtitle: string;
    occurredAt?: string | null;
}

export interface HomeOverview {
    activeIssues: number;
    pendingIssues: number;
    completedIssues: number;
    recentActivity: HomeActivity[];
}

export interface TicketSummary {
    ticketId: string;
    stationName: string;
    issueType: string;
    rawStatus: string;
    dispatchState?: string | null;
    assigneeName?: string | null;
    canAssign: boolean;
    isOverrideAssignment: boolean;
}

export interface AssetServicingDue {
    id: string;
    stationName?: string | null;
    assetClass?: string | null;
    assetName?: string | null;
    runHours?: number | null;
    hoursSinceLastService?: number | null;
}

export interface ClusterOverview {
    ticketCountsByStatus: Record<string, number>;
    outstandingTickets: TicketSummary[];
    assetsServicingDue: AssetServicingDue[];
}

export interface OperationsManagerOverview {
    totalOutstanding: number;
    nozzlesNotWorking: number;
    gensetsNotWorking: number;
    signagesNotWorking: number;
    escalatedTickets: number;
}

export interface TechnicianStats {
    technicianId: string;
    fullName: string;
    role: string;
    distanceCoveredKm: number;
    issuesResolved: number;
    partsConsumed: number;
}

// ==================== Stock ====================

export interface WarehouseProduct {
    productId: string;
    productName: string;
    warehouseId: string;
    quantity: number;
    /** The requester's own current stock of this item. */
    myHolding: number;
}

export interface StationOption {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
}

export interface MiniStoreItem {
    miniStoreItemId: string;
    productId: string;
    productName: string;
    quantity: number;
}

export interface ClusterMiniStoreEntry {
    technicianId: string;
    technicianName: string;
    items: MiniStoreItem[];
}

export interface RestockRequest {
    id: string;
    productName: string;
    requestedQuantity: number;
    approvedQuantity?: number | null;
    issuedQuantity?: number | null;
    receivedQuantity?: number | null;
    status: string;
    note?: string | null;
    clusterDecisionNote?: string | null;
    submittedAt?: string | null;
}

export interface PendingRestockApproval extends RestockRequest {
    technicianId: string;
    technicianName: string;
}

export interface MyStockItem {
    productId: string;
    productName: string;
    productCode?: string | null;
    unit?: string | null;
    quantity: number;
}

export interface MyStock {
    /** Whether job cards draw from the technician's own stock yet. */
    live: boolean;
    items: MyStockItem[];
}

/** The stock a job card can draw from right now. */
export interface JobCardStock {
    source: 'my_stock' | 'mini_store';
    items: MiniStoreItem[];
}

export interface InventoryRequestItem {
    ticketNumber: string;
    itemName: string;
    quantity: string;
    quantityApproved?: number | null;
    status: string;
    collectionCode?: string | null;
}

export interface CollectionCode {
    code: string;
    /** ISSUED (ready to collect) or COLLECTED. */
    status: string;
}

export interface InventoryRequest {
    requestId: string;
    department?: string | null;
    station?: string | null;
    reason?: string | null;
    submittedAt?: string | null;
    items: InventoryRequestItem[];
    collectionCodes: CollectionCode[];
}

export interface ClusterInventoryRequest {
    ticketNumber: string;
    itemName: string;
    quantityRequested: number;
    quantityApproved?: number | null;
    status: string;
    requesterName: string;
    reason?: string | null;
    approvalNote?: string | null;
    submittedAt?: string | null;
    collectionCode?: string | null;
    collectionStatus?: string | null;
}

// ==================== CCTV requisitions ====================

export interface CctvRequisitionItem {
    itemId?: string | null;
    rowNumber: number;
    station: string;
    itemName: string;
    specification: string;
    unit: string;
    qtyRequested: number;
    qtyApproved: number;
    qtyIssued: number;
    remarks: string;
}

export interface CctvRequisition {
    requisitionId?: string | null;
    reqNo: string;
    dateOfRequest: string;
    technicianName: string;
    requiredByDate: string;
    designation: string;
    priority: string;
    jobRef: string;
    notes: string;
    items: CctvRequisitionItem[];
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export type CctvRequisitionSubmission = Omit<CctvRequisition, 'requisitionId' | 'status' | 'createdAt' | 'updatedAt' | 'items'> & {
    items: Omit<CctvRequisitionItem, 'itemId'>[];
};

// ==================== Compliance ====================

export interface ComplianceRequestSummary {
    requestId: string;
    ticketNumber: string;
    requestClass: string;
    itemName: string;
    requestedQuantity: number;
    suppliedQuantity?: number | null;
    priority: string;
    status: string;
    description?: string | null;
}

export interface ComplianceCertificateSummary {
    id: string;
    documentType: string;
    expiryDate?: string | null;
    daysLeft: number;
    alertRule: string;
    status: string;
}

// ==================== Projects & special assignments ====================

export interface Project {
    id: string;
    name: string;
    site: string;
    team: string[];
    teamLeaderId: string | null;
    teamLeaderName: string | null;
    /** Server-computed "the caller is this project's team leader", when sent. */
    isTeamLeader: boolean | null;
    completionPercent: number;
    /** 'pending' | 'active' | 'completed' */
    status: string;
    modeOfTransport?: string | null;
    lastWorkSummary?: string | null;
    lastUpdate?: string | null;
}

export interface SpecialAssignment {
    id: string;
    location: string;
    /** The Primary Technician's name. */
    assignedTo: string;
    assignedToUserId: string | null;
    /** Server-computed "the caller is the primary technician", when sent. */
    isPrimaryTechnician: boolean | null;
    additionalTechnicians: string[];
    transportMode: string;
    briefDescription: string;
    completionPercent: number;
    lastWorkSummary?: string | null;
    lastUpdate?: string | null;
    /** 'assigned' | 'in_transit' | 'closed' | 'signed_off' */
    status: string;
    /** 'Assigned' | 'In Progress' | 'Done' */
    workStatus: string;
    setOffAt?: string | null;
    closedAt?: string | null;
    signedOffAt?: string | null;
}

export interface EligibleTechnician {
    userId: string;
    fullName: string;
}

/** A crew member on a project or special-assignment daily update. */
export interface DailyUpdateCrewInput {
    technician_id: string;
    transport_mode: string;
}

// ==================== Reports ====================

export interface MyJobCardSummary {
    ticketId: string;
    stationName?: string | null;
    workDescription?: string | null;
    status: string;
    stage: 'awaiting_station' | 'awaiting_validation' | 'closed' | 'in_progress' | string;
    canEdit: boolean;
    itemsCount: number;
    resolvedAt?: string | null;
}

export interface JobCardItemTotal {
    name: string;
    quantity: number;
    jobCards: number;
}

export interface JobCardsOverview {
    total: number;
    awaitingStation: number;
    awaitingValidation: number;
    closed: number;
    editable: number;
    stations: number;
    itemsUsed: JobCardItemTotal[];
}

export interface ConsumedItem {
    productName: string;
    quantity: number;
    ticketId?: string | null;
    consumedAt?: string | null;
}

export interface ActivityEntry {
    type: string;
    title: string;
    subtitle: string;
    occurredAt?: string | null;
}
