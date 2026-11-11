import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle } from '@/components/icons';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type LoginForm = {
    username: string;
    password: string;
};

interface LoginProps {
    /** Why the last session ended, e.g. it expired or the user's role may no longer use the app. */
    status?: string | null;
}

export default function Login({ status }: LoginProps) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        username: '',
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login.store'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Welcome Back" description="Sign in to access your technician dashboard">
            <Head title="Sign in" />

            {status && (
                <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-center text-sm">
                    {status}
                </div>
            )}

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="username">Username or Email</Label>
                        <Input
                            id="username"
                            type="text"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="username"
                            value={data.username}
                            onChange={(e) => setData('username', e.target.value)}
                            placeholder="Enter your username or email"
                        />
                        <InputError message={errors.username} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Enter your password"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((shown) => !shown)}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                        <InputError message={errors.password} />
                    </div>

                    <Button type="submit" className="mt-2 w-full" tabIndex={3} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        {processing ? 'Signing in...' : 'Sign In'}
                    </Button>
                </div>
            </form>
        </AuthLayout>
    );
}
