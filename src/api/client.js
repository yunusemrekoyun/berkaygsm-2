const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

const ACCESS_KEY = "accessToken";
const USER_KEY = "authUser";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getStorage = () => (canUseStorage() ? window.localStorage : null);

export const getAccessToken = () => {
  const storage = getStorage();
  return storage ? storage.getItem(ACCESS_KEY) || null : null;
};

export const setAccessToken = (token) => {
  const storage = getStorage();
  if (!storage) return;
  if (token) {
    storage.setItem(ACCESS_KEY, token);
  } else {
    storage.removeItem(ACCESS_KEY);
  }
};

export const getUser = () => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  const storage = getStorage();
  if (!storage) return;
  if (user) {
    storage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(USER_KEY);
  }
};

function buildHeaders({ body, headers = {}, auth }) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  return {
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
    ...(auth && getAccessToken()
      ? { Authorization: `Bearer ${getAccessToken()}` }
      : {}),
    ...headers,
  };
}

const emitAdminAction = (type, detail) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("admin-action", { detail: { type, ...detail } })
    );
  } catch {
    // ignore dispatch failures
  }
};

async function request(
  path,
  { method = "GET", body, headers, auth = false } = {}
) {
  const resolvedHeaders = buildHeaders({ body, headers, auth });
  const methodUpper = String(method || "GET").toUpperCase();
  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(methodUpper);
  const actionId =
    auth && isMutating
      ? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      : null;

  if (actionId) {
    emitAdminAction("start", { id: actionId, method: methodUpper, path });
  }

  try {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: resolvedHeaders,
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
      credentials: "include",
    });
    return response;
  } finally {
    if (actionId) {
      emitAdminAction("end", { id: actionId });
    }
  }
}

let refreshPromise = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await request("/auth/refresh", { method: "POST" });
        if (!response.ok) return false;
        const data = await response.json();
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function http(
  path,
  { method = "GET", body, headers = {}, auth = false, retry = true } = {}
) {
  const response = await request(path, { method, body, headers, auth });

  if (auth && response.status === 401 && retry) {
    const ok = await refreshAccessToken();
    if (ok) {
      return http(path, { method, body, headers, auth, retry: false });
    }
  }

  if (auth && response.status === 403 && path.startsWith("/auth/me")) {
    setAccessToken(null);
    setUser(null);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204 || response.status === 205) return null;

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text().catch(() => "");
  if (!text) return null;

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value === "") return;
    search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};
