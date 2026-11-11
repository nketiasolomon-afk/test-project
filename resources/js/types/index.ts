import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    auth: Auth;
    [key: string]: unknown;
}

/** The signed-in ERP user, as kept in the server-side session. */
export interface User {
    userId: string;
    fullName: string;
    username: string;
    /** The ERP staff role, e.g. 'Cluster Leader', 'Station Leader', 'Operations Admin'. */
    role: string;
    /** Cluster Leaders get the cluster-level modules; everyone else is a Technician. */
    isClusterLeader: boolean;
    /** Dispatch rights: Cluster Leaders, plus anyone with an active leader cover. */
    canDispatch: boolean;
    clusterId: string | null;
    stationId: string | null;
    phone: string | null;
    email: string | null;
    profilePicUrl: string | null;
}
