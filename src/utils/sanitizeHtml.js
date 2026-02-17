const DISALLOWED_BLOCK_TAGS_RE =
  /<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?>[\s\S]*?<\/\1>/gi;
const DISALLOWED_SINGLE_TAGS_RE =
  /<(script|style|iframe|object|embed|form|svg|math|meta|link|base|input|button|textarea|select)[^>]*>/gi;
const EVENT_ATTR_RE = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTR_RE = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DISALLOWED_TAGS_RE =
  /<(?!\/?(a|br|strong|em|b|i|u|p|ul|ol|li)\b)[^>]*>/gi;

const SAFE_CLASS_RE = /[^a-zA-Z0-9_\-\s]/g;

function escapeHtmlAttr(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeHref(rawHref = "") {
  const href = String(rawHref || "").trim();
  if (!href) return "#";
  const lower = href.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return "#";
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    href.startsWith("/")
  ) {
    return href;
  }
  return `https://${href}`;
}

function sanitizeAnchorTag(tag) {
  const hrefMatch = tag.match(
    /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  );
  const classMatch = tag.match(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  );

  const href = sanitizeHref(
    hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? ""
  );
  const className = String(
    classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3] ?? ""
  )
    .replace(SAFE_CLASS_RE, " ")
    .trim()
    .replace(/\s+/g, " ");

  const classAttr = className ? ` class="${escapeHtmlAttr(className)}"` : "";
  return `<a href="${escapeHtmlAttr(
    href
  )}" target="_blank" rel="noopener noreferrer nofollow"${classAttr}>`;
}

export function sanitizeRichHtml(input) {
  if (!input) return "";

  let html = String(input);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(DISALLOWED_BLOCK_TAGS_RE, "");
  html = html.replace(DISALLOWED_SINGLE_TAGS_RE, "");
  html = html.replace(EVENT_ATTR_RE, "");
  html = html.replace(STYLE_ATTR_RE, "");

  html = html.replace(/<a\b[^>]*>/gi, (tag) => sanitizeAnchorTag(tag));
  html = html.replace(/<(strong|em|b|i|u|p|ul|ol|li)\b[^>]*>/gi, "<$1>");
  html = html.replace(/<br\b[^>]*>/gi, "<br />");
  html = html.replace(DISALLOWED_TAGS_RE, "");

  return html.trim();
}
