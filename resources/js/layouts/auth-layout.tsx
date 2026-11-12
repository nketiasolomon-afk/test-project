import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';

export default function AuthLayout(props: React.ComponentProps<typeof AuthLayoutTemplate>) {
    return <AuthLayoutTemplate {...props} />;
}
