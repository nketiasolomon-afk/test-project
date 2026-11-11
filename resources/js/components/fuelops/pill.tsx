import { type Tone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

const TONES: Record<Tone, string> = {
    blue: 'border-blue-600/30 bg-blue-600/10 text-blue-800 dark:text-blue-300',
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300',
    amber: 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300',
    orange: 'border-orange-500/35 bg-orange-500/10 text-orange-800 dark:text-orange-300',
    red: 'border-red-600/30 bg-red-600/10 text-red-800 dark:text-red-300',
    green: 'border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300',
    emerald: 'border-emerald-700/30 bg-emerald-700/10 text-emerald-800 dark:text-emerald-300',
    purple: 'border-violet-600/30 bg-violet-600/10 text-violet-800 dark:text-violet-300',
    teal: 'border-teal-600/30 bg-teal-600/10 text-teal-800 dark:text-teal-300',
    slate: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

/** A small coloured label for a status, priority or tag. */
export function Pill({
    tone = 'slate',
    icon: Icon,
    className,
    children,
    title,
}: {
    tone?: Tone;
    icon?: LucideIcon;
    className?: string;
    children: React.ReactNode;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                TONES[tone],
                className,
            )}
        >
            {Icon && <Icon className="size-3 shrink-0" />}
            {children}
        </span>
    );
}
