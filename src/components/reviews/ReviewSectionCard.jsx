import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  Star,
  UserRound,
} from "lucide-react";
import { reviewApi } from "../../api/reviews";
import { getAccessToken } from "../../api/client";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

const PAGE_LIMIT = 4;
const INITIAL_STATS = { avgRating: 0, count: 0 };
const DATE_LOCALES = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
};

export default function ReviewSectionCard({
  targetType = "product",
  targetId,
  targetSlug,
  targetName,
}) {
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const reviewsCopy = t("reviews") || {};
  const formCopy = reviewsCopy.form || {};
  const errorCopy = reviewsCopy.errors || {};
  const listCopy = reviewsCopy.list || {};
  const displayCopy = reviewsCopy.displayName || {};
  const locale = DATE_LOCALES[lang] || DATE_LOCALES.en;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );
  const identifier = targetSlug || targetId;
  const [stats, setStats] = useState(INITIAL_STATS);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: PAGE_LIMIT,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ rating: 5, title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isAuthenticated = Boolean(getAccessToken());
  const averageRating = useMemo(() => Number(stats.avgRating || 0), [stats]);
  const totalReviews = stats.count || 0;
  const fallbackDisplayName =
    (targetType === "set"
      ? displayCopy.set || "bu set"
      : targetType === "product"
      ? displayCopy.product || "bu ürün"
      : displayCopy.item || "bu öğe") || "bu öğe";
  const targetLabel = targetName || fallbackDisplayName;
  const titleLabel = formCopy.titleLabel || "Başlık";
  const titleOptional = formCopy.titleOptional || "(opsiyonel)";
  const formatDate = useCallback(
    (value) => {
      if (!value) return "—";
      try {
        return dateFormatter.format(new Date(value));
      } catch {
        return "—";
      }
    },
    [dateFormatter]
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!identifier) {
        setError(reviewsCopy.loadError || "Bu içerik için yorumlar yüklenemedi.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setFeedback(null);
      setFormError(null);
      setHasSubmitted(false);
      try {
        const [statsData, listData] = await Promise.all([
          fetchStats(targetType, identifier),
          fetchList(targetType, identifier, { page: 1, limit: PAGE_LIMIT }),
        ]);
        if (!mounted) return;
        setStats(statsData || INITIAL_STATS);
        setReviews(listData?.reviews || []);
        setPagination(normalizePagination(listData?.pagination));
      } catch (err) {
        if (mounted) setError(extractMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [identifier, targetType, reviewsCopy.loadError]);

  const handleChangeRating = (value) =>
    setForm((p) => ({ ...p, rating: value }));
  const handleChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setFormError(null);
    setFeedback(null);

    if (!isAuthenticated) {
      setFormError(
        errorCopy.notAuthenticated || "Yorum göndermek için giriş yapın."
      );
      return;
    }

    const trimmedBody = form.body.trim();
    if (trimmedBody.length < 10) {
      setFormError(
        errorCopy.shortBody || "Yorumunuz en az 10 karakter olmalı."
      );
      return;
    }

    const ratingValue = Number(form.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setFormError(errorCopy.invalidRating || "Puan 1 ile 5 arasında olmalı.");
      return;
    }

    const payload = {
      rating: ratingValue,
      title: form.title.trim(),
      body: trimmedBody,
    };

    if (targetType === "set") {
      if (targetId) payload.setId = targetId;
      else payload.setSlug = targetSlug;
    } else {
      if (targetId) payload.productId = targetId;
      else payload.productSlug = targetSlug;
    }

    setSubmitting(true);
    try {
      await reviewApi.create(payload);
      setFeedback(
        formCopy.success || "Teşekkürler! Yorumunuz onay için gönderildi."
      );
      setHasSubmitted(true);
      setForm({ rating: ratingValue, title: "", body: "" });
    } catch (err) {
      const msg = extractMessage(err);
      if (msg.includes("already")) setHasSubmitted(true);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;
    const nextPage = (pagination?.page || 1) + 1;
    if (nextPage > (pagination?.pages || 1)) return;

    setLoadingMore(true);
    try {
      const data = await fetchList(targetType, identifier, {
        page: nextPage,
        limit: PAGE_LIMIT,
      });
      setReviews((prev) => [...prev, ...(data?.reviews || [])]);
      setPagination(normalizePagination(data?.pagination, nextPage));
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
      {/* Başlık + özet */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {reviewsCopy.heading || "Müşteri yorumları"}
            </h2>
            <p className="text-sm text-secondary">
              {formatStaticText(reviewsCopy.subheading || "Deneyimlerinizi {target} ile paylaşın.", {
                target: targetLabel,
              })}
            </p>
          </div>
        </div>
        <RatingPreview
          value={averageRating}
          count={totalReviews}
          copy={reviewsCopy}
        />
      </header>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      {/* === YORUMLAR ÜSTTE === */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-surface-light"
              />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface-light p-6 text-center text-sm text-secondary">
            {reviewsCopy.emptyPrompt ||
              "Henüz yorum yok. Görüşünüzü ilk paylaşan siz olun!"}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-xl border border-border/70 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <UserRound className="h-4 w-4 text-secondary/70" />
                      {review.user?.name || listCopy.anonymous || "Müşteri"}
                    </div>
                    <div className="text-xs text-secondary">
                      {formatDate(review.createdAt)}
                    </div>
                  </div>
                  <StaticRating value={review.rating} />
                </div>

                {review.title ? (
                  <h4 className="mt-3 text-sm font-semibold text-primary">
                    {review.title}
                  </h4>
                ) : null}

                {review.body ? (
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {review.body}
                  </p>
                ) : null}
              </article>
            ))}

            {pagination.page < pagination.pages ? (
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-hover disabled:opacity-60"
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {reviewsCopy.loadMore || "Daha fazla yorum göster"}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* === FORM ALTA ALINDI === */}
      <div className="mt-8">
        <div className="rounded-xl border border-border/60 bg-surface-light p-4">
          <h3 className="text-sm font-semibold text-primary">
            {formCopy.title || "Yorum yaz"}
          </h3>

          {!isAuthenticated ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-white p-4 text-sm text-secondary">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-accent" />
                <p>
                  {formCopy.loginPrompt ||
                    "Yorum bırakmak için lütfen giriş yapın."}{" "}
                  <Link
                    to="/account?view=login"
                    className="font-semibold text-accent hover:underline"
                  >
                    {formCopy.loginCta || "Giriş yap"}
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {formCopy.ratingLabel || "Puan"}
                </label>
                <InteractiveRating
                  value={form.rating}
                  onChange={handleChangeRating}
                  disabled={submitting || hasSubmitted}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {titleLabel}{" "}
                  {titleOptional ? (
                    <span className="text-secondary/60">{titleOptional}</span>
                  ) : null}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  disabled={submitting || hasSubmitted}
                  className="mt-1 w-full rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                  placeholder={formCopy.titlePlaceholder || "Deneyiminizi özetleyin"}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {formCopy.reviewLabel || "Yorum"}
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => handleChange("body", e.target.value)}
                  disabled={submitting || hasSubmitted}
                  className="mt-1 min-h-[120px] w-full resize-y rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                  placeholder={formatStaticText(
                    formCopy.reviewPlaceholder || "{target} hakkında beğendiğiniz noktaları anlatın...",
                    { target: targetLabel }
                  )}
                />
              </div>

              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {formError}
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {feedback}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                disabled={submitting || hasSubmitted}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {hasSubmitted
                  ? formCopy.submitted || "Yorum gönderildi"
                  : formCopy.submit || "Yorumu gönder"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* --- küçük yardımcı bileşenler & fn'ler --- */

function RatingPreview({ value, count, copy = {} }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/60 bg-white px-4 py-2 text-sm text-primary shadow-sm">
      <StaticRating value={value} />
      <span className="text-sm font-semibold text-primary">
        {value.toFixed(1)} / 5
      </span>
      <span className="text-xs text-secondary">
        {formatStaticText(copy.countLabel || "({count} yorum)", { count })}
      </span>
    </div>
  );
}

function StaticRating({ value = 0 }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const score = i + 1;
        const active = score <= filled;
        return (
          <Star
            key={score}
            className={`h-4 w-4 ${
              active ? "fill-amber-400 text-amber-400" : "text-border"
            }`}
          />
        );
      })}
    </div>
  );
}

