import { AvailabilityBadge } from '@/components/dispatch/chips';
import { ConfirmDialog } from '@/components/fuelops/dialogs';
import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { toast } from '@/components/fuelops/toast';
import {
    type IconType,
    LoaderCircle,
    MdApartment,
    MdBadge,
    MdBadgeOutline,
    MdBusiness,
    MdCameraAlt,
    MdCheck,
    MdChevronRight,
    MdEdit,
    MdEmail,
    MdEngineering,
    MdLogout,
    MdPerson,
    MdPersonOutline,
    MdPhone,
    MdSettings,
    MdShield,
    MdVerified,
    MdWorkOutline,
} from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/use-api-query';
import { errorText } from '@/lib/api';
import { busyTicketSummary, initials } from '@/lib/format';
import { dispatch, profile } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const PRIMARY = '#2178BD';

/** The phone's white profile card: radius 20, hairline border, soft shadow. */
const CARD = 'bg-card overflow-hidden rounded-[20px] border border-border/70 shadow-card';

/** Desktop placement: the hero sits in the left column, every other block stacks on the right. */
const RIGHT_COLUMN = 'min-w-0 lg:col-start-2';

/*
 * Info rows stack as a divided list on phones and in the narrow desktop column, and sit side by
 * side (divided by vertical rules) where the card is wide: sm-to-lg (single column) and xl+.
 */
const SPLIT_RIGHT = 'sm:border-r lg:border-r-0 xl:border-r';
const ROW_SPLIT = cn('border-b sm:border-b-0 lg:border-b xl:border-b-0', SPLIT_RIGHT);

/** A card header row: tinted icon tile + title, with a divider beneath (phone `_buildProfileDetailsCard`). */
function CardHeader({ icon, title }: { icon: IconType; title: string }) {
    return (
        <div className="border-border flex items-center gap-3 border-b px-5 pt-5 pb-3">
            <IconTile icon={icon} color={PRIMARY} />
            <h2 className="text-base font-semibold tracking-[-0.1px]">{title}</h2>
        </div>
    );
}

