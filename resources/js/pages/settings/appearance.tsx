import AppearanceTabs from '@/components/appearance-tabs';
import { Page } from '@/components/fuelops/page';

export default function Appearance() {
    return (
        <Page title="Appearance" description="Choose light, dark, or follow your device" width="narrow">
            <AppearanceTabs />
        </Page>
    );
}
