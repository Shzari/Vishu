"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth, useBranding, useCart } from "@/components/providers";
import { assetUrl, formatCurrency } from "@/lib/api";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding } = useBranding();
  const { currentRole, isAuthenticated, loading, logout, profile } = useAuth();
  const {
    items,
    isCartOpen,
    openCart,
    closeCart,
    updateItemQuantity,
    removeItem,
  } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const initialHeaderSearch = searchParams.get("search") ?? "";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isVendorRoute = pathname.startsWith("/vendor");
  const isVendor = !loading && currentRole === "vendor";
  const isCustomer = !loading && currentRole === "customer";
  const showGuestActions = !loading && !isAuthenticated;
  const brandHref = isAdminRoute
    ? "/admin/dashboard"
    : isVendor
      ? "/vendor/dashboard"
      : "/";
  const showMarketplaceSearch =
    !isAdminRoute &&
    !isVendor &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/verify") &&
    !pathname.startsWith("/vendor");
  const vendorHeaderName =
    profile?.vendor?.shop_name?.trim() || profile?.fullName?.trim() || "Vendor Panel";

  useEffect(() => {
    closeCart();
  }, [closeCart, pathname]);

  useEffect(() => {
    if (!isCartOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCart, isCartOpen]);

  const handleLogout = async () => {
    const nextPath = currentRole === "admin" ? "/admin/login" : "/";
    await logout();
    router.replace(nextPath);
  };

  const handleMarketplaceSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const params = new URLSearchParams();
    const nextSearch = String(formData.get("search") ?? "").trim();

    if (nextSearch) {
      params.set("search", nextSearch);
    }

    router.push(`/${params.toString() ? `?${params.toString()}` : ""}`);

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.dispatchEvent(new Event("vishu-marketplace-query"));
      }, 0);
    }
  };

  return (
    <div className={isAdminRoute ? "shell admin-shell" : "shell"}>
      <header
        className={
          isAdminRoute
            ? isAdminLoginRoute
              ? "topbar admin-topbar admin-login-topbar"
              : "topbar admin-topbar"
            : "topbar"
        }
      >
        <div
          className={
            isAdminRoute
              ? isAdminLoginRoute
                ? "topbar-inner admin-topbar-inner admin-login-topbar-inner"
                : "topbar-inner admin-topbar-inner"
              : isVendorRoute
                ? "topbar-inner vendor-topbar-inner"
              : "topbar-inner"
          }
        >
          {isAdminRoute ? (
            <Link
              href={brandHref}
              className={
                isAdminLoginRoute ? "brand admin-login-header-brand" : "brand"
              }
            >
              <strong>{branding.siteName} Admin</strong>
              <span>
                {isAdminLoginRoute
                  ? "Secure marketplace operations"
                  : "Platform control, approvals, and growth"}
              </span>
            </Link>
          ) : (
            <Link href={brandHref} className="brand compact-brand">
              {branding.logoDataUrl ? (
                <span className="compact-brand-logo-wrap" aria-hidden="true">
                  <img
                    className="compact-brand-logo"
                    src={branding.logoDataUrl}
                    alt={`${branding.siteName} logo`}
                  />
                </span>
              ) : null}
              <strong className="brand-lockup">
                <span className="brand-wordmark-wrap">
                  <span className="brand-wordmark">Vishu</span>
                  <span className="brand-suffix">.shop</span>
                </span>
              </strong>
            </Link>
          )}

          {showMarketplaceSearch && (
            <form
              key={`${pathname}?${searchParams.toString()}`}
              className="header-search-shell"
              onSubmit={handleMarketplaceSearch}
            >
              <div className="header-search-core">
                <label
                  className="header-search-field"
                  htmlFor="header-marketplace-search"
                >
                  <span className="header-search-label">Search</span>
                  <input
                    id="header-marketplace-search"
                    name="search"
                    placeholder="Search products across the marketplace"
                    defaultValue={initialHeaderSearch}
                  />
                </label>
              </div>
              <button type="submit" className="button header-search-submit">
                Search
              </button>
            </form>
          )}

          <nav
            className={
              isAdminRoute ? "nav admin-nav" : isVendorRoute ? "nav vendor-nav" : "nav"
            }
          >
            {isAdminRoute ? (
              <>
                {showGuestActions && pathname !== "/admin/login" && (
                  <Link href="/admin/login">Admin Login</Link>
                )}
              </>
            ) : isVendor ? (
              <>
                <button type="button" className="vendor-header-notify">
                  Notifications
                </button>
                <span className="vendor-header-shop-pill">{vendorHeaderName}</span>
              </>
            ) : (
              <>
                <Link href="/">Shop</Link>
                <button
                  type="button"
                  className="nav-cart-button"
                  onClick={openCart}
                >
                  Cart ({cartCount})
                </button>
                {isCustomer && <Link href="/account">My Account</Link>}
                {isCustomer && <Link href="/orders">My Orders</Link>}
                {showGuestActions && pathname !== "/login" && (
                  <Link href="/login">Login</Link>
                )}
                {showGuestActions && pathname !== "/register" && (
                  <Link href="/register">Register</Link>
                )}
              </>
            )}
            {isAuthenticated && (
              <button type="button" onClick={() => void handleLogout()}>
                {isAdminRoute ? "Sign out" : "Logout"}
              </button>
            )}
          </nav>
        </div>
      </header>
      {!isAdminRoute && !isVendorRoute ? (
        <div
          className={
            isCartOpen ? "mini-cart-overlay is-visible" : "mini-cart-overlay"
          }
          onClick={closeCart}
          aria-hidden={!isCartOpen}
        >
          <aside
            className={
              isCartOpen ? "mini-cart-drawer is-open" : "mini-cart-drawer"
            }
            onClick={(event) => event.stopPropagation()}
            aria-label="Shopping cart"
          >
            <div className="mini-cart-head">
              <div className="mini-cart-title-block">
                <strong>Cart</strong>
                <span>
                  {cartCount === 0
                    ? "No items added yet"
                    : `${cartCount} item${cartCount === 1 ? "" : "s"} ready`}
                </span>
              </div>
              <button
                type="button"
                className="mini-cart-close"
                onClick={closeCart}
              >
                Close
              </button>
            </div>

            <div className="mini-cart-body">
              {items.length === 0 ? (
                <div className="mini-cart-empty">
                  <strong>Your cart is empty.</strong>
                  <p>Add products to review them here before checkout.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.productId} className="mini-cart-item">
                    <Link
                      href={`/products/${item.productId}`}
                      className="mini-cart-item-media"
                      onClick={closeCart}
                    >
                      {item.image ? (
                        <img
                          src={assetUrl(item.image)}
                          alt={item.title}
                          className="mini-cart-item-image"
                        />
                      ) : (
                        <span className="mini-cart-item-placeholder">
                          Vishu
                        </span>
                      )}
                    </Link>

                    <div className="mini-cart-item-copy">
                      <div className="mini-cart-item-top">
                        <Link
                          href={`/products/${item.productId}`}
                          className="mini-cart-item-title"
                          onClick={closeCart}
                        >
                          {item.title}
                        </Link>
                        <strong className="mini-cart-item-price">
                          {formatCurrency(item.price * item.quantity)}
                        </strong>
                      </div>

                      {item.color || item.size ? (
                        <div className="mini-cart-item-meta">
                          {[item.color, item.size]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}

                      <div className="mini-cart-item-actions">
                        <div className="mini-cart-qty">
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQuantity(item.productId, item.quantity - 1)
                            }
                            aria-label={`Decrease quantity for ${item.title}`}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQuantity(item.productId, item.quantity + 1)
                            }
                            aria-label={`Increase quantity for ${item.title}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="mini-cart-remove"
                          onClick={() => removeItem(item.productId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mini-cart-summary">
              <div className="mini-cart-summary-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(cartSubtotal)}</strong>
              </div>
              <p className="mini-cart-note">
                Shipping and taxes are calculated at checkout.
              </p>
              <Link
                href={items.length === 0 ? "/" : "/checkout"}
                className="button mini-cart-checkout"
                onClick={closeCart}
              >
                {items.length === 0 ? "Browse products" : "Proceed to checkout"}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
      <main className={isAdminRoute ? "page admin-page" : "page"}>
        {children}
      </main>
    </div>
  );
}
