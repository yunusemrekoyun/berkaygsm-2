"use client";

const BANNER_HEIGHT = 36; // px — keep in sync with RootLayout / Header offsets

export default function AnnouncementBanner({ banner }) {
  if (!banner?.isEnabled || !banner?.text) return null;

  const { text, bgColor, textColor } = banner;

  // Repeat the text so the scroll loop is seamless — the animation moves
  // the inner strip by exactly 50% (one copy width), then restarts.
  const copies = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="mx-12 inline-block shrink-0 select-none">
      {text}
    </span>
  ));

  return (
    <>
      <style>{`
        @keyframes announcement-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .announcement-track {
          animation: announcement-scroll 28s linear infinite;
        }
        .announcement-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="fixed left-0 right-0 top-0 z-[119] overflow-hidden"
        style={{ height: BANNER_HEIGHT, backgroundColor: bgColor, color: textColor }}
        role="marquee"
        aria-label="Duyuru"
      >
        <div
          className="announcement-track flex h-full items-center whitespace-nowrap"
          style={{ width: "max-content" }}
        >
          {copies}
          {/* Second set — creates the seamless loop */}
          {copies}
        </div>
      </div>
    </>
  );
}
