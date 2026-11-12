import { Head, router, useForm } from '@inertiajs/react';
import { ClipboardEvent, FormEventHandler, KeyboardEvent, useEffect, useRef, useState } from 'react';

import { MdArrowBack, MdMailOutline, MdSecurity, MdVerified } from '@/components/icons';
import InputError from '@/components/input-error';
import AuthLayout from '@/layouts/auth-layout';
import { AuthPrimaryButton, GlassTile } from '@/layouts/auth/auth-controls';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

interface OtpProps {
    /** The account being signed in to. */
    username: string;
    status?: string | null;
}

export default function Otp({ username, status }: OtpProps) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({ otp_code: '' });
    const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
    const [resending, setResending] = useState(false);
    const boxes = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [cooldown]);

    const applyDigits = (next: string[]) => {
        setDigits(next);
        setData('otp_code', next.join(''));
        clearErrors('otp_code');
    };

    const verify = (code: string) => {
        if (processing) return;
        router.post(
            route('otp.store'),
            { otp_code: code },
            {
                // A wrong code clears the boxes so the next attempt starts clean.
                onError: () => {
                    setDigits(Array(CODE_LENGTH).fill(''));
                    boxes.current[0]?.focus();
                },
            },
        );
    };

    const fill = (startIndex: number, text: string) => {
        const typed = text.replace(/\D/g, '').slice(0, CODE_LENGTH - startIndex);
        if (typed === '') return;
        const next = [...digits];
        typed.split('').forEach((digit, offset) => (next[startIndex + offset] = digit));
        applyDigits(next);
        boxes.current[Math.min(startIndex + typed.length, CODE_LENGTH - 1)]?.focus();
        // All six entered: verify without needing the button.
        if (next.every((digit) => digit !== '')) verify(next.join(''));
    };

    const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Backspace') return;
        event.preventDefault();
        const next = [...digits];
        if (next[index] !== '') {
            next[index] = '';
        } else if (index > 0) {
            next[index - 1] = '';
            boxes.current[index - 1]?.focus();
        }
        applyDigits(next);
    };

    const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        fill(index, event.clipboardData.getData('text'));
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('otp.store'));
    };

    const resend = () => {
        router.post(
            route('otp.resend'),
            {},
            {
                preserveScroll: true,
                onStart: () => setResending(true),
                onFinish: () => setResending(false),
                onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS),
            },
        );
    };

    const backToLogin = () => router.delete(route('otp.destroy'));

    return (
        <AuthLayout
            heroSize="compact"
            heroAction={
                <button
                    type="button"
                    onClick={backToLogin}
                    aria-label="Back to sign in"
                    className="flex size-12 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                >
                    <MdArrowBack className="size-7" />
                </button>
            }
            hero={
                <div className="flex flex-col items-center text-center">
                    <GlassTile size={90} radius={24} className="border-transparent bg-white/15 shadow-[0_8px_20px_rgb(0_0_0/0.1)]">
                        <MdMailOutline className="size-11 text-white" />
                    </GlassTile>
                    <h2 className="mt-5 text-[24px] font-bold tracking-[1px] text-white min-[380px]:text-[26px] lg:text-[32px]">Verify Your Email</h2>
                    <p className="mt-2.5 text-sm text-white/70">Enter the code sent to</p>
                    <p className="mt-1 max-w-[80vw] truncate text-base font-semibold text-white">{username}</p>
                </div>
            }
        >
            <Head title="Verify your email" />

            <form className="flex flex-col items-center" onSubmit={submit}>
                <h1 className="text-foreground mt-6 text-xl font-bold lg:mt-0">Verification Code</h1>
                <p className="text-muted-foreground mt-2 text-center text-[13px]">Enter the 6-digit code sent to your email</p>

                {status && (
                    <div
                        role="status"
                        className="mt-5 w-full rounded-xl border border-green-600/25 bg-green-600/8 p-3 text-center text-[12.5px] text-green-800 dark:text-green-300"
                    >
                        {status}
                    </div>
                )}

                <div className="mt-8 grid w-full gap-2">
                    <div className="flex justify-between gap-1.5 min-[380px]:justify-evenly">
                        {digits.map((digit, index) => (
                            <input
                                key={index}
                                ref={(element) => {
                                    boxes.current[index] = element;
                                }}
                                value={digit}
                                onChange={(event) => fill(index, event.target.value.slice(-1))}
                                onKeyDown={(event) => onKeyDown(index, event)}
                                onPaste={(event) => onPaste(index, event)}
                                onFocus={(event) => event.target.select()}
                                autoFocus={index === 0}
                                inputMode="numeric"
                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                aria-label={`Digit ${index + 1}`}
                                aria-invalid={errors.otp_code ? true : undefined}
                                className="text-foreground focus:border-primary h-14 w-full max-w-12 min-w-0 rounded-xl border-[1.5px] border-[#757575] bg-[#eeeeee] text-center text-[22px] font-bold transition-colors outline-none focus:border-2 aria-invalid:border-red-400 dark:border-white/25 dark:bg-white/6"
                            />
                        ))}
                    </div>
                    <InputError message={errors.otp_code} className="text-center text-xs" />
                </div>

                <AuthPrimaryButton
                    variant="solid"
                    label="Verify & Continue"
                    icon={MdVerified}
                    loading={processing}
                    disabled={data.otp_code.length !== CODE_LENGTH}
                    className="mt-7"
                />

                <div className="mt-5 text-center text-[13px]">
                    <span className="text-muted-foreground">Didn&apos;t receive the code? </span>
                    {cooldown > 0 ? (
                        <span className="font-semibold text-[#bdbdbd] dark:text-white/40">Resend in {cooldown}s</span>
                    ) : (
                        <button type="button" onClick={resend} disabled={resending} className="text-primary font-semibold underline underline-offset-2">
                            {resending ? 'Sending...' : 'Resend Code'}
                        </button>
                    )}
                </div>

                <div className="border-primary/10 bg-primary/5 mt-6 flex w-full items-start gap-2.5 rounded-xl border p-3.5">
                    <MdSecurity className="text-primary size-[18px] shrink-0" />
                    <div>
                        <p className="text-primary text-xs font-semibold">Secure Verification</p>
                        <p className="text-muted-foreground mt-1 text-[11px] leading-[1.4]">
                            This code expires in 5 minutes. Never share this code with anyone.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={backToLogin}
                    className="text-muted-foreground hover:text-foreground mt-5 text-center text-[13px] underline-offset-4 hover:underline"
                >
                    Back to sign in
                </button>
            </form>
        </AuthLayout>
    );
}
