import { type IconType } from '@/components/icons';
import { type Tone } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Badge colours, matching the phone's status badges (text in the colour on a 12% tint). */
export const TONE_COLORS: Record<Tone, string> = {
    blue: '#2196F3',
    indigo: '#4F46E5',
    amber: '#F59E0B',
    orange: '#FFA726',
    red: '#EF4444',
    green: '#43A047',
    emerald: '#059669',
    purple: '#6D28D9',
    teal: '#0F766E',
    slate: '#64748B',
};

const TONES: Record<Tone, string> = {
    blue: 'text-[#1976D2] dark:text-[#64B5F6]',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    amber: 'text-amber-700 dark:text-amber-300',
    orange: 'text-[#E65100] dark:text-[#FFB74D]',
    red: 'text-red-600 dark:text-red-400',
    green: 'text-[#2E7D32] dark:text-[#81C784]',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    purple: 'text-violet-700 dark:text-violet-300',
    teal: 'text-teal-700 dark:text-teal-300',
    slate: 'text-slate-600 dark:text-slate-300',
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
    icon?: IconType;
    className?: string;
    children: React.ReactNode;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] leading-none font-bold whitespace-nowrap', TONES[tone], className)}
            style={{ backgroundColor: `color-mix(in srgb, ${TONE_COLORS[tone]} 12%, transparent)` }}
        >
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {children}
        </span>
    );
}
