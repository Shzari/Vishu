const EXPLICIT_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const COOKIE_SESSION_TOKEN = "__cookie_session__";
const CSRF_HEADER_NAME = "X-Vishu-Csrf";
const CSRF_HEADER_VALUE = "1";

export function getApiBaseUrl() {
  if (EXPLICIT_API_BASE_URL) {
    return EXPLICIT_API_BASE_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    if (host === "vishu.shop" || host === "www.vishu.shop") {
      return "/api";
    }

    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000";
    }
  }

  return "http://localhost:3000";
}

export function assetUrl(path?: string) {
  if (!path) {
    return "";
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();

  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && token !== COOKIE_SESSION_TOKEN) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload as T;
}

export function getCookieSessionToken() {
  return COOKIE_SESSION_TOKEN;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("API returned a non-JSON response");
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
