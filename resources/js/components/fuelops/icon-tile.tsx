import { type IconType } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * A rounded square holding an icon on a soft tint of its accent colour, the phone app's
 * standard icon treatment. Pass the accent either as a CSS colour (`color`) or as a
 * text colour class (`className="text-teal-700"`).
 */
export function IconTile({
    icon: Icon,
    color,
    size = 'md',
    gradient = false,
    className,
}: {
    icon: IconType;
    color?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** The diagonal two-tone tint used on the Home Quick Access tiles. */
    gradient?: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'relative flex shrink-0 items-center justify-center overflow-hidden',
                {
                    'size-8 rounded-[10px] [&>svg]:size-4': size === 'sm',
                    'size-10 rounded-xl [&>svg]:size-5': size === 'md',
                    'size-[52px] rounded-[15px] [&>svg]:size-[26px]': size === 'lg',
                    'size-[88px] rounded-3xl [&>svg]:size-10': size === 'xl',
                },
                className,
            )}
            style={color ? { color } : undefined}
        >
            <span
                className={cn(
                    'absolute inset-0',
                    gradient ? 'bg-gradient-to-br from-current/16 to-current/7 dark:from-current/28 dark:to-current/14' : 'bg-current/12 dark:bg-current/20',
                )}
                aria-hidden="true"
            />
            <Icon className="relative" />
        </span>
    );
}
