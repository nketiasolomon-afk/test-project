import { ChevronRight, type IconType } from '@/components/icons';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Link } from '@inertiajs/react';

/**
 * A full-width Quick Access row from the phone's Home screen: tinted icon tile, bold
 * title, grey subtitle and a round chevron in the module's accent colour.
 */
export function ModuleTile({ title, subtitle, href, icon, accent }: { title: string; subtitle: string; href: string; icon: IconType; accent: string }) {
    return (
        <Link
            href={href}
            prefetch
            className="bg-card shadow-card group flex items-center gap-3.5 rounded-[18px] border p-3.5 transition-colors hover:border-[color:var(--tile-accent)]/40 focus-visible:ring-2 focus-visible:ring-[color:var(--tile-accent)] focus-visible:outline-none"
            style={{ '--tile-accent': accent } as React.CSSProperties}
        >
            <IconTile icon={icon} color={accent} size="lg" gradient className="dark:brightness-125" />
            <span className="min-w-0 flex-1">
                <span className="text-brand-ink block truncate text-[15.5px] font-bold tracking-[-0.1px] dark:text-white">{title}</span>
                <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-[12.5px] leading-snug">{subtitle}</span>
            </span>
            <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full dark:brightness-125" style={{ color: accent }}>
                <span className="absolute inset-0 bg-current/8 transition-opacity group-hover:bg-current/15 dark:bg-current/18" aria-hidden="true" />
                <ChevronRight className="relative size-5" />
            </span>
        </Link>
    );
}
