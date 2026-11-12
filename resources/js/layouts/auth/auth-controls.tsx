import { type IconType, LoaderCircle } from '@/components/icons';
import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

/**
 * The phone's authInputDecoration: a filled field with a blue leading icon, radius 16 and a
 * Material-style label that sits inside the field and floats onto the border when focused or filled.
 */
export function AuthField({
    id,
    label,
    icon: Icon,
    suffix,
    invalid = false,
    className,
    placeholder,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
    id: string;
    label: string;
    icon: IconType;
    suffix?: ReactNode;
    invalid?: boolean;
}) {
    return (
        <div className={cn('relative', className)}>
            <input
                id={id}
                placeholder={placeholder ?? ' '}
                aria-invalid={invalid || undefined}
                className={cn(
                    'peer text-foreground h-[52px] w-full rounded-2xl border-[1.2px] border-[#eeeeee] bg-[#F6F8FC] pr-4 pl-12 text-[15px] transition-colors outline-none',
                    'placeholder:text-[13.5px] placeholder:text-transparent focus:placeholder:text-[#bdbdbd]',
                    'focus:border-primary focus:border-[1.6px]',
                    'dark:border-white/10 dark:bg-white/5 dark:focus:placeholder:text-white/30',
                    suffix ? 'pr-12' : undefined,
                    invalid && 'border-red-300 focus:border-red-400 dark:border-red-400/60',
                )}
                {...props}
            />
            <Icon className="text-primary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden="true" />
            <label
                htmlFor={id}
                className={cn(
                    'bg-card text-muted-foreground pointer-events-none absolute top-0 left-3 -translate-y-1/2 rounded px-1 text-[11.5px] leading-none font-medium transition-all',
                    'peer-placeholder-shown:top-1/2 peer-placeholder-shown:left-11 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-[13px]',
                    'peer-focus:text-primary peer-focus:bg-card peer-focus:top-0 peer-focus:left-3 peer-focus:text-[11.5px]',
                    invalid && 'text-red-500 peer-focus:text-red-500',
                )}
            >
                {label}
            </label>
            {suffix && <div className="absolute top-1/2 right-2 -translate-y-1/2">{suffix}</div>}
        </div>
    );
}

/** The phone's AuthPrimaryButton: navy-to-blue gradient, 52px tall, radius 16, label with a trailing icon. */
export function AuthPrimaryButton({
    label,
    icon: Icon,
    loading = false,
    disabled = false,
    variant = 'gradient',
    className,
    ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    label: string;
    icon: IconType;
    loading?: boolean;
    /** 'solid' is the OTP screen's flat blue button (radius 14). */
    variant?: 'gradient' | 'solid';
}) {
    const off = loading || disabled;
    return (
        <button
            type="submit"
            disabled={off}
            aria-busy={loading || undefined}
            className={cn(
                'flex h-[52px] w-full items-center justify-center gap-2 text-base font-semibold tracking-[0.4px] text-white transition-[filter,box-shadow] outline-none',
                'focus-visible:ring-primary/40 focus-visible:ring-4',
                variant === 'gradient' ? 'rounded-2xl' : 'rounded-[14px]',
                off
                    ? 'bg-primary/45 cursor-not-allowed'
                    : variant === 'gradient'
                      ? 'bg-[linear-gradient(90deg,#1B3F73,var(--color-primary))] shadow-[0_10px_20px_rgb(33_120_189/0.32)] hover:brightness-110'
                      : 'bg-primary hover:brightness-110',
                className,
            )}
            {...props}
        >
            {loading ? (
                <LoaderCircle className="size-[22px] animate-spin" />
            ) : (
                <>
                    {label}
                    <Icon className="size-[19px]" />
                </>
            )}
        </button>
    );
}

/** The frosted square the phone puts the logo (login) or mail icon (OTP) in. */
export function GlassTile({ size, radius, className, children }: { size: number; radius: number; className?: string; children: ReactNode }) {
    return (
        <span
            className={cn('flex shrink-0 items-center justify-center border border-white/28 bg-white/16 shadow-[0_14px_32px_rgb(0_0_0/0.22)]', className)}
            style={{ width: size, height: size, borderRadius: radius }}
        >
            {children}
        </span>
    );
}
