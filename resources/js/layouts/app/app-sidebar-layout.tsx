import { AppHeader, type HeaderProps } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { BottomNav } from '@/components/bottom-nav';
import { Toaster } from '@/components/fuelops/toast';

/**
 * The signed-in shell. Desktop: white side menu beside the blue header and content.
 * Mobile: blue header on top and the phone's bottom tab bar. The StarOil watermark
 * sits behind the content on every page.
 */
export default function AppSidebarLayout({ children, header }: { children: React.ReactNode; header: HeaderProps }) {
    return (
        <div className="bg-background flex min-h-dvh w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AppHeader {...header} />
                <main className="relative flex flex-1 flex-col pb-[calc(92px+env(safe-area-inset-bottom))] lg:pb-0">
                    <div className="staroil-watermark" aria-hidden="true" />
                    <div className="relative z-[1] flex flex-1 flex-col">{children}</div>
                </main>
            </div>
            <BottomNav />
            <Toaster />
        </div>
    );
}
