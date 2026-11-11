export default function AppLogo() {
    return (
        <>
            <img src="/images/app-icon.png" alt="StarOil" className="aspect-square size-8 shrink-0 rounded-md object-cover" />
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold">Star Technician</span>
                <span className="text-muted-foreground truncate text-xs leading-tight">StarOil FuelOps</span>
            </div>
        </>
    );
}
