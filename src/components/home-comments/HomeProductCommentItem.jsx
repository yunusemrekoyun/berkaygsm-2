import Avatar from "../ui/Avatar.jsx";
// import { extractAvatarUrl } from "../../features/account/helpers.js";

export default function HomeProductCommentItem({
  name,
  quote,
  rating = 5,
  // avatar,
}) {
  // Eğer avatar yoksa null gönder → Avatar hiçbir istek atmaz, fallback initials gösterir
  // const avatarSrc = avatar ? extractAvatarUrl(avatar) : null;

  return (
    <article className="glass-surface flex h-full flex-col rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
      {/* Avatar */}
      {/* <Avatar
        src={avatarSrc}
        name={name}
        alt={name}
        className="mx-auto mb-5 h-16 w-16 ring-1 ring-black/10"
        textClassName="text-lg"
      /> */}

      {/* Stars */}
      <div className="mb-4 flex items-center justify-center gap-1 text-accent">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-5 w-5 ${
              i < rating ? "fill-current" : "fill-transparent stroke-current"
            }`}
            aria-hidden="true"
          >
            <path
              strokeWidth="1.2"
              d="M10 2.5l2.39 4.84 5.34.78-3.86 3.76.91 5.31L10 14.98 4.22 17.2l.91-5.31L1.27 8.12l5.34-.78L10 2.5z"
            />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p className="mx-auto max-w-md text-balance italic leading-relaxed text-gray-600">
        “{quote}”
      </p>

      {/* Name */}
      <p className="mt-4 font-semibold text-primary">– {name}</p>
    </article>
  );
}
