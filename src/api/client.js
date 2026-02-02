const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

const ACCESS_KEY = "accessToken";
const USER_KEY = "authUser";

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY) || null;

export const setAccessToken = (token) => {
  if (token) {
    localStorage.setItem(ACCESS_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_KEY);
  }
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
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

async function request(
  path,
  { method = "GET", body, headers, auth = false } = {}
) {
  const resolvedHeaders = buildHeaders({ body, headers, auth });
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
