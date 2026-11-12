import AppearanceTabs from '@/components/appearance-tabs';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { MdSettings } from '@/components/icons';

/** Mirrors the phone's Settings sheet (Profile > gear): an icon-tile header over the theme choice. */
export default function Appearance() {
    return (
        <Page title="Appearance" description="Choose light, dark, or follow your device" width="default">
            <div className="bg-card border-border/70 shadow-card rounded-[20px] border p-5 sm:p-6">
                <div className="flex items-center gap-3">
                    <IconTile icon={MdSettings} color="#2178BD" />
                    <div className="min-w-0">
                        <h2 className="text-lg leading-tight font-bold">Theme</h2>
                        <p className="text-muted-foreground text-xs">Applies to this browser</p>
                    </div>
                </div>
                <div className="bg-border my-5 h-px" />
                <AppearanceTabs />
            </div>
        </Page>
    );
}
