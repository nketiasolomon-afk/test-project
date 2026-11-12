import { IconTile } from '@/components/fuelops/icon-tile';
import { Page } from '@/components/fuelops/page';
import { EmptyState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { MdCopy, MdLocalGasStation, MdLocationOff, MdLocationSearching, MdMyLocation, MdNearMe, MdPinDrop, MdSchedule } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { timeAgo } from '@/lib/format';
import { stations } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type StationOption } from '@/types/fuelops';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Accra, until a real fix is obtained. */
const DEFAULT_CENTER = { latitude: 5.6037, longitude: -0.187 };

interface Fix {
    latitude: number;
    longitude: number;
    accuracy: number;
    at: number;
}

type Status = 'locating' | 'live' | 'paused' | 'denied' | 'unavailable';

/** Great-circle distance in metres. */
function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function mapUrl(center: { latitude: number; longitude: number }, withMarker: boolean): string {
    const span = 0.01;
    const bbox = [center.longitude - span, center.latitude - span, center.longitude + span, center.latitude + span].join(',');
    const marker = withMarker ? `&marker=${center.latitude},${center.longitude}` : '';
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`;
}

export default function LocationIndex() {
    const [fix, setFix] = useState<Fix | null>(null);
    const [status, setStatus] = useState<Status>('locating');
    const [selectedStation, setSelectedStation] = useState<StationOption | null>(null);
    const [watchKey, setWatchKey] = useState(0);
    const myStations = useApiQuery(() => stations.mine());

    // Live tracking while the page is visible; paused when the tab is hidden.
    const startWatch = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setStatus('unavailable');
            return () => {};
        }
        setStatus((current) => (current === 'live' ? current : 'locating'));
        const id = navigator.geolocation.watchPosition(
            (position) => {
                setFix({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    at: position.timestamp,
                });
                setStatus('live');
            },
            (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
        );
        return () => navigator.geolocation.clearWatch(id);
    }, []);

    useEffect(() => {
        let stop = document.visibilityState === 'visible' ? startWatch() : () => {};
        const onVisibility = () => {
            stop();
            if (document.visibilityState === 'visible') {
                stop = startWatch();
            } else {
                stop = () => {};
                setStatus((current) => (current === 'live' ? 'paused' : current));
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [startWatch, watchKey]);

    const nearby = useMemo(() => {
        const located = (myStations.data ?? []).filter((s) => s.latitude !== null && s.longitude !== null);
        return located
            .map((station) => ({
                station,
                meters: fix ? haversineMeters(fix, { latitude: station.latitude!, longitude: station.longitude! }) : null,
            }))
            .sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity) || a.station.name.localeCompare(b.station.name));
    }, [myStations.data, fix]);

    const center = selectedStation
        ? { latitude: selectedStation.latitude!, longitude: selectedStation.longitude! }
        : fix
          ? { latitude: fix.latitude, longitude: fix.longitude }
          : DEFAULT_CENTER;

    const statusLabel = {
        locating: 'Locating…',
        live: 'Live',
        paused: 'Paused',
        denied: 'Location off',
        unavailable: 'Location unavailable',
    }[status];

    const copy = async () => {
        if (!fix) return;
        try {
            await navigator.clipboard.writeText(`${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`);
            toast.success('Coordinates copied to clipboard');
        } catch {
            toast.error('Could not copy the coordinates.');
        }
    };

    const recenter = () => {
        setSelectedStation(null);
        setWatchKey((key) => key + 1);
    };

    const locationOk = status === 'live' || status === 'locating' || status === 'paused';
    const selectedMeters =
        selectedStation && fix ? haversineMeters(fix, { latitude: selectedStation.latitude!, longitude: selectedStation.longitude! }) : null;

    return (
        <Page title="My Location" description="Where you are now and the stations near you" width="wide">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
                <div className="space-y-4">
                    {/* The phone's _LocationPermissionCard. */}
                    {(status === 'denied' || status === 'unavailable') && (
                        <div className="bg-card shadow-card rounded-[18px] border p-[18px]">
                            <div className="flex items-center gap-3">
                                <IconTile
                                    icon={MdLocationOff}
                                    color={status === 'denied' ? '#F57C00' : '#EF4444'}
                                    className="size-11 rounded-[13px] [&>svg]:size-[22px]"
                                />
                                <p className="text-foreground text-[15px] font-bold">
                                    {status === 'denied' ? 'Location Access Needed' : 'Location Unavailable'}
                                </p>
                            </div>
                            <p className="text-muted-foreground mt-2.5 text-[13px] leading-[1.4]">
                                {status === 'denied'
                                    ? "Allow location for this site in your browser's address bar (the lock or location icon), then press Enable Location."
                                    : 'Your location could not be determined. Check that location services are on for this device, then try again.'}
                            </p>
                            <Button className="mt-3.5 h-11 w-full" onClick={recenter}>
                                <MdMyLocation /> {status === 'denied' ? 'Enable Location' : 'Try Again'}
                            </Button>
                        </div>
                    )}

                    {/* Map, with the phone's floating status chip and recenter button over it. */}
                    <div className="bg-card shadow-card relative overflow-hidden rounded-[18px] border">
                        <iframe
                            key={`${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}`}
                            title="Map"
                            src={mapUrl(center, fix !== null || selectedStation !== null)}
                            className="block h-[340px] w-full sm:h-[420px] lg:h-[calc(100svh-14rem)] lg:min-h-[480px] dark:invert-90"
                            loading="lazy"
                        />

                        <div className="bg-card/80 pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-white/60 px-2.5 py-1.5 shadow-sm backdrop-blur-md dark:border-white/10">
                            <span
                                className={cn('size-[7px] rounded-full', locationOk ? 'bg-[#16A34A]' : 'bg-[#FB8C00]', status === 'live' && 'animate-pulse')}
                            />
                            <span
                                className={cn(
                                    'text-[11px] leading-none font-semibold',
                                    locationOk ? 'text-[#16A34A] dark:text-[#4ADE80]' : 'text-[#E65100] dark:text-[#FFB74D]',
                                )}
                            >
                                {statusLabel}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={recenter}
                            title="Recenter on me"
                            aria-label="Recenter on me"
                            className="bg-card text-primary hover:bg-accent absolute right-3 bottom-9 flex size-12 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-colors"
                        >
                            {status === 'live' && !selectedStation ? (
                                <MdMyLocation className="size-[22px]" />
                            ) : (
                                <MdLocationSearching className={cn('size-[22px]', status === 'locating' && 'animate-pulse')} />
                            )}
                        </button>

                        <p className="text-muted-foreground bg-card/85 absolute right-0 bottom-0 rounded-tl-lg px-2 py-0.5 text-[10.5px]">
                            © OpenStreetMap contributors
                        </p>
                    </div>
                </div>

                {/* The phone's _LocationDetailSheet: below the map on phones, a side column on desktop. */}
                <div className="bg-card shadow-card rounded-[18px] border px-5 pt-5 pb-6">
                    <div className="flex items-start gap-3">
                        <IconTile
                            icon={selectedStation ? MdLocalGasStation : MdPinDrop}
                            color="#2178BD"
                            className="size-11 rounded-[13px] [&>svg]:size-[22px]"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-[12.5px] font-medium">
                                {selectedStation ? 'Station' : fix ? 'Current Location' : 'Map Preview'}
                            </p>
                            <p className="text-foreground mt-0.5 line-clamp-2 text-[15.5px] font-bold break-words">
                                {selectedStation
                                    ? selectedStation.name
                                    : fix
                                      ? `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`
                                      : status === 'locating'
                                        ? 'Finding your position…'
                                        : 'Your position is not available.'}
                            </p>
                            {selectedMeters !== null ? (
                                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11.5px]">
                                    <MdNearMe className="size-[13px]" /> {formatDistance(selectedMeters)} from you
                                </p>
                            ) : (
                                fix && (
                                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11.5px]">
                                        <MdSchedule className="size-[13px]" /> Updated {timeAgo(new Date(fix.at))}
                                    </p>
                                )
                            )}
                        </div>
                        {fix && (
                            <button
                                type="button"
                                onClick={copy}
                                title="Copy coordinates"
                                aria-label="Copy coordinates"
                                className="bg-primary/8 text-primary hover:bg-primary/15 flex size-[38px] shrink-0 items-center justify-center rounded-full transition-colors"
                            >
                                <MdCopy className="size-[18px]" />
                            </button>
                        )}
                    </div>

                    <div className="mt-[18px] grid grid-cols-3 gap-2">
                        <StatChip label="Latitude" value={fix ? fix.latitude.toFixed(6) : '-'} />
                        <StatChip label="Longitude" value={fix ? fix.longitude.toFixed(6) : '-'} />
                        <StatChip label="Accuracy" value={fix ? `±${fix.accuracy.toFixed(0)}m` : '-'} />
                    </div>

                    <h2 className="text-foreground mt-[22px] mb-2.5 flex items-center gap-2 text-sm font-bold">
                        <span className="bg-brand-yellow h-3.5 w-1 shrink-0 rounded-full" aria-hidden="true" />
                        {locationOk ? 'Nearby Stations' : 'Stations'}
                    </h2>
                    {myStations.isLoading ? (
                        <div className="flex justify-center py-3" aria-busy="true" aria-label="Loading stations">
                            <span className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                    ) : myStations.error ? (
                        <p className="text-[12.5px] text-red-600 dark:text-red-400">{myStations.error}</p>
                    ) : nearby.length === 0 ? (
                        <EmptyState icon={MdLocalGasStation} title="No stations with a map location." className="py-6" />
                    ) : (
                        <ul className="space-y-2">
                            {nearby.map(({ station, meters }) => (
                                <li key={station.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStation(station)}
                                        className={cn(
                                            'flex w-full items-center gap-2.5 rounded-xl px-3 py-[11px] text-left transition-colors',
                                            selectedStation?.id === station.id
                                                ? 'bg-primary/10 ring-primary/40 ring-1'
                                                : 'bg-[#F5F7FA] hover:bg-[#EBEFF5] dark:bg-[#2A2A2A] dark:hover:bg-[#333333]',
                                        )}
                                    >
                                        <MdLocalGasStation className="text-primary size-[18px] shrink-0" />
                                        <span className="text-foreground min-w-0 flex-1 truncate text-[13.5px] font-semibold">{station.name}</span>
                                        {meters !== null && (
                                            <span className="text-muted-foreground shrink-0 text-xs font-semibold">{formatDistance(meters)}</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Page>
    );
}

/** A compact labelled value, the phone's _StatChip. */
function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-xl bg-[#F5F7FA] px-2.5 py-2.5 sm:px-3 dark:bg-[#2A2A2A]">
            <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.3px]">{label}</p>
            <p className="text-foreground mt-[3px] truncate text-[12.5px] font-bold" title={value}>
                {value}
            </p>
        </div>
    );
}
