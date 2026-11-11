import { cn } from '@/lib/utils';

/** "Star Technician" in the Orbitron display face, with the phone's gold shimmer sweep. */
export function BrandTitle({ text = 'Star Technician', animate = true, className }: { text?: string; animate?: boolean; className?: string }) {
    return <span className={cn('font-brand inline-block font-bold whitespace-nowrap', animate ? 'brand-shimmer' : 'text-white', className)}>{text}</span>;
}
