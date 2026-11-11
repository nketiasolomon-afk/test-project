interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0b1b33] to-[#2178bd] p-6 md:p-10">
            <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-2xl md:p-8">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex flex-col items-center gap-2">
                            <img src="/images/star-logo.png" alt="StarOil" className="h-12 w-auto" />
                            <span className="rounded-full bg-[var(--brand-navy)] px-3 py-1 text-[10px] font-semibold tracking-widest text-white">
                                JOB CARD SUBMISSION PORTAL
                            </span>
                        </div>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-semibold">{title}</h1>
                            <p className="text-muted-foreground text-center text-sm">{description}</p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
