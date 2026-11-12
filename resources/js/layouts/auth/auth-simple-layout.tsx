import { cn } from '@/lib/utils';

interface AuthLayoutProps {
    /** The branded content on the gradient above the sheet (logo, title, ...). */
    hero: React.ReactNode;
    /** Rendered at the top-left of the gradient, e.g. a back arrow. */
    heroAction?: React.ReactNode;
    /** How much of a phone screen the hero takes, as the phone's topFlex:cardFlex. */
    heroSize?: 'large' | 'compact';
    children: React.ReactNode;
}

/**
 * The phone's AuthResponsiveScaffold: a navy-to-blue gradient with two soft ambient glows,
 * the branded hero on top and a white sheet (36px top corners, grab handle) holding the form.
 * On wide screens the hero moves to the left and the sheet becomes a floating card.
 */
export default function AuthSimpleLayout({ hero, heroAction, heroSize = 'large', children }: AuthLayoutProps) {
    return (
        <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-[linear-gradient(135deg,#0B1B33_0%,#15315E_38%,#1F4788_72%,#2178BD_100%)] lg:flex-row lg:items-center">
            {/* Ambient glows, as in the phone's _AmbientGlow. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-[70px] -right-[70px] -z-10 size-[260px] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.08),transparent)] lg:size-[520px]"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[90px] -left-[110px] -z-10 size-[240px] rounded-full bg-[radial-gradient(closest-side,rgb(253_205_33/0.12),transparent)] lg:size-[480px]"
            />

            {heroAction && <div className="absolute top-2 left-2 z-10 sm:top-4 sm:left-4">{heroAction}</div>}

            <div
                className={cn(
                    'animate-in fade-in slide-in-from-bottom-8 flex shrink-0 items-center justify-center px-6 duration-1000 lg:min-h-0 lg:flex-1 lg:py-16',
                    heroSize === 'large' ? 'min-h-[42svh] py-10' : 'min-h-[30svh] pt-14 pb-8',
                )}
            >
                {hero}
            </div>

            <main
                className={cn(
                    'bg-card text-card-foreground relative flex flex-1 flex-col rounded-t-[36px] shadow-[0_-6px_36px_rgb(0_0_0/0.26)]',
                    'lg:my-10 lg:mr-[max(3rem,7vw)] lg:w-[460px] lg:flex-none lg:rounded-[36px] lg:shadow-[0_24px_60px_rgb(0_0_0/0.35)]',
                )}
            >
                <span aria-hidden="true" className="mx-auto mt-3 h-[5px] w-11 shrink-0 rounded-[10px] bg-[#e0e0e0] lg:hidden dark:bg-white/15" />
                <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-7 pt-4 pb-6 lg:max-w-none lg:px-10 lg:py-10">{children}</div>
            </main>
        </div>
    );
}
