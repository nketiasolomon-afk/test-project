import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** A labelled form control with optional hint and error text. */
export function Field({
    label,
    htmlFor,
    error,
    hint,
    required,
    className,
    children,
}: {
    label: string;
    htmlFor?: string;
    error?: string | null;
    hint?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('grid gap-1.5', className)}>
            <Label htmlFor={htmlFor}>
                {label}
                {required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
            {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}
