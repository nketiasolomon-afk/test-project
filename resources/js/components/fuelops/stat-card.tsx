import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

/** A headline number with a label, optionally clickable. */
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
    icon?: LucideIcon;
    /** A text colour class for the icon and value, e.g. 'text-green-600'. */
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
            className={cn(
                'bg-card flex items-center gap-3 rounded-xl border p-4 text-left shadow-xs',
                onClick && 'hover:bg-accent transition-colors',
                active && 'ring-primary ring-2',
                className,
            )}
        >
            {Icon && (
                <span className={cn('bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg', accent)}>
                    <Icon className="size-5" />
                </span>
            )}
            <span className="min-w-0">
                {value !== undefined && <span className={cn('block text-2xl leading-tight font-bold', accent)}>{value}</span>}
                <span className="text-muted-foreground block truncate text-xs font-medium">{label}</span>
            </span>
        </Component>
    );
}
