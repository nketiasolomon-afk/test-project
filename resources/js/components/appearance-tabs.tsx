import { Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { IconType, MdCheck, MdDarkMode, MdLightMode, Monitor } from '@/components/icons';
import { HTMLAttributes } from 'react';

/**
 * The theme picker, styled after the phone's Settings sheet "Dark Mode" row: a soft grey icon
 * tile holding a brand-blue icon, a 15px title and a 12px grey subtitle. The web keeps a third
 * "System" option, so the rows act as a radio group rather than a single switch. Rows stack on
 * phones and sit side by side from `sm` up.
 */
export default function AppearanceToggleTab({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const tabs: { value: Appearance; icon: IconType; label: string; description: string }[] = [
        { value: 'light', icon: MdLightMode, label: 'Light', description: 'Bright theme for daytime' },
        { value: 'dark', icon: MdDarkMode, label: 'Dark', description: 'Easier on the eyes at night' },
        { value: 'system', icon: Monitor, label: 'System', description: 'Follow your device setting' },
    ];

    return (
        <div role="radiogroup" aria-label="Theme" className={cn('grid gap-2.5 sm:grid-cols-3 sm:gap-3', className)} {...props}>
            {tabs.map(({ value, icon: Icon, label, description }) => {
                const selected = appearance === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden sm:flex-col sm:items-start sm:gap-3 sm:p-4',
                            selected
                                ? 'border-primary bg-primary/[0.04] shadow-[0_6px_16px_rgb(33_120_189/0.12)] dark:bg-primary/10'
                                : 'border-border hover:bg-accent',
                        )}
                    >
                        <span className="flex w-full items-center gap-3 sm:justify-between">
                            <span
                                className={cn(
                                    'text-primary flex size-10 shrink-0 items-center justify-center rounded-xl dark:text-[#6fb3e8]',
                                    selected ? 'bg-primary/12 dark:bg-primary/20' : 'bg-muted',
                                )}
                            >
                                <Icon className="size-[22px]" />
                            </span>
                            <span className="min-w-0 flex-1 sm:hidden">
                                <span className="block text-[15px] font-semibold">{label}</span>
                                <span className="text-muted-foreground block text-xs">{description}</span>
                            </span>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                    selected ? 'border-primary bg-primary text-white' : 'border-muted-foreground/35',
                                )}
                            >
                                {selected && <MdCheck className="size-3.5" />}
                            </span>
                        </span>
                        <span className="hidden min-w-0 sm:block">
                            <span className="block text-[15px] font-semibold">{label}</span>
                            <span className="text-muted-foreground block text-xs">{description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
