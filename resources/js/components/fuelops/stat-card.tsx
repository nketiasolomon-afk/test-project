import { type IconType } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * A headline number with a label, optionally clickable: a white card with a tinted
 * icon tile, like the phone's stat cards.
 */
export function StatCard({
    label,
    value,
    icon: Icon,
    accent = 'text-primary',
    onClick,
    active = false,
    className,
}: {
    label: string;
    value?: React.ReactNode;
    icon?: IconType;
    /** A text colour class for the icon tile, e.g. 'text-green-600'. */
    accent?: string;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}) {
    const Component = onClick ? 'button' : 'div';
    return (
        <Component
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            aria-pressed={onClick ? active : undefined}
            className={cn(
                'bg-card shadow-card flex items-center gap-3 rounded-[14px] border p-3 text-left sm:p-4',
                onClick && 'hover:border-primary/40 transition-colors',
                active && 'border-primary ring-primary/30 ring-2',
                className,
            )}
        >
            {Icon && (
                <span className={cn('relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl', accent)}>
                    <span className="absolute inset-0 bg-current opacity-12" aria-hidden="true" />
                    <Icon className="relative size-5" />
                </span>
            )}
            <span className="min-w-0">
                {value !== undefined && <span className="text-foreground block text-xl leading-tight font-bold">{value}</span>}
                <span className="text-muted-foreground block truncate text-xs font-medium">{label}</span>
            </span>
        </Component>
    );
}
