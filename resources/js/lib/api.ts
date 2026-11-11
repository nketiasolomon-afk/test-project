/**
 * Client for the FuelOps ERP API, reached through this application's gateway
 * (`/api/fuelops/*`). The gateway adds the signed-in user's ERP token on the
 * server, so nothing here handles credentials.
 */

const GATEWAY = '/api/fuelops';

type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
    query?: Record<string, QueryValue>;
    /** Sent as JSON, or as multipart when it is a FormData. */
    body?: object | FormData;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

/** A failed API call. `message` is always fit to show to the user. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly data: unknown = null,
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /** The ticket changed underneath the caller (another leader acted first): refresh rather than retry. */
    get isConflict(): boolean {
        return this.status === 409;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    /** Laravel validation errors by field, when the response carried them. */
    get fieldErrors(): Record<string, string[]> {
        const errors = isRecord(this.data) ? this.data.errors : null;
        return isRecord(errors) ? (errors as Record<string, string[]>) : {};
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

/** The first validation error when there is one, otherwise the response's message. */
function serverMessage(data: unknown): string | null {
    if (!isRecord(data)) return null;
    if (isRecord(data.errors)) {
        const first = Object.values(data.errors)[0];
        const text = Array.isArray(first) ? first[0] : first;
        if (typeof text === 'string' && text !== '') return text;
    }
    return typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : null;
}

function errorMessage(status: number, data: unknown): string {
    const message = serverMessage(data);
    switch (status) {
        case 401:
            return 'Your session has expired. Please sign in again.';
        case 403:
            return message ?? "You don't have permission to do this.";
        case 404:
            return message ?? 'This feature is not available on the server yet (HTTP 404).';
        case 419:
            return 'This page has been open too long. Please reload it and try again.';
        case 503:
            return message ?? 'Could not reach the server. Please check your connection and try again.';
        default:
            // Laravel's generic 500 body is just "Server Error" - not worth showing as-is.
            if (status >= 500) {
                return message && message !== 'Server Error'
                    ? message
                    : `The server ran into a problem (HTTP ${status}). Please try again later or contact support.`;
            }
            return message ?? `The request failed (HTTP ${status}). Please try again.`;
    }
}

async function request<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<T> {
    const url = new URL(GATEWAY + (path.startsWith('/') ? path : `/${path}`), window.location.origin);
    for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken(),
        ...options.headers,
    };

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
        body = options.body;
    } else if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
        response = await fetch(url, { method, headers, body, signal: options.signal, credentials: 'same-origin' });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError('Could not reach the server. Please check your connection and try again.', 0);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text !== '') {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (response.ok) return data as T;

    // The session ended (expired, or the user's role may no longer use the app): the
    // server has already signed out and left its reason for the login page.
    const code = isRecord(data) ? data.code : null;
    if (response.status === 401 || (response.status === 403 && code === 'app_role_not_allowed')) {
        window.location.assign('/login');
    }

    throw new ApiError(errorMessage(response.status, data), response.status, data);
}

export const api = {
    get: <T>(path: string, query?: Record<string, QueryValue>, options: Omit<ApiRequestOptions, 'query' | 'body'> = {}) =>
        request<T>('GET', path, { ...options, query }),
    post: <T>(path: string, body: object | FormData = {}, options: Omit<ApiRequestOptions, 'body'> = {}) =>
        request<T>('POST', path, { ...options, body }),
    patch: <T>(path: string, body: object = {}, options: Omit<ApiRequestOptions, 'body'> = {}) => request<T>('PATCH', path, { ...options, body }),
};

/**
 * Builds a multipart body. Null/undefined fields are left out; a `File[]` is
 * sent as an array field (`photos[]`), a single `File` under its own name.
 */
export function formData(fields: Record<string, string | number | boolean | null | undefined | File | File[]>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
            value.forEach((file) => form.append(`${name}[]`, file, file.name));
        } else if (value instanceof File) {
            form.append(name, value, value.name);
        } else {
            form.append(name, String(value));
        }
    }
    return form;
}

/** A message fit to show to the user for anything a page might catch. */
export function errorText(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error && error.message !== '') return error.message;
    return fallback;
}

/** Unwraps list responses, which the ERP sends either bare or as `{ data: [...] }`. */
export function listOf<T>(response: unknown): T[] {
    const data = isRecord(response) ? response.data : response;
    return Array.isArray(data) ? (data as T[]) : [];
}