/** One label/value line inside a profile card (phone `_buildInfoRow`). */
function InfoRow({ icon: Icon, label, value, className }: { icon: IconType; label: string; value?: string | null; className?: string }) {
    return (
        <div className={cn('border-border flex min-w-0 items-center gap-3 px-5 py-4', className)}>
            <Icon className="text-muted-foreground size-[18px] shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[13px] font-medium">{label}</p>
                <p className={cn('mt-0.5 truncate text-[15px] font-medium', !value && 'text-muted-foreground/70')}>{value || 'Not set'}</p>
            </div>
        </div>
    );
}

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
        return (
            <div className="bg-card border-border/70 text-muted-foreground rounded-[18px] border p-4 text-[13px] shadow-card">
                {status.error ?? 'Loading your availability...'}
            </div>
        );
    }
    const offDuty = data.dutyStatus === 'off_duty';

    return (
        <div className="bg-card border-border/70 space-y-2 rounded-[18px] border p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="text-[15px] font-bold">My status</span>
                <AvailabilityBadge status={data.status} />
                <label className="text-muted-foreground ml-auto flex cursor-pointer items-center gap-2.5 text-[12.5px]">
                    On duty
                    <input
                        type="checkbox"
                        role="switch"
                        className="peer sr-only"
                        checked={!offDuty}
                        disabled={saving}
                        onChange={(e) => setOnDuty(e.target.checked)}
                    />
                    <span
                        aria-hidden="true"
                        className="bg-muted-foreground/30 peer-checked:bg-primary peer-focus-visible:ring-ring relative h-6 w-10 shrink-0 rounded-full transition-colors peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
                    />
                </label>
            </div>
            {data.busyWith.length > 0 ? (
                <ul className="-mx-1">
                    {data.busyWith.map((busy) => (
                        <li key={busy.ticketId}>
                            <Link
                                href={route('tickets.show', busy.ticketId)}
                                className="hover:bg-accent flex items-center gap-3 rounded-xl px-1 py-2 transition-colors"
                            >
                                <IconTile icon={MdEngineering} color="#FB8C00" size="sm" />
                                <span className="min-w-0 flex-1 text-sm font-medium">
                                    Busy with {busyTicketSummary(busy)}
                                    {busy.isOverride && (
                                        <span className="text-muted-foreground block text-xs font-normal">Assigned by override</span>
                                    )}
                                </span>
                                <MdChevronRight className="text-muted-foreground size-5 shrink-0" />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground text-[12.5px]">
                    {offDuty ? "You are off duty and won't be offered new assignments." : 'No work in progress.'}
                </p>
            )}
            {data.pendingResponseCount > 0 && (
                <p className="text-[12.5px] text-[#E65100] dark:text-orange-400">
                    {data.pendingResponseCount} assignment{data.pendingResponseCount === 1 ? '' : 's'} waiting for your response.
                </p>
            )}
        </div>
    );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** An editable line inside the Personal Information card (phone `_buildEditableField`). */
function EditableRow({
    icon: Icon,
    label,
    htmlFor,
    error,
    required,
    children,
}: {
    icon: IconType;
    label: string;
    htmlFor: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="border-border border-b px-5 py-4 last:border-b-0">
            <label htmlFor={htmlFor} className="text-muted-foreground mb-2 flex items-center gap-2 text-[13px] font-medium">
                <Icon className="size-[18px] shrink-0" />
                {label}
                {required && <span className="text-destructive">*</span>}
            </label>
            {children}
            {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}

const EDIT_INPUT = 'bg-muted border-transparent text-base font-medium md:text-[15px]';

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

    const roleLabel = user.isClusterLeader ? 'Cluster Leader' : 'Technician';

    return (
        <>
            {/* Profile hero (phone `_buildProfileHero`): navy-to-blue gradient card. */}
            <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0B1B33_0%,#15315E_35%,#1F4788_70%,#2178BD_100%)] px-[18px] pt-[18px] pb-4 text-white shadow-[0_10px_24px_rgb(31_71_136/0.3)] lg:sticky lg:top-6 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:self-start lg:px-6 lg:pt-7 lg:pb-5">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-[30px] -right-[25px] size-[100px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.08),transparent_70%)] lg:size-[160px]"
                />
                <div className="relative flex flex-col items-center text-center">
                    <div className="relative">
                        <Avatar className="size-16 border-2 border-white/70 shadow-[0_6px_12px_rgb(0_0_0/0.25)] lg:size-24">
                            <AvatarImage src={preview ?? user.profilePicUrl ?? undefined} alt={user.fullName} className="object-cover" />
                            <AvatarFallback className="bg-[#E9F2F9] text-[22px] font-bold text-[#2178BD] lg:text-3xl dark:bg-[#1c3550] dark:text-[#6fb3e8]">
                                {initials(user.fullName || user.username)}
                            </AvatarFallback>
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
                                    className="bg-brand-yellow absolute right-0 bottom-0 flex size-[26px] items-center justify-center rounded-full border-2 border-white text-[#1A1A2E] shadow lg:size-8"
                                    aria-label="Change profile picture"
                                >
                                    <MdCameraAlt className="size-3.5 lg:size-4" />
                                </button>
                            </>
                        )}
                    </div>

                    <p className="mt-2.5 max-w-full truncate text-base font-bold tracking-[-0.2px] lg:mt-3.5 lg:text-xl">
                        {user.fullName || user.username}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-2xl border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-semibold tracking-[0.8px] uppercase">
                        <MdVerified className="text-brand-yellow size-[11px]" />
                        {roleLabel}
                    </span>

                    {!editing && (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="mt-3.5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/25 bg-white/12 px-3.5 text-[13px] font-semibold transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-hidden"
                        >
                            <MdEdit className="size-4" /> Edit Profile
                        </button>
                    )}

                    <div className="mt-3.5 h-px w-full bg-white/12" />
                    <div className="mt-2.5 grid w-full grid-cols-2 gap-2">
                        <HeroFact icon={MdBadgeOutline} label={`@${user.username}`} />
                        <HeroFact icon={MdApartment} label={user.clusterId ?? 'Unassigned'} />
                    </div>
                </div>
            </div>

            <section className={cn(CARD, RIGHT_COLUMN, 'order-2')} aria-label="Personal Information">
                <CardHeader icon={MdPerson} title="Personal Information" />
                {editing ? (
                    <>
                        <EditableRow icon={MdBadge} label="Full Name" htmlFor="full-name" error={errors.fullName} required>
                            <Input
                                id="full-name"
                                className={EDIT_INPUT}
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </EditableRow>
                        <EditableRow icon={MdPhone} label="Phone Number" htmlFor="phone" error={errors.phone}>
                            <Input
                                id="phone"
                                type="tel"
                                className={EDIT_INPUT}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter your phone number"
                            />
                        </EditableRow>
                        <EditableRow icon={MdEmail} label="Email Address" htmlFor="email" error={errors.email}>
                            <Input
                                id="email"
                                type="email"
                                className={EDIT_INPUT}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email address"
                            />
                        </EditableRow>
                        <div className="border-border flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={reset} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={save} disabled={saving}>
                                {saving ? <LoaderCircle className="animate-spin" /> : <MdCheck />}
                                Save Changes
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="sm:grid sm:grid-cols-2 lg:block xl:grid">
                        <InfoRow icon={MdBadge} label="Full Name" value={user.fullName} className={cn('border-b', SPLIT_RIGHT)} />
                        <InfoRow icon={MdPhone} label="Phone Number" value={user.phone} className="border-b" />
                        <InfoRow icon={MdEmail} label="Email Address" value={user.email} className="sm:col-span-2" />
                    </div>
                )}
            </section>
        </>
    );
}

function HeroFact({ icon: Icon, label }: { icon: IconType; label: string }) {
    return (
        <span className="flex min-w-0 items-center justify-center gap-1 text-[10.5px] font-medium text-white/85 lg:text-xs">
            <Icon className="size-[11px] shrink-0 text-white/65 lg:size-3.5" />
            <span className="truncate">{label}</span>
        </span>
    );
}

export default function ProfileIndex() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const [confirmLogout, setConfirmLogout] = useState(false);

    return (
        <Page
            title="Profile"
            width="default"
            actions={
                <Button variant="outline" size="sm" asChild>
                    <Link href={route('appearance')}>
                        <MdSettings /> Appearance
                    </Link>
                </Button>
            }
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-6">
                {/* Re-key on the user so a saved change resets the form to the server's copy. */}
                <ProfileForm key={`${user.fullName}|${user.phone}|${user.email}|${user.profilePicUrl}`} user={user} />

                {(user.role === 'Cluster Technician' || user.role === 'Cluster Engineer') && (
                    <div className={cn(RIGHT_COLUMN, 'order-1')}>
                        <DispatchStatusCard />
                    </div>
                )}

                <section className={cn(CARD, RIGHT_COLUMN, 'order-3')} aria-label="Account Information">
                    <CardHeader icon={MdShield} title="Account Information" />
                    <div className="sm:grid sm:grid-cols-3 lg:block xl:grid">
                        <InfoRow icon={MdPersonOutline} label="Username" value={user.username} className={ROW_SPLIT} />
                        <InfoRow icon={MdWorkOutline} label="Role" value={user.isClusterLeader ? 'Cluster Leader' : 'Technician'} className={ROW_SPLIT} />
                        <InfoRow icon={MdBusiness} label="Cluster" value={user.clusterId ?? 'Not assigned'} />
                    </div>
                </section>

                <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className={cn(
                        RIGHT_COLUMN,
                        'order-4 bg-card flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-red-200 text-base font-semibold tracking-[0.5px] text-red-500 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-hidden dark:border-red-500/35 dark:text-red-400 dark:hover:bg-red-500/10',
                    )}
                >
                    <MdLogout className="size-[18px]" /> Log Out
                </button>
            </div>
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
