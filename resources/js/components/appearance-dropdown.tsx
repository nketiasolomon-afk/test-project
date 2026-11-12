import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { IconType, MdCheck, MdDarkMode, MdLightMode, Monitor } from '@/components/icons';
import { HTMLAttributes } from 'react';

const OPTIONS: { value: Appearance; icon: IconType; label: string }[] = [
    { value: 'light', icon: MdLightMode, label: 'Light' },
    { value: 'dark', icon: MdDarkMode, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
];

export default function AppearanceToggleDropdown({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const CurrentIcon = (OPTIONS.find((option) => option.value === appearance) ?? OPTIONS[2]).icon;

    return (
        <div className={className} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary size-9 rounded-xl dark:text-[#6fb3e8]">
                        <CurrentIcon className="size-5" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                    {OPTIONS.map(({ value, icon: Icon, label }) => (
                        <DropdownMenuItem key={value} onClick={() => updateAppearance(value)}>
                            <span className="flex w-full items-center gap-2.5">
                                <span
                                    className={cn(
                                        'text-primary flex size-7 items-center justify-center rounded-lg dark:text-[#6fb3e8]',
                                        appearance === value ? 'bg-primary/12 dark:bg-primary/20' : 'bg-muted',
                                    )}
                                >
                                    <Icon className="size-4" />
                                </span>
                                <span className={cn('flex-1', appearance === value && 'font-semibold')}>{label}</span>
                                {appearance === value && <MdCheck className="text-primary size-4" />}
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
