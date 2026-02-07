export default function LoadingOverlay({
  show,
  label = "Yükleniyor...",
  fullscreen = false,
}) {
  if (!show) return null;
  const positionClass = fullscreen
    ? "fixed inset-0"
    : "absolute inset-0 rounded-2xl border border-border";
  return (
    <div
      className={`${positionClass} z-[500] flex items-center justify-center backdrop-blur-sm bg-white/60`}
    >
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white/90 px-4 py-3 shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm font-medium text-primary">{label}</span>
      </div>
    </div>
  );
}
