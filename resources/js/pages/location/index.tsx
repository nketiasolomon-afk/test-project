import { Page, Section } from '@/components/fuelops/page';
import { Pill } from '@/components/fuelops/pill';
import { StatCard } from '@/components/fuelops/stat-card';
import { EmptyState } from '@/components/fuelops/states';
import { toast } from '@/components/fuelops/toast';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { timeAgo } from '@/lib/format';
import { stations } from '@/lib/fuelops-api';
import { cn } from '@/lib/utils';
import { type StationOption } from '@/types/fuelops';
import { Copy, Crosshair, Fuel, LocateFixed, MapPin, Navigation } from '@/components/icons';
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

    return (
        <Page
            title="My Location"
            description="Where you are now and the stations near you"
            actions={
                <>
                    <Pill tone={status === 'live' ? 'green' : status === 'denied' || status === 'unavailable' ? 'red' : 'slate'}>{statusLabel}</Pill>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedStation(null);
                            setWatchKey((key) => key + 1);
                        }}
                    >
                        <LocateFixed /> Recenter on me
                    </Button>
                </>
            }
        >
            {status === 'denied' && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                    <p className="font-semibold">Location access is blocked</p>
                    <p className="text-muted-foreground">
                        Allow location for this site in your browser's address bar (the lock or location icon), then press Recenter on me.
                    </p>
                </div>
            )}
            {status === 'unavailable' && (
                <div className="rounded-xl border border-red-600/30 bg-red-600/5 p-4 text-sm">
                    Your location could not be determined. Check that location services are on for this device, then press Recenter on me.
                </div>
            )}

            <div className="overflow-hidden rounded-xl border">
                <iframe
                    key={`${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}`}
                    title="Map"
                    src={mapUrl(center, fix !== null || selectedStation !== null)}
                    className="h-[420px] w-full"
                    loading="lazy"
                />
                <p className="text-muted-foreground bg-muted px-3 py-1 text-right text-[11px]">© OpenStreetMap contributors</p>
            </div>

            <Section
                title={selectedStation ? selectedStation.name : fix ? 'Current Location' : 'Map Preview'}
                description={fix ? `Updated ${timeAgo(new Date(fix.at))}` : undefined}
                actions={
                    fix && (
                        <Button variant="outline" size="sm" onClick={copy}>
                            <Copy /> Copy
                        </Button>
                    )
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard label="Latitude" value={fix ? fix.latitude.toFixed(6) : '-'} icon={Navigation} className="[&_span.text-2xl]:text-lg" />
                    <StatCard label="Longitude" value={fix ? fix.longitude.toFixed(6) : '-'} icon={MapPin} className="[&_span.text-2xl]:text-lg" />
                    <StatCard
                        label="Accuracy"
                        value={fix ? `±${fix.accuracy.toFixed(0)}m` : '-'}
                        icon={Crosshair}
                        className="[&_span.text-2xl]:text-lg"
                    />
                </div>
            </Section>

            <Section title="Nearby Stations">
                {myStations.isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading stations...</p>
                ) : myStations.error ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{myStations.error}</p>
                ) : nearby.length === 0 ? (
                    <EmptyState icon={Fuel} title="No stations with a map location." />
                ) : (
                    <ul className="space-y-2">
                        {nearby.map(({ station, meters }) => (
                            <li key={station.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedStation(station)}
                                    className={cn(
                                        'bg-card hover:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-xs',
                                        selectedStation?.id === station.id && 'ring-primary ring-2',
                                    )}
                                >
                                    <Fuel className="text-primary size-5 shrink-0" />
                                    <span className="flex-1 text-sm font-medium">{station.name}</span>
                                    <span className="text-muted-foreground text-xs">{meters !== null ? formatDistance(meters) : ''}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </Page>
    );
}
