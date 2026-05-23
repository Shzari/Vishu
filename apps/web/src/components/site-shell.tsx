"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { FrontendLanguageTranslator } from "@/components/frontend-language-translator";
import { getCartItemKey, useAuth, useBranding, useCart, useFavorites, useLanguage } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import { getStorefrontUrl, isMerchantHostname } from "@/lib/merchant-domain";

interface VendorHeaderOrder {
  id: string;
  orderNumber: string;
  totalPrice: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customerName?: string | null;
  cancelRequest?: {
    status: string;
    requestedAt?: string | null;
  };
  items: {
    id: string;
    quantity: number;
    product: {
      title: string;
    };
  }[];
}

interface VendorHeaderNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  productId: string | null;
  metadata: {
    productCode?: string | null;
    stock?: number;
    threshold?: number;
  } | null;
  readAt: string | null;
  createdAt: string;
}

const shellCopy = {
  en: {
    searchLabel: "Search",
    searchPlaceholder: "Search products across the marketplace",
    searchButton: "Search",
    shop: "Shop",
    account: "Account",
    login: "Login",
    register: "Register",
    logout: "Logout",
    signOut: "Sign out",
    adminLogin: "Admin Login",
    notifications: "Notifications",
    noVendorNotifications: "No orders or stock alerts need your response.",
    viewVendorOrders: "View all orders",
    viewVendorProducts: "View products",
    cart: "Cart",
    noItems: "No items added yet",
    emptyCartTitle: "Your cart is empty.",
    emptyCartBody: "Add products to review them here before checkout.",
    close: "Close",
    remove: "Remove",
    subtotal: "Subtotal",
    checkoutNote: "Shipping and taxes are calculated at checkout.",
    browseProducts: "Browse products",
    proceedToCheckout: "Proceed to checkout",
    favorites: "Favorites",
    noSavedProducts: "No saved products yet",
    noFavoritesTitle: "No favorites yet.",
    noFavoritesBody: "Use the star on product cards to build a quick watch list.",
    viewProduct: "View product",
    openFavoritesLink: "Open favorites",
    footerDescription: "Marketplace support, policy, and service information.",
    services: "Services",
    policy: "Policy",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    adminSecure: "Secure marketplace operations",
    adminControl: "Platform control, approvals, and growth",
    openCart: (count: number) => `Open cart with ${count} item${count === 1 ? "" : "s"}`,
    cartReady: (count: number) => `${count} item${count === 1 ? "" : "s"} ready`,
    openFavoritesList: "Open favorites watch list",
    favoritesList: "Favorite products watch list",
    savedProducts: (count: number) => `${count} saved product${count === 1 ? "" : "s"}`,
    decreaseQuantity: (title: string) => `Decrease quantity for ${title}`,
    increaseQuantity: (title: string) => `Increase quantity for ${title}`,
  },
  sq: {
    searchLabel: "Kërko",
    searchPlaceholder: "Kërko produkte në të gjithë tregun",
    searchButton: "Kërko",
    shop: "Dyqani",
    account: "Llogaria",
    login: "Hyr",
    register: "Regjistrohu",
    logout: "Dil",
    signOut: "Dil",
    adminLogin: "Hyrje Admin",
    notifications: "Njoftime",
    noVendorNotifications: "Asnjë porosi nuk kërkon përgjigje.",
    viewVendorOrders: "Shiko të gjitha porositë",
    cart: "Shporta",
    noItems: "Ende nuk ka produkte",
    emptyCartTitle: "Shporta juaj është bosh.",
    emptyCartBody: "Shtoni produkte për t'i parë këtu para pagesës.",
    close: "Mbyll",
    remove: "Hiq",
    subtotal: "Nëntotali",
    checkoutNote: "Transporti dhe taksat llogariten në pagesë.",
    browseProducts: "Shfleto produktet",
    proceedToCheckout: "Vazhdo te pagesa",
    favorites: "Të preferuarat",
    noSavedProducts: "Ende nuk ka produkte të ruajtura",
    noFavoritesTitle: "Ende pa të preferuara.",
    noFavoritesBody: "Përdorni yllin te kartat e produkteve për të krijuar listën.",
    viewProduct: "Shiko produktin",
    openFavoritesLink: "Hap të preferuarat",
    footerDescription: "Mbështetje, politika dhe informacion shërbimi për tregun.",
    services: "Shërbime",
    policy: "Politika",
    privacy: "Privatësia",
    terms: "Kushtet",
    contact: "Kontakti",
    adminSecure: "Operacione të sigurta të tregut",
    adminControl: "Kontroll platforme, miratime dhe rritje",
    openCart: (count: number) => `Hap shportën me ${count} produkt${count === 1 ? "" : "e"}`,
    cartReady: (count: number) => `${count} produkt${count === 1 ? "" : "e"} gati`,
    openFavoritesList: "Hap listën e të preferuarave",
    favoritesList: "Lista e produkteve të preferuara",
    savedProducts: (count: number) => `${count} produkt${count === 1 ? "" : "e"} të ruajtura`,
    decreaseQuantity: (title: string) => `Ul sasinë për ${title}`,
    increaseQuantity: (title: string) => `Rrit sasinë për ${title}`,
  },
};

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage } = useLanguage();
  const { branding } = useBranding();
  const { currentRole, isAuthenticated, loading, logout, profile, token } = useAuth();
  const [vendorOrders, setVendorOrders] = useState<VendorHeaderOrder[]>([]);
  const [vendorSystemNotifications, setVendorSystemNotifications] = useState<
    VendorHeaderNotification[]
  >([]);
  const [vendorNotificationsOpen, setVendorNotificationsOpen] = useState(false);
  const [mobileHeaderCondensed, setMobileHeaderCondensed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMerchantPortal, setIsMerchantPortal] = useState(false);
  const {
    items,
    isCartOpen,
    openCart,
    closeCart,
    updateItemQuantity,
    removeItem,
  } = useCart();
  const {
    items: favoriteItems,
    isFavoritesOpen,
    openFavorites,
    closeFavorites,
    removeFavorite,
  } = useFavorites();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const initialHeaderSearch = searchParams.get("search") ?? "";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isVendorRoute = pathname.startsWith("/vendor");
  const isPasswordResetTokenRoute =
    pathname === "/reset-password" && Boolean(searchParams.get("token"));
  const isPublicComingSoonPage = pathname === "/" && !isMerchantPortal;
  const isVendor = !loading && currentRole === "vendor";
  const isVendorWorkspace = isVendor && isVendorRoute;
  const isCustomer = !loading && currentRole === "customer";
  const canShowLanguageToggle = !isAdminRoute;
  const shouldRunFrontendTranslator = !isAdminRoute && !isVendorRoute;
  const activeLanguage = canShowLanguageToggle ? language : "en";
  const t = shellCopy[activeLanguage];
  const canUseShoppingCart =
    !isAdminRoute &&
    !isVendorRoute &&
    !isPasswordResetTokenRoute &&
    !isMerchantPortal &&
    !isPublicComingSoonPage;
  const showGuestActions = !loading && !isAuthenticated && !isPublicComingSoonPage;
  const brandHref = isAdminRoute
    ? "/admin/dashboard"
    : isVendorWorkspace
      ? "/vendor/dashboard"
      : isMerchantPortal
        ? "/login?portal=vendor"
      : "/";
  const showMarketplaceSearch =
    !isAdminRoute &&
    !isVendorRoute &&
    !isMerchantPortal &&
    !isPublicComingSoonPage &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/verify") &&
    !pathname.startsWith("/vendor");
  const showPublicFooter =
    !isAdminRoute && !isVendorRoute && !isPasswordResetTokenRoute && !isMerchantPortal;
  const vendorHeaderName =
    profile?.vendor?.shop_name?.trim() || profile?.fullName?.trim() || "Vendor Panel";
  const vendorHeaderInitial =
    vendorHeaderName.trim().charAt(0).toUpperCase() || "V";
  const vendorHeaderLogoUrl = profile?.vendor?.logo_url
    ? assetUrl(profile.vendor.logo_url)
    : null;
  const vendorNotificationOrders = useMemo(
    () =>
      vendorOrders
        .filter(
          (order) =>
            order.status === "pending" ||
            (order.cancelRequest?.status === "requested" &&
              order.status === "pending"),
        )
        .sort((left, right) => {
          const leftPriority =
            left.cancelRequest?.status === "requested" ? 0 : 1;
          const rightPriority =
            right.cancelRequest?.status === "requested" ? 0 : 1;

          return (
            leftPriority - rightPriority ||
            new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime()
          );
        }),
    [vendorOrders],
  );
  const unreadVendorSystemNotifications = useMemo(
    () =>
      vendorSystemNotifications
        .filter((notification) => !notification.readAt)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [vendorSystemNotifications],
  );
  const vendorNotificationCount =
    vendorNotificationOrders.length + unreadVendorSystemNotifications.length;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMerchantPortal(isMerchantHostname(window.location.hostname));
    }
  }, []);

  useEffect(() => {
    closeCart();
    closeFavorites();
    setVendorNotificationsOpen(false);
    setMobileMenuOpen(false);
  }, [closeCart, closeFavorites, pathname]);

  useEffect(() => {
    if (!token || !isVendor || !isVendorRoute) {
      setVendorOrders([]);
      setVendorSystemNotifications([]);
      setVendorNotificationsOpen(false);
      return;
    }

    let cancelled = false;

    async function loadVendorOrders() {
      try {
        const [orders, notifications] = await Promise.all([
          apiRequest<VendorHeaderOrder[]>("/vendor/orders", undefined, token),
          apiRequest<VendorHeaderNotification[]>(
            "/vendor/notifications",
            undefined,
            token,
          ),
        ]);
        if (!cancelled) {
          setVendorOrders(orders);
          setVendorSystemNotifications(notifications);
        }
      } catch {
        if (!cancelled) {
          setVendorOrders([]);
          setVendorSystemNotifications([]);
        }
      }
    }

    void loadVendorOrders();
    const interval = window.setInterval(() => void loadVendorOrders(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isVendor, isVendorRoute, token]);

  useEffect(() => {
    document.documentElement.lang = activeLanguage;
  }, [activeLanguage]);

  useEffect(() => {
    let ticking = false;

    const updateMobileHeader = () => {
      const scrollTop =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setMobileHeaderCondensed(scrollTop > 80);
    };

    const requestHeaderUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateMobileHeader();
        ticking = false;
      });
    };

    updateMobileHeader();
    window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
    window.addEventListener("touchmove", requestHeaderUpdate, { passive: true });
    window.addEventListener("resize", updateMobileHeader);

    return () => {
      window.removeEventListener("scroll", requestHeaderUpdate);
      window.removeEventListener("touchmove", requestHeaderUpdate);
      window.removeEventListener("resize", updateMobileHeader);
    };
  }, []);

  useEffect(() => {
    if (!isCartOpen && !isFavoritesOpen && !mobileMenuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
        closeFavorites();
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCart, closeFavorites, isCartOpen, isFavoritesOpen, mobileMenuOpen]);

  const handleOpenCart = () => {
    closeFavorites();
    setMobileMenuOpen(false);
    openCart();
  };

  const handleOpenFavorites = () => {
    closeCart();
    setMobileMenuOpen(false);
    openFavorites();
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleToggleMobileMenu = () => {
    closeCart();
    closeFavorites();
    setMobileMenuOpen((current) => !current);
  };

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

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    closeCart();
    closeFavorites();
    setMobileMenuOpen(false);

    if (!mobileHeaderCondensed || pathname !== "/") return;

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markVendorNotificationRead = (notificationId: string) => {
    if (!token) return;
    setVendorSystemNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
          : notification,
      ),
    );
    void apiRequest(
      `/vendor/notifications/${notificationId}/read`,
      { method: "PATCH" },
      token,
    );
  };

  return (
    <div className={isAdminRoute ? "shell admin-shell" : "shell"}>
      <header
        className={
          [
            isAdminRoute
              ? isAdminLoginRoute
                ? "topbar admin-topbar admin-login-topbar"
                : "topbar admin-topbar"
              : "topbar",
            !isAdminRoute && !isVendorRoute && !isPasswordResetTokenRoute
              ? "public-mobile-topbar"
              : "",
            mobileHeaderCondensed &&
            !isAdminRoute &&
            !isVendorRoute &&
            !isPasswordResetTokenRoute
              ? "mobile-header-scrolled"
              : "",
          ]
            .filter(Boolean)
            .join(" ")
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
                : isPasswordResetTokenRoute
                  ? "topbar-inner reset-topbar-inner"
                  : "topbar-inner"
          }
        >
          <div className="brand-cluster">
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
                    ? t.adminSecure
                    : t.adminControl}
                </span>
              </Link>
            ) : isPasswordResetTokenRoute ? (
              <span className="brand compact-brand reset-brand">
                {branding.logoDataUrl ? (
                  <span className="compact-brand-logo-wrap" aria-hidden="true">
                    <img
                      className="compact-brand-logo"
                      src={branding.logoDataUrl}
                      alt=""
                    />
                  </span>
                ) : null}
                <strong className="brand-lockup">
                  <span className="brand-wordmark-wrap">
                    <span className="brand-wordmark">Vishu</span>
                    <span className="brand-suffix">.shop</span>
                  </span>
                </strong>
              </span>
            ) : (
              <Link
                href={brandHref}
                className="brand compact-brand"
                onClick={handleBrandClick}
              >
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

            {canShowLanguageToggle ? (
              <div className="language-toggle" aria-label="Choose language">
                <button
                  type="button"
                  className={language === "en" ? "active" : ""}
                  aria-pressed={language === "en"}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
                <span aria-hidden="true">/</span>
                <button
                  type="button"
                  className={language === "sq" ? "active" : ""}
                  aria-pressed={language === "sq"}
                  onClick={() => setLanguage("sq")}
                >
                  SQ
                </button>
              </div>
            ) : null}

            {isVendor ? (
              <div className="vendor-shop-toggle" aria-label="Choose vendor or shopping mode">
                <Link
                  href="/vendor/dashboard"
                  className={isVendorRoute ? "active" : ""}
                  aria-current={isVendorRoute ? "page" : undefined}
                >
                  Vendor
                </Link>
                <span aria-hidden="true">/</span>
                <Link
                  href={isMerchantPortal ? getStorefrontUrl("/") : "/"}
                  className={!isVendorRoute ? "active" : ""}
                  aria-current={!isVendorRoute ? "page" : undefined}
                >
                  Shop
                </Link>
              </div>
            ) : null}
          </div>

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
                  <span className="header-search-label">{t.searchLabel}</span>
                  <input
                    id="header-marketplace-search"
                    name="search"
                    placeholder={t.searchPlaceholder}
                    defaultValue={initialHeaderSearch}
                  />
                </label>
              </div>
              <button type="submit" className="button header-search-submit">
                {t.searchButton}
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
                  <Link href="/admin/login">{t.adminLogin}</Link>
                )}
              </>
            ) : isVendorWorkspace ? (
              <>
                <div className="vendor-header-notification-wrap">
                  <button
                    type="button"
                    className="vendor-header-notify"
                    aria-expanded={vendorNotificationsOpen}
                    onClick={() =>
                      setVendorNotificationsOpen((current) => !current)
                    }
                  >
                    <span>{t.notifications}</span>
                    {vendorNotificationCount > 0 ? (
                      <span className="vendor-header-notify-count">
                        {vendorNotificationCount}
                      </span>
                    ) : null}
                  </button>
                  {vendorNotificationsOpen ? (
                    <div className="vendor-notification-dropdown">
                      <div className="vendor-notification-dropdown-head">
                        <strong>{t.notifications}</strong>
                        {vendorNotificationCount > 0 ? (
                          <span>{vendorNotificationCount}</span>
                        ) : null}
                      </div>
                      {vendorNotificationOrders.length === 0 &&
                      unreadVendorSystemNotifications.length === 0 ? (
                        <div className="vendor-notification-empty">
                          {t.noVendorNotifications}
                        </div>
                      ) : (
                        <div className="vendor-notification-list">
                          {unreadVendorSystemNotifications
                            .slice(0, 6)
                            .map((notification) => (
                              <Link
                                key={notification.id}
                                href={notification.actionUrl || "/vendor/products"}
                                className="vendor-notification-item"
                                onClick={() =>
                                  markVendorNotificationRead(notification.id)
                                }
                              >
                                <span className="vendor-notification-order">
                                  Stock alert
                                </span>
                                <strong>{notification.title}</strong>
                                <span>{notification.body}</span>
                                {notification.metadata?.productCode ? (
                                  <em>
                                    Code {notification.metadata.productCode}
                                  </em>
                                ) : null}
                              </Link>
                            ))}
                          {vendorNotificationOrders.slice(0, 6).map((order) => (
                            <Link
                              key={order.id}
                              href="/vendor/orders"
                              className="vendor-notification-item"
                            >
                              <span className="vendor-notification-order">
                                {order.orderNumber}
                              </span>
                              <strong>
                                {order.cancelRequest?.status === "requested"
                                  ? "Cancel requested"
                                  : "New order"}
                              </strong>
                              <span>
                                {(order.customerName?.trim() || "Customer") +
                                  " · " +
                                  formatCurrency(order.totalPrice)}
                              </span>
                              <em>
                                {order.items
                                  .slice(0, 2)
                                  .map(
                                    (item) =>
                                      `${item.quantity}x ${item.product.title}`,
                                  )
                                  .join(", ")}
                              </em>
                            </Link>
                          ))}
                        </div>
                      )}
                      <Link
                        className="vendor-notification-footer"
                        href="/vendor/orders"
                      >
                        {t.viewVendorOrders}
                      </Link>
                    </div>
                  ) : null}
                </div>
                <span className="vendor-header-shop-pill">
                  <span className="vendor-header-shop-name">{vendorHeaderName}</span>
                  <span className="vendor-header-shop-avatar" aria-hidden="true">
                    {vendorHeaderLogoUrl ? (
                      <img src={vendorHeaderLogoUrl} alt="" />
                    ) : (
                      <span>{vendorHeaderInitial}</span>
                    )}
                  </span>
                </span>
              </>
            ) : (
              <>
                {!isPasswordResetTokenRoute && (
                  <Link href={isMerchantPortal ? getStorefrontUrl("/") : "/"}>
                    {t.shop}
                  </Link>
                )}
                {canUseShoppingCart && (
                  <button
                    type="button"
                    className="nav-cart-button"
                    onClick={handleOpenCart}
                    aria-label={t.openCart(cartCount)}
                  >
                    <span className="nav-cart-icon" aria-hidden="true">
                      Bag
                    </span>
                    <span className="nav-cart-count">{cartCount}</span>
                  </button>
                )}
                {isCustomer && !isPasswordResetTokenRoute && <Link href="/account">{t.account}</Link>}
                {isVendor && !isVendorRoute && !isPasswordResetTokenRoute && <Link href="/orders">Orders</Link>}
                {isCustomer && !isPasswordResetTokenRoute && (
                  <button
                    type="button"
                    className="nav-favorites-button"
                    onClick={handleOpenFavorites}
                    aria-label={t.openFavoritesList}
                  >
                    <span className="nav-favorites-star" aria-hidden="true">
                      {favoriteItems.length > 0 ? "\u2605" : "\u2606"}
                    </span>
                  </button>
                )}
                {showGuestActions && !isPasswordResetTokenRoute && pathname !== "/login" && (
                  <Link href="/login">{t.login}</Link>
                )}
                {showGuestActions && !isPasswordResetTokenRoute && pathname !== "/register" && (
                  <Link href="/register">{t.register}</Link>
                )}
              </>
            )}
            {isAuthenticated && !isPasswordResetTokenRoute && (
              <button type="button" onClick={() => void handleLogout()}>
                {isAdminRoute ? t.signOut : t.logout}
              </button>
            )}
          </nav>
          {!isAdminRoute && !isVendorRoute && !isPasswordResetTokenRoute ? (
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={handleToggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-label="Open menu"
            >
              {false ? (
                <span className="mobile-menu-arrow" aria-hidden="true">
                  ↑
                </span>
              ) : (
                <>
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                </>
              )}
            </button>
          ) : null}
          {mobileHeaderCondensed &&
          !isAdminRoute &&
          !isVendorRoute &&
          !isPasswordResetTokenRoute ? (
            <button
              type="button"
              className="mobile-scroll-top-button"
              onClick={handleScrollToTop}
              aria-label="Back to top"
            >
              ↑
            </button>
          ) : null}
        </div>
      </header>
      {mobileHeaderCondensed &&
      !isAdminRoute &&
      !isVendorRoute &&
      !isPasswordResetTokenRoute ? (
        <button
          type="button"
          className="mobile-floating-top-button"
          onClick={handleScrollToTop}
          aria-label="Back to top"
        >
          ↑
        </button>
      ) : null}
      {canUseShoppingCart ? (
        <div
          className={
            isCartOpen || isFavoritesOpen || mobileMenuOpen
              ? "mini-cart-overlay is-visible"
              : "mini-cart-overlay"
          }
          onClick={() => {
            closeCart();
            closeFavorites();
            closeMobileMenu();
          }}
          aria-hidden={!isCartOpen && !isFavoritesOpen && !mobileMenuOpen}
        >
          <aside
            className={
              mobileMenuOpen
                ? "mini-cart-drawer mobile-menu-drawer is-open"
                : "mini-cart-drawer mobile-menu-drawer"
            }
            onClick={(event) => event.stopPropagation()}
            aria-label="Menu"
          >
            <div className="mini-cart-head">
              <div className="mini-cart-title-block">
                <strong>Menu</strong>
                <span>Vishu.shop</span>
              </div>
              <button
                type="button"
                className="mini-cart-close"
                onClick={closeMobileMenu}
              >
                {t.close}
              </button>
            </div>

            <div className="mobile-menu-body">
              <Link href="/" className="mobile-menu-link" onClick={closeMobileMenu}>
                {t.shop}
              </Link>
              <button
                type="button"
                className="mobile-menu-link"
                onClick={handleOpenCart}
              >
                <span>{t.cart}</span>
                <strong>{cartCount}</strong>
              </button>
              {isCustomer ? (
                <button
                  type="button"
                  className="mobile-menu-link"
                  onClick={handleOpenFavorites}
                >
                  <span>{t.favorites}</span>
                  <strong>{favoriteItems.length}</strong>
                </button>
              ) : null}
              {isCustomer ? (
                <Link
                  href="/account"
                  className="mobile-menu-link"
                  onClick={closeMobileMenu}
                >
                  {t.account}
                </Link>
              ) : null}
              {isVendor && !isVendorRoute ? (
                <Link
                  href="/orders"
                  className="mobile-menu-link"
                  onClick={closeMobileMenu}
                >
                  Orders
                </Link>
              ) : null}
              {showGuestActions && pathname !== "/login" ? (
                <Link
                  href="/login"
                  className="mobile-menu-link"
                  onClick={closeMobileMenu}
                >
                  {t.login}
                </Link>
              ) : null}
              {showGuestActions && pathname !== "/register" ? (
                <Link
                  href="/register"
                  className="mobile-menu-link"
                  onClick={closeMobileMenu}
                >
                  {t.register}
                </Link>
              ) : null}
              {isAuthenticated ? (
                <button
                  type="button"
                  className="mobile-menu-link mobile-menu-link-danger"
                  onClick={() => void handleLogout()}
                >
                  {t.logout}
                </button>
              ) : null}
            </div>
          </aside>
          <aside
            className={
              isCartOpen ? "mini-cart-drawer is-open" : "mini-cart-drawer"
            }
            onClick={(event) => event.stopPropagation()}
            aria-label={t.cart}
          >
            <div className="mini-cart-head">
              <div className="mini-cart-title-block">
                <strong>{t.cart}</strong>
                <span>
                  {cartCount === 0
                    ? t.noItems
                    : t.cartReady(cartCount)}
                </span>
              </div>
              <button
                type="button"
                className="mini-cart-close"
                onClick={closeCart}
              >
                {t.close}
              </button>
            </div>

            <div className="mini-cart-body">
              {items.length === 0 ? (
                <div className="mini-cart-empty">
                  <strong>{t.emptyCartTitle}</strong>
                  <p>{t.emptyCartBody}</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={getCartItemKey(item)} className="mini-cart-item">
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
                              updateItemQuantity(getCartItemKey(item), item.quantity - 1)
                            }
                            aria-label={t.decreaseQuantity(item.title)}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQuantity(getCartItemKey(item), item.quantity + 1)
                            }
                            aria-label={t.increaseQuantity(item.title)}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="mini-cart-remove"
                          onClick={() => removeItem(getCartItemKey(item))}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mini-cart-summary">
              <div className="mini-cart-summary-row">
                <span>{t.subtotal}</span>
                <strong>{formatCurrency(cartSubtotal)}</strong>
              </div>
              <p className="mini-cart-note">
                {t.checkoutNote}
              </p>
              <Link
                href={items.length === 0 ? "/" : "/checkout"}
                className="button mini-cart-checkout"
                onClick={closeCart}
              >
                {items.length === 0 ? t.browseProducts : t.proceedToCheckout}
              </Link>
              {items.length > 0 ? (
                <button
                  type="button"
                  className="button-secondary mini-cart-continue"
                  onClick={closeCart}
                >
                  Continue shopping
                </button>
              ) : null}
            </div>
          </aside>
          <aside
            className={
              isFavoritesOpen
                ? "mini-cart-drawer favorites-drawer is-open"
                : "mini-cart-drawer favorites-drawer"
            }
            onClick={(event) => event.stopPropagation()}
            aria-label={t.favoritesList}
          >
            <div className="mini-cart-head">
              <div className="mini-cart-title-block">
                <strong>{t.favorites}</strong>
                <span>
                  {favoriteItems.length === 0
                    ? t.noSavedProducts
                    : t.savedProducts(favoriteItems.length)}
                </span>
              </div>
              <button
                type="button"
                className="mini-cart-close"
                onClick={closeFavorites}
              >
                {t.close}
              </button>
            </div>

            <div className="mini-cart-body">
              {favoriteItems.length === 0 ? (
                <div className="mini-cart-empty">
                  <strong>{t.noFavoritesTitle}</strong>
                  <p>{t.noFavoritesBody}</p>
                </div>
              ) : (
                favoriteItems.map((product) => {
                  const image = product.images[0];

                  return (
                    <div key={product.id} className="mini-cart-item favorites-drawer-item">
                      <Link
                        href={`/products/${product.id}`}
                        className="mini-cart-item-media"
                        onClick={closeFavorites}
                      >
                        {image ? (
                          <img
                            src={assetUrl(image)}
                            alt={product.title}
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
                            href={`/products/${product.id}`}
                            className="mini-cart-item-title"
                            onClick={closeFavorites}
                          >
                            {product.title}
                          </Link>
                          <strong className="mini-cart-item-price">
                            {formatCurrency(product.price)}
                          </strong>
                        </div>
                        <div className="mini-cart-item-meta">
                          {[product.vendor?.shopName, product.category]
                            .filter(Boolean)
                            .join(" Â· ")}
                        </div>
                        <div className="mini-cart-item-actions">
                          <Link
                            href={`/products/${product.id}`}
                            className="mini-cart-watch-link"
                            onClick={closeFavorites}
                          >
                            {t.viewProduct}
                          </Link>
                          <button
                            type="button"
                            className="mini-cart-remove"
                            onClick={() => removeFavorite(product.id)}
                          >
                            {t.remove}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mini-cart-summary">
              <Link
                href="/account?section=favorites"
                className="button mini-cart-checkout"
                onClick={closeFavorites}
              >
                {t.openFavoritesLink}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
      <main className={isAdminRoute ? "page admin-page" : "page"}>
        <FrontendLanguageTranslator
          enabled={shouldRunFrontendTranslator}
          language={activeLanguage}
        />
        {children}
      </main>
      {showPublicFooter ? (
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-brand">
              <strong>Vishu.shop</strong>
              <span>{t.footerDescription}</span>
            </div>
            <nav className="site-footer-links" aria-label="Footer navigation">
              <Link href="/services">{t.services}</Link>
              <Link href="/policy">{t.policy}</Link>
              <Link href="/privacy">{t.privacy}</Link>
              <Link href="/terms">{t.terms}</Link>
              <Link href="/contact">{t.contact}</Link>
            </nav>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
