export const MERCHANT_HOSTNAME =
  process.env.NEXT_PUBLIC_MERCHANT_HOST?.trim() || "merchants.vishu.shop";

export const STOREFRONT_HOSTNAME =
  process.env.NEXT_PUBLIC_STOREFRONT_HOST?.trim() || "vishu.shop";

export function isMerchantHostname(hostname: string) {
  return hostname.trim().toLowerCase() === MERCHANT_HOSTNAME;
}

export function isStorefrontHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === STOREFRONT_HOSTNAME || normalized === `www.${STOREFRONT_HOSTNAME}`;
}

export function getMerchantUrl(path = "/") {
  return `https://${MERCHANT_HOSTNAME}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getStorefrontUrl(path = "/") {
  return `https://${STOREFRONT_HOSTNAME}${path.startsWith("/") ? path : `/${path}`}`;
}
