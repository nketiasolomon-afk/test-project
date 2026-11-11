import { type HeaderProps } from '@/components/app-header';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';

interface AppLayoutProps {
    children: React.ReactNode;
    header: HeaderProps;
}

export default ({ children, header }: AppLayoutProps) => <AppLayoutTemplate header={header}>{children}</AppLayoutTemplate>;
