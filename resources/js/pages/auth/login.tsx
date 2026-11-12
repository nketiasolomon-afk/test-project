import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

import { BrandTitle } from '@/components/brand/brand-title';
import { MdArrowForward, MdInfoOutline, MdLockOutline, MdPersonOutline, MdVisibilityOffOutline, MdVisibilityOutline } from '@/components/icons';
import InputError from '@/components/input-error';
import AuthLayout from '@/layouts/auth-layout';
import { AuthField, AuthPrimaryButton, GlassTile } from '@/layouts/auth/auth-controls';

type LoginForm = {
    username: string;
    password: string;
};

interface LoginProps {
    /** Why the last session ended, e.g. it expired or the user's role may no longer use the app. */
    status?: string | null;
}

/** The phone login screen's hero: glass logo tile, animated brand title, yellow bar and portal tag. */
function LoginHero() {
    return (
        <div className="flex flex-col items-center text-center">
            <GlassTile size={108} radius={26} className="p-3.5 lg:scale-125">
                <img src="/images/star-logo.png" alt="StarOil" className="h-full w-full rounded-[20px] object-contain" draggable={false} />
            </GlassTile>
            <BrandTitle className="mt-[26px] text-[26px] tracking-[1.4px] min-[380px]:text-[28px] lg:mt-10 lg:text-[40px]" />
            <span className="bg-brand-yellow mt-2.5 h-[3px] w-[42px] rounded-sm" aria-hidden="true" />
            <span className="mt-3.5 rounded-[20px] border border-white/28 px-[18px] py-[9px] text-[11px] font-semibold tracking-[1.8px] text-white/78">
                JOB CARD SUBMISSION PORTAL
            </span>
        </div>
    );
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
        <AuthLayout hero={<LoginHero />}>
            <Head title="Sign in" />

            <div className="mt-1">
                <h1 className="text-foreground text-[22px] leading-tight font-bold tracking-[-0.3px]">Welcome Back</h1>
                <p className="text-muted-foreground mt-[3px] text-[12.5px]">Sign in to access your technician dashboard</p>
            </div>

            {status && (
                <div
                    role="status"
                    className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-[12.5px] text-amber-800 dark:text-amber-200"
                >
                    <MdInfoOutline className="mt-px size-[18px] shrink-0 text-amber-600 dark:text-amber-300" />
                    <span>{status}</span>
                </div>
            )}

            <form className="mt-5 flex flex-1 flex-col" onSubmit={submit}>
                <div className="grid gap-1.5">
                    <AuthField
                        id="username"
                        label="Username or Email"
                        placeholder="Enter your username or email"
                        icon={MdPersonOutline}
                        type="text"
                        required
                        autoFocus
                        tabIndex={1}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={data.username}
                        onChange={(e) => setData('username', e.target.value)}
                        invalid={!!errors.username}
                    />
                    <InputError message={errors.username} className="pl-1 text-xs" />
                </div>

                <div className="mt-3 grid gap-1.5">
                    <AuthField
                        id="password"
                        label="Password"
                        placeholder="Enter your password"
                        icon={MdLockOutline}
                        type={showPassword ? 'text' : 'password'}
                        required
                        tabIndex={2}
                        autoComplete="current-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        invalid={!!errors.password}
                        suffix={
                            <button
                                type="button"
                                onClick={() => setShowPassword((shown) => !shown)}
                                className="hover:text-foreground flex size-9 items-center justify-center rounded-full text-[#9e9e9e] transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <MdVisibilityOffOutline className="size-[22px]" /> : <MdVisibilityOutline className="size-[22px]" />}
                            </button>
                        }
                    />
                    <InputError message={errors.password} className="pl-1 text-xs" />
                </div>

                <AuthPrimaryButton label="Sign In" icon={MdArrowForward} loading={processing} tabIndex={3} className="mt-7" />
            </form>
        </AuthLayout>
    );
}
