import { cn } from '@/lib/utils';
import { forwardRef, type SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    /** Width and height in pixels when no size class is given. */
    size?: number | string;
    /** Accepted for drop-in compatibility with older icon call sites; Material Symbols are filled shapes. */
    strokeWidth?: number | string;
}

export type IconType = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

/** A Material Symbols Rounded icon drawn as inline SVG, coloured by `currentColor`. */
export function createIcon(name: string, path: string): IconType {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strokeWidth is accepted and dropped, so it never reaches the <svg>.
    const Icon = forwardRef<SVGSVGElement, IconProps>(({ size = 24, strokeWidth, className, ...props }, ref) => (
        <svg
            ref={ref}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            width={size}
            height={size}
            fill="currentColor"
            aria-hidden={props['aria-label'] ? undefined : true}
            className={cn('shrink-0', className)}
            {...props}
        >
            <path d={path} />
        </svg>
    ));
    Icon.displayName = name;
    return Icon;
}
