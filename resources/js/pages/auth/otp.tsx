import { Head, router, useForm } from '@inertiajs/react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { ClipboardEvent, FormEventHandler, KeyboardEvent, useEffect, useRef, useState } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';

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

    return (
        <AuthLayout title="Verification Code" description="Enter the 6-digit code sent to your email">
            <Head title="Verify your email" />

            <p className="text-muted-foreground -mt-4 text-center text-sm">
                Signing in as <span className="text-foreground font-medium">{username}</span>
            </p>

            {status && (
                <div role="status" className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-center text-sm">
                    {status}
                </div>
            )}

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-2">
                    <div className="flex justify-between gap-2">
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
                                className="border-input bg-background focus-visible:ring-ring h-12 w-11 rounded-lg border text-center text-xl font-semibold focus-visible:ring-2 focus-visible:outline-hidden"
                            />
                        ))}
                    </div>
                    <InputError message={errors.otp_code} className="text-center" />
                </div>

                <Button type="submit" className="w-full" disabled={processing || data.otp_code.length !== CODE_LENGTH}>
                    {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Verify &amp; Continue
                </Button>

                <div className="text-muted-foreground text-center text-sm">
                    Didn't receive the code?{' '}
                    {cooldown > 0 ? (
                        <span>Resend in {cooldown}s</span>
                    ) : (
                        <button type="button" onClick={resend} disabled={resending} className="text-primary font-medium hover:underline">
                            {resending ? 'Sending...' : 'Resend Code'}
                        </button>
                    )}
                </div>

                <div className="bg-muted flex items-start gap-3 rounded-lg p-3 text-xs">
                    <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                    <div>
                        <p className="font-semibold">Secure Verification</p>
                        <p className="text-muted-foreground">This code expires in 5 minutes. Never share this code with anyone.</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => router.delete(route('otp.destroy'))}
                    className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
                >
                    Back to sign in
                </button>
            </form>
        </AuthLayout>
    );
}
