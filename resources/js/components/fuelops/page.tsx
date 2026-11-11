import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

/**
 * The frame every signed-in page renders inside: app shell, document title,
 * breadcrumbs, a heading row with optional actions, and a width-limited body.
 *
 *     <Page title="Assignment Queue" description="Assign new, declined & reopened tickets"
 *           back={{ href: route('dashboard'), label: 'Dashboard' }}
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
    children,
}: {
    title: string;
    description?: string;
    /** The page this one was opened from; shown as a breadcrumb and a back arrow. */
    back?: { href: string; label: string };
    actions?: React.ReactNode;
    /** 'narrow' suits forms, 'wide' suits tables. */
    width?: 'narrow' | 'default' | 'wide';
    children: React.ReactNode;
}) {
    const breadcrumbs: BreadcrumbItem[] = [...(back ? [{ title: back.label, href: back.href }] : []), { title, href: '#' }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />
            <div
                className={cn('mx-auto flex w-full flex-1 flex-col gap-6 p-4 md:p-6', {
                    'max-w-3xl': width === 'narrow',
                    'max-w-5xl': width === 'default',
                    'max-w-7xl': width === 'wide',
                })}
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        {back && (
                            <Link
                                href={back.href}
                                className="hover:bg-accent mt-0.5 rounded-md border p-1.5"
                                aria-label={`Back to ${back.label}`}
                                title={`Back to ${back.label}`}
                            >
                                <ArrowLeft className="size-4" />
                            </Link>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                            {description && <p className="text-muted-foreground text-sm">{description}</p>}
                        </div>
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
                {children}
            </div>
        </AppLayout>
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
        <section className={cn('space-y-3', className)}>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="border-l-4 border-[var(--brand-yellow)] pl-2 text-lg leading-tight font-semibold">{title}</h2>
                    {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children}
        </section>
    );
}
