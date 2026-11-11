import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { type User } from '@/types';

export function UserInfo({ user, showRole = false }: { user: User; showRole?: boolean }) {
    return (
        <>
            <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                <AvatarImage src={user.profilePicUrl ?? undefined} alt={user.fullName} />
                <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                    {initials(user.fullName || user.username)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.fullName || user.username}</span>
                {showRole && <span className="text-muted-foreground truncate text-xs">{user.isClusterLeader ? 'Cluster Leader' : 'Technician'}</span>}
            </div>
        </>
    );
}
