import { cn } from '@/lib/utils';

/**
 * The StarOil mark in a tile. `glass` sits on the blue header, as on the phone;
 * `solid` is a white tile for the desktop side menu.
 */
export function LogoBadge({ size = 40, variant = 'glass', className }: { size?: number; variant?: 'glass' | 'solid'; className?: string }) {
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center border',
                variant === 'glass' ? 'border-white/30 bg-white/18' : 'border-border bg-white shadow-[0_6px_16px_rgb(33_120_189/0.18)]',
                className,
            )}
            style={{ width: size, height: size, padding: size * 0.15, borderRadius: size * 0.3 }}
        >
            <img src="/images/star-logo.png" alt="StarOil" className="h-auto w-full object-contain" draggable={false} />
        </span>
    );
}
