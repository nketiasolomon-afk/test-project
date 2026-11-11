import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';

/**
 * The frame every signed-in page renders inside. The title, description and back link
 * go into the blue header, as on the phone app; actions sit at the top of the content.
 *
 *     <Page title="Assignment Queue" description="Assign new, declined & reopened tickets"
 *           back={{ href: route('dashboard'), label: 'Home' }}
 *           actions={<Button onClick={reload}>Refresh</Button>}>
 *         ...
 *     </Page>
 */
export function Page({
    title,
    description,
    back,
    actions,
    width = 'default',
    brand = false,
    hideBell = false,
    documentTitle,
    children,
}: {
    title: string;
    /** Shown under the title in the header, like the phone's app bar subtitle. */
    description?: string;
    /** The page this one was opened from; shown as a back arrow in the header. */
    back?: { href: string; label: string };
    actions?: React.ReactNode;
    /** 'narrow' suits forms, 'wide' suits tables. */
    width?: 'narrow' | 'default' | 'wide';
    /** Draws the header title as the animated "Star Technician" mark. */
    brand?: boolean;
    hideBell?: boolean;
    /** The browser tab title, when it should differ from the header title. */
    documentTitle?: string;
    children: React.ReactNode;
}) {
    return (
        <AppLayout header={{ title, subtitle: description, back, brand, hideBell }}>
            <Head title={documentTitle ?? title} />
            <div
                className={cn('mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8', {
                    'max-w-3xl': width === 'narrow',
                    'max-w-5xl': width === 'default',
                    'max-w-7xl': width === 'wide',
                })}
            >
                {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
                {children}
            </div>
        </AppLayout>
    );
}

/** A section heading with the phone's yellow brand bar. */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
    return (
        <h2 className={cn('flex items-center gap-2.5 text-lg leading-tight font-bold tracking-[-0.2px]', className)}>
            <span className="bg-brand-yellow h-[18px] w-1 shrink-0 rounded-full" aria-hidden="true" />
            {title}
        </h2>
    );
}

/** A titled block within a page. */
export function Section({
    title,
    description,
    actions,
    className,
    children,
}: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section className={cn('space-y-4', className)}>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <SectionHeader title={title} />
                    {description && <p className="text-muted-foreground mt-1 pl-3.5 text-sm">{description}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children}
        </section>
    );
}
