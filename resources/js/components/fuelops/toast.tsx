import { cn } from '@/lib/utils';
import { CheckCircle2, Info, X, XCircle } from '@/components/icons';
import { useSyncExternalStore } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

// Kept outside React so a toast raised just before navigating to another page still shows there.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
    items = items.filter((item) => item.id !== id);
    emit();
}

function show(kind: ToastKind, message: string) {
    const id = nextId++;
    items = [...items, { id, kind, message }];
    emit();
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
}

/** Brief feedback after an action: `toast.success('Ticket accepted')`. */
export const toast = {
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    info: (message: string) => show('info', message),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

const STYLES: Record<ToastKind, string> = {
    success: 'border-green-600/30 text-green-700 dark:text-green-400',
    error: 'border-red-600/30 text-red-700 dark:text-red-400',
    info: 'border-blue-600/30 text-blue-700 dark:text-blue-400',
};

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Renders the toasts; mounted once by the app layout. */
export function Toaster() {
    const current = useSyncExternalStore(subscribe, () => items);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-[100] lg:bottom-4 flex flex-col items-center gap-2 px-4" aria-live="polite">
            {current.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                    <div
                        key={item.id}
                        role={item.kind === 'error' ? 'alert' : 'status'}
                        className={cn(
                            'bg-background pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border p-3 text-sm shadow-lg',
                            STYLES[item.kind],
                        )}
                    >
                        <Icon className="mt-0.5 size-4 shrink-0" />
                        <p className="text-foreground flex-1 whitespace-pre-line">{item.message}</p>
                        <button
                            type="button"
                            onClick={() => dismiss(item.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Dismiss"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
