import { BrandTitle } from '@/components/brand/brand-title';
import { LogoBadge } from '@/components/brand/logo-badge';
import { ArrowLeft } from '@/components/icons';
import { NotificationBell } from '@/components/notification-bell';
import { Link } from '@inertiajs/react';

export interface HeaderProps {
    title: string;
    subtitle?: string;
    /** The page this one was opened from; shows a back arrow beside the logo. */
    back?: { href: string; label: string };
    /** Draws the title as the animated "Star Technician" brand mark, as on the phone's Home. */
    brand?: boolean;
    /** Hides the header bell, e.g. on Home where the welcome card carries it. */
    hideBell?: boolean;
}

/**
 * The blue page header from the phone app: logo badge (and back arrow) on the left,
 * the title and subtitle centred, the notification bell on the right.
 */
export function AppHeader({ title, subtitle, back, brand = false, hideBell = false }: HeaderProps) {
    return (
        <header className="bg-header text-header-foreground sticky top-0 z-30 pt-[env(safe-area-inset-top)] shadow-[0_2px_10px_rgb(0_0_0/0.08)]">
            <div className="relative flex min-h-[68px] items-center gap-2 px-3 sm:px-4 lg:min-h-[76px] lg:px-6">
                <div className="z-10 flex shrink-0 items-center gap-1">
                    {back && (
                        <Link
                            href={back.href}
                            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                            aria-label={`Back to ${back.label}`}
                            title={`Back to ${back.label}`}
                        >
                            <ArrowLeft className="size-6" />
                        </Link>
                    )}
                    <Link href="/dashboard" aria-label="Home" className="rounded-xl focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
                        <LogoBadge size={40} className="lg:hidden" />
                        <LogoBadge size={44} className="hidden lg:flex" />
                    </Link>
                </div>

                {/* Centred over the whole bar, like the phone's centred title, while staying clear of the side slots. */}
                <div className="pointer-events-none absolute inset-x-0 flex justify-center px-28 sm:px-32">
                    <div className="pointer-events-auto min-w-0 text-center">
                        <h1 className="truncate text-[15px] leading-tight font-bold tracking-[-0.2px] sm:text-[17px] lg:text-lg">
                            {brand ? <BrandTitle text={title} className="text-[17px] sm:text-[19px] lg:text-xl" /> : title}
                        </h1>
                        {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-white/72 sm:text-xs lg:text-[13px]">{subtitle}</p>}
                    </div>
                </div>

                <div className="z-10 ml-auto flex shrink-0 items-center">{!hideBell && <NotificationBell />}</div>
            </div>
        </header>
    );
}
