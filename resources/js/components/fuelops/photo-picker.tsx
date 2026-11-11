import { Button } from '@/components/ui/button';
import { ImagePlus, X } from '@/components/icons';
import { useEffect, useMemo, useRef } from 'react';

/**
 * Picks photos to upload, with thumbnails. On a phone the file chooser offers the camera.
 * Controlled: keep the chosen `File[]` in the page's state.
 */
export function PhotoPicker({
    files,
    onChange,
    label = 'Add Photo',
    disabled,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    label?: string;
    disabled?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

    useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

    return (
        <div className="space-y-3">
            {files.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {files.map((file, index) => (
                        <li key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border">
                            <img src={previews[index]} alt={file.name} className="size-full object-cover" />
                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-xs font-semibold text-white">{index + 1}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onChange(files.filter((_, i) => i !== index))}
                                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                                aria-label={`Remove ${file.name}`}
                            >
                                <X className="size-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                    onChange([...files, ...Array.from(event.target.files ?? [])]);
                    event.target.value = '';
                }}
            />
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
                <ImagePlus /> {label}
            </Button>
        </div>
    );
}
