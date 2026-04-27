"use client";

export function buildCurrentPageRedirectTarget() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function getCustomerLoginRedirectHref(nextPath = buildCurrentPageRedirectTarget()) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function redirectToCustomerLogin(nextPath = buildCurrentPageRedirectTarget()) {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(getCustomerLoginRedirectHref(nextPath));
}
