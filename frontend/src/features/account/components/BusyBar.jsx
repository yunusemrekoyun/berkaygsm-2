export default function BusyBar({ show }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
      <div
        className="absolute inset-y-0 left-0 w-1/3 bg-accent animate-[progress_1.2s_ease-in-out_infinite]"
        style={{ maskImage: "linear-gradient(90deg, transparent, var(--color-primary))" }}
      />
      <style>{`
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
      `}</style>
    </div>
  );
}
