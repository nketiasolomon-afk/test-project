import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => {
    return (
        <textarea
            className={cn(
                'flex min-h-24 w-full rounded-[14px] border border-border bg-input px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground/70 focus-visible:outline-hidden focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});

Textarea.displayName = 'Textarea';

export { Textarea };
