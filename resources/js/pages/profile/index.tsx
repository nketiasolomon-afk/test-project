import { AvailabilityBadge } from '@/components/dispatch/chips';
import { ConfirmDialog } from '@/components/fuelops/dialogs';
import { Field } from '@/components/fuelops/field';
import { Page, Section } from '@/components/fuelops/page';
import { toast } from '@/components/fuelops/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { busyTicketSummary, initials } from '@/lib/format';
import { dispatch, profile } from '@/lib/fuelops-api';
import { type SharedData, type User } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Camera, ChevronRight, HardHat, LoaderCircle, LogOut, Palette, Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Own Busy/Available status, linked to what's causing it, and the on/off duty switch. */
function DispatchStatusCard() {
    const status = useApiQuery(() => dispatch.myStatus());
    const [saving, setSaving] = useState(false);

    const setOnDuty = async (onDuty: boolean) => {
        setSaving(true);
        try {
            status.setData(await dispatch.setDutyStatus(onDuty));
        } catch (e) {
            toast.error(errorText(e));
        } finally {
            setSaving(false);
        }
    };

    const data = status.data;
    if (!data) {
        return <div className="bg-card text-muted-foreground rounded-xl border p-4 text-sm">{status.error ?? 'Loading your availability...'}</div>;
    }
    const offDuty = data.dutyStatus === 'off_duty';

    return (
        <div className="bg-card space-y-2 rounded-xl border p-4 shadow-xs">
            <div className="flex items-center gap-3">
                <span className="font-semibold">My status</span>
                <AvailabilityBadge status={data.status} />
                <label className="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
                    On duty
                    <input
                        type="checkbox"
                        role="switch"
                        className="accent-primary size-4"
                        checked={!offDuty}
                        disabled={saving}
                        onChange={(e) => setOnDuty(e.target.checked)}
                    />
                </label>
            </div>
            {data.busyWith.length > 0 ? (
                <ul>
                    {data.busyWith.map((busy) => (
                        <li key={busy.ticketId}>
                            <Link
                                href={route('tickets.show', busy.ticketId)}
                                className="hover:bg-accent flex items-center gap-3 rounded-md px-1 py-2"
                            >
                                <HardHat className="size-4 shrink-0 text-orange-600" />
                                <span className="flex-1 text-sm">
                                    Busy with {busyTicketSummary(busy)}
                                    {busy.isOverride && <span className="text-muted-foreground block text-xs">Assigned by override</span>}
                                </span>
                                <ChevronRight className="text-muted-foreground size-4" />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {offDuty ? "You are off duty and won't be offered new assignments." : 'No work in progress.'}
                </p>
            )}
            {data.pendingResponseCount > 0 && (
                <p className="text-sm text-orange-700">
                    {data.pendingResponseCount} assignment{data.pendingResponseCount === 1 ? '' : 's'} waiting for your response.
                </p>
            )}
        </div>
    );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ProfileForm({ user }: { user: User }) {
    const [editing, setEditing] = useState(false);
    const [fullName, setFullName] = useState(user.fullName);
    const [phone, setPhone] = useState(user.phone ?? '');
    const [email, setEmail] = useState(user.email ?? '');
    const [picture, setPicture] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const preview = useMemo(() => (picture ? URL.createObjectURL(picture) : null), [picture]);

    useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

    const reset = () => {
        setFullName(user.fullName);
        setPhone(user.phone ?? '');
        setEmail(user.email ?? '');
        setPicture(null);
        setErrors({});
        setEditing(false);
    };

    const save = async () => {
        const next: Record<string, string> = {};
        if (fullName.trim() === '') next.fullName = 'Please enter your full name';
        if (email.trim() !== '' && !EMAIL_PATTERN.test(email.trim())) next.email = 'Please enter a valid email address';
        if (phone.trim() !== '' && phone.replace(/\D/g, '').length < 9) next.phone = 'Please enter a valid phone number';
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        setSaving(true);
        try {
            const changes: Parameters<typeof profile.update>[0] = {};
            if (picture) changes.profile_pic_url = await profile.uploadPicture(picture);
            if (fullName.trim() !== user.fullName) changes.full_name = fullName.trim();
            if (phone.trim() !== (user.phone ?? '')) changes.phone = phone.trim();
            if (email.trim() !== (user.email ?? '')) changes.email = email.trim();
            if (Object.keys(changes).length > 0) {
                await profile.update(changes);
                router.reload({ only: ['auth'] });
            }
            toast.success('Profile updated successfully');
            setPicture(null);
            setEditing(false);
        } catch (e) {
            toast.error(errorText(e, 'Failed to update profile'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="bg-card flex flex-col items-center gap-3 rounded-xl border p-6 text-center shadow-xs sm:flex-row sm:text-left">
                <div className="relative">
                    <Avatar className="size-20">
                        <AvatarImage src={preview ?? user.profilePicUrl ?? undefined} alt={user.fullName} />
                        <AvatarFallback className="text-xl font-semibold">{initials(user.fullName || user.username)}</AvatarFallback>
                    </Avatar>
                    {editing && (
                        <>
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                    setPicture(e.target.files?.[0] ?? null);
                                    e.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 rounded-full p-1.5 shadow"
                                aria-label="Change profile picture"
                            >
                                <Camera className="size-4" />
                            </button>
                        </>
                    )}
                </div>
                <div className="flex-1">
                    <p className="text-lg font-bold">{user.fullName || user.username}</p>
                    <p className="text-muted-foreground text-sm">{user.isClusterLeader ? 'Cluster Leader' : 'Technician'}</p>
                </div>
                {!editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil /> Edit Profile
                    </Button>
                )}
            </div>

            <Section title="Personal Information">
                <div className="bg-card grid gap-4 rounded-xl border p-5 shadow-xs">
                    {editing ? (
                        <>
                            <Field label="Full Name" htmlFor="full-name" error={errors.fullName} required>
                                <Input
                                    id="full-name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                />
                            </Field>
                            <Field label="Phone Number" htmlFor="phone" error={errors.phone}>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Enter your phone number"
                                />
                            </Field>
                            <Field label="Email Address" htmlFor="email" error={errors.email}>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email address"
                                />
                            </Field>
                            <div className="flex gap-2">
                                <Button onClick={save} disabled={saving}>
                                    {saving && <LoaderCircle className="animate-spin" />}
                                    Save Changes
                                </Button>
                                <Button variant="outline" onClick={reset} disabled={saving}>
                                    Cancel
                                </Button>
                            </div>
                        </>
                    ) : (
                        <dl className="grid gap-3 text-sm sm:grid-cols-3">
                            {[
                                ['Full Name', user.fullName],
                                ['Phone Number', user.phone],
                                ['Email Address', user.email],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="font-medium">{value || 'Not set'}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </Section>
        </>
    );
}

export default function ProfileIndex() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const [confirmLogout, setConfirmLogout] = useState(false);

    return (
        <Page
            title="Profile"
            width="narrow"
            actions={
                <Button variant="outline" size="sm" asChild>
                    <Link href={route('appearance')}>
                        <Palette /> Appearance
                    </Link>
                </Button>
            }
        >
            {/* Re-key on the user so a saved change resets the form to the server's copy. */}
            <ProfileForm key={`${user.fullName}|${user.phone}|${user.email}|${user.profilePicUrl}`} user={user} />

            {(user.role === 'Cluster Technician' || user.role === 'Cluster Engineer') && <DispatchStatusCard />}

            <Section title="Account Information">
                <dl className="bg-card grid gap-3 rounded-xl border p-5 text-sm shadow-xs sm:grid-cols-3">
                    <div>
                        <dt className="text-muted-foreground">Username</dt>
                        <dd className="font-medium">{user.username}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Role</dt>
                        <dd className="font-medium">{user.isClusterLeader ? 'Cluster Leader' : 'Technician'}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Cluster</dt>
                        <dd className="font-medium">{user.clusterId ?? 'Not assigned'}</dd>
                    </div>
                </dl>
            </Section>

            <Button variant="outline" className="w-full text-red-600 hover:text-red-700" onClick={() => setConfirmLogout(true)}>
                <LogOut /> Log Out
            </Button>
            <ConfirmDialog
                open={confirmLogout}
                onOpenChange={setConfirmLogout}
                title="Log Out"
                description="Are you sure you want to log out?"
                confirmLabel="Log Out"
                destructive
                onConfirm={() => router.post(route('logout'))}
            />
        </Page>
    );
}
