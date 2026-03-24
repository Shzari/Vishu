export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "active" || normalized === "delivered"
      ? "badge"
      : normalized === "shipped"
        ? "chip"
      : normalized === "confirmed"
        ? "badge warn"
        : "badge danger";

  return <span className={className}>{status}</span>;
}