function InteractiveRating({ value, onChange, disabled }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const score = i + 1;
        const active = score <= value;
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            disabled={disabled}
            className="transition hover:scale-105 disabled:cursor-not-allowed"
          >
            <Star
              className={`h-5 w-5 ${
                active ? "fill-amber-400 text-amber-400" : "text-border"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function normalizePagination(pagination = {}, fallbackPage = 1) {
  const page = Math.max(1, Number(pagination.page || fallbackPage || 1));
  const limit = Math.max(1, Number(pagination.limit || PAGE_LIMIT));
  const total = Math.max(0, Number(pagination.total || 0));
  const pages = Math.max(
    1,
    Number(pagination.pages || Math.ceil(total / limit) || 1)
  );
  return { page, limit, total, pages };
}

async function fetchStats(targetType, identifier) {
  if (!identifier) return INITIAL_STATS;
  if (targetType === "set") return reviewApi.setStats(identifier);
  return reviewApi.productStats(identifier);
}

async function fetchList(targetType, identifier, params) {
  if (!identifier) return { reviews: [], pagination: {} };
  if (targetType === "set")
    return reviewApi.listForSet({ idOrSlug: identifier, ...params });
  return reviewApi.listForProduct({ idOrSlug: identifier, ...params });
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen bir hata oluştu";
  if (error instanceof Error) {
    if (error.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.message) return parsed.message;
      } catch {
        /* ignore */
      }
      return error.message;
    }
  }
  return String(error);
}
