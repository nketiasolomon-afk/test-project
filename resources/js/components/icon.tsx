import { type IconProps as BaseIconProps } from '@/components/icons';
import { cn } from '@/lib/utils';

interface IconProps extends BaseIconProps {
    iconNode: React.ComponentType<BaseIconProps>;
}

export function Icon({ iconNode: IconComponent, className, ...props }: IconProps) {
    return <IconComponent className={cn('h-4 w-4', className)} {...props} />;
}
