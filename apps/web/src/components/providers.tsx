"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getCookieSessionToken } from "@/lib/api";
import { redirectToCustomerLogin } from "@/lib/login-redirect";
import type {
  BrandingSettings,
  CartItem,
  Product,
  ProfileResponse,
  SessionUser,
} from "@/lib/types";

interface AuthContextValue {
  token: string | null;
  user: SessionUser | null;
  profile: ProfileResponse | null;
  currentRole: SessionUser["role"] | null;
  isAuthenticated: boolean;
  loading: boolean;
  setSession: (user: SessionUser) => Promise<void>;
  clearSession: (options?: { preserveCart?: boolean }) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface CartContextValue {
  items: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: CartItem, options?: { openCart?: boolean }) => void;
  syncItems: (items: CartItem[]) => void;
  updateItemQuantity: (itemKey: string, quantity: number) => void;
  removeItem: (itemKey: string) => void;
  clearCart: () => void;
}

interface BrandingContextValue {
  branding: BrandingSettings;
}

interface FavoritesContextValue {
  items: Product[];
  isFavoritesOpen: boolean;
  openFavorites: () => void;
  closeFavorites: () => void;
  toggleFavoritesDrawer: () => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product) => void;
  removeFavorite: (productId: string) => void;
}

export type Language = "en" | "sq";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

interface RemoteCartResponse {
  items: {
    productId: string;
    vendorId?: string | null;
    sizeId?: string | null;
    size?: string | null;
    quantity: number;
    product: {
      id: string;
      title: string;
      price: number;
      stock: number;
      images: string[];
    };
  }[];
}

interface RemoteFavoritesResponse {
  items: {
    productId: string;
    product: Product;
  }[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const CartContext = createContext<CartContextValue | undefined>(undefined);
const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);
const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const defaultBranding: BrandingSettings = {
  siteName: "Vishu.shop",
  tagline: "Unified fashion store",
  logoSvg: null,
  logoDataUrl: null,
};

export function getCartItemKey(item: Pick<CartItem, "productId" | "sizeId" | "size">) {
  return `${item.productId}:${item.sizeId ?? item.size ?? ""}`;
}

function usePersistentState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return fallback;
    }

    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallback;
    } catch {
      window.localStorage.removeItem(key);
      return fallback;
    }
  });

  useEffect(() => {
    if (state === null || state === undefined) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

export function Providers({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = usePersistentState<CartItem[]>("vishu-cart", []);
  const [favoriteItems, setFavoriteItems] = usePersistentState<Product[]>("vishu-favorites", []);
  const [language, setLanguage] = usePersistentState<Language>("vishu-language", "sq");
  const [isCartOpen, setCartOpen] = useState(false);
  const [isFavoritesOpen, setFavoritesOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const currentRole = profile?.role ?? user?.role ?? null;
  const isAuthenticated = !loading && Boolean(token && currentRole);

  const clearSession = useCallback((options?: { preserveCart?: boolean }) => {
    setToken(null);
    setUser(null);
    setProfile(null);
    if (!options?.preserveCart) {
      setItems([]);
    }
    setCartOpen(false);
    setFavoritesOpen(false);
    setCartReady(false);
    setLoading(false);
  }, [setItems]);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ message: string }>("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Local state still clears even if the network request fails.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    try {
      setLoading(true);
      const nextProfile = await apiRequest<ProfileResponse>("/auth/me");
      setProfile(nextProfile);
      setToken(getCookieSessionToken());
      setUser({
        sub: nextProfile.id,
        email: nextProfile.email,
        role: nextProfile.role,
      });
    } catch {
      clearSession({ preserveCart: true });
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const handleWindowFocus = () => {
      const suppressUntil = (window as Window & { __vishuSuppressAuthRefreshUntil?: number })
        .__vishuSuppressAuthRefreshUntil;
      if (suppressUntil && suppressUntil > Date.now()) {
        return;
      }
      void refreshProfile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const suppressUntil = (window as Window & { __vishuSuppressAuthRefreshUntil?: number })
          .__vishuSuppressAuthRefreshUntil;
        if (suppressUntil && suppressUntil > Date.now()) {
          return;
        }
        void refreshProfile();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshProfile, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      try {
        const nextBranding = await apiRequest<BrandingSettings>("/branding");
        if (!cancelled) {
          setBranding(nextBranding);
        }
      } catch {
        if (!cancelled) {
          setBranding(defaultBranding);
        }
      }
    }

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || (currentRole !== "customer" && currentRole !== "vendor")) {
      setCartReady(true);
      return;
    }

    let cancelled = false;

    async function loadRemoteCart() {
      try {
        const remoteCart = await apiRequest<RemoteCartResponse>("/cart/my", undefined, token);
        if (cancelled) return;

        setItems((current) => {
          const merged = new Map<string, CartItem>();

          for (const item of remoteCart.items) {
            const localMatch = current.find(
              (entry) =>
                entry.productId === item.productId &&
                (entry.sizeId ?? null) === (item.sizeId ?? null),
            );
            const nextItem = {
              productId: item.productId,
              vendorId: item.vendorId ?? localMatch?.vendorId ?? null,
              title: item.product.title,
              price: item.product.price,
              image: item.product.images[0],
              color: localMatch?.color ?? null,
              sizeId: item.sizeId ?? localMatch?.sizeId ?? null,
              size: item.size ?? localMatch?.size ?? null,
              quantity: item.quantity,
              stock: item.product.stock,
            };
            merged.set(getCartItemKey(nextItem), nextItem);
          }

          for (const item of current) {
            const itemKey = getCartItemKey(item);
            const existing = merged.get(itemKey);
            merged.set(itemKey, {
              ...item,
              quantity: Math.min(
                Math.max(item.quantity, existing?.quantity ?? 0),
                item.stock,
              ),
            });
          }

          return Array.from(merged.values());
        });
      } catch {
        // Keep local cart if sync fails.
      } finally {
        if (!cancelled) {
          setCartReady(true);
        }
      }
    }

    void loadRemoteCart();

    return () => {
      cancelled = true;
    };
  }, [currentRole, token, setItems]);

  useEffect(() => {
    if (!token || (currentRole !== "customer" && currentRole !== "vendor") || !cartReady) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void apiRequest(
        "/cart/my",
        {
          method: "POST",
          body: JSON.stringify({
            items: items.map((item) => ({
              productId: item.productId,
              sizeId: item.sizeId || undefined,
              quantity: item.quantity,
            })),
          }),
        },
        token,
      ).catch(() => {
        // Local cart remains usable if background sync fails.
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [cartReady, currentRole, items, token, user]);

  useEffect(() => {
    if (!token || currentRole !== "customer") {
      return;
    }

    let cancelled = false;

    async function loadRemoteFavorites() {
      try {
        const remoteFavorites = await apiRequest<RemoteFavoritesResponse>(
          "/account/favorites",
          undefined,
          token,
        );
        if (!cancelled) {
          setFavoriteItems(remoteFavorites.items.map((item) => item.product));
        }
      } catch {
        // Keep local favorites available if account sync fails.
      }
    }

    void loadRemoteFavorites();

    return () => {
      cancelled = true;
    };
  }, [currentRole, setFavoriteItems, token]);

  const openCart = useCallback(() => {
    setCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setCartOpen((current) => !current);
  }, []);

  const syncItems = useCallback(
    (nextItems: CartItem[]) => {
      setItems(nextItems);
    },
    [setItems],
  );

  const openFavorites = useCallback(() => {
    setFavoritesOpen(true);
  }, []);

  const closeFavorites = useCallback(() => {
    setFavoritesOpen(false);
  }, []);

  const toggleFavoritesDrawer = useCallback(() => {
    setFavoritesOpen((current) => !current);
  }, []);

  const authValue = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      profile,
      currentRole,
      isAuthenticated,
      loading,
      setSession: async (nextUser) => {
        setLoading(true);
        setProfile(null);
        setCartReady(false);
        setToken(getCookieSessionToken());
        setUser(nextUser);
        await refreshProfile();
      },
      clearSession,
      logout,
      refreshProfile,
    }),
    [clearSession, currentRole, isAuthenticated, loading, logout, profile, refreshProfile, token, user],
  );

  const cartValue = useMemo<CartContextValue>(
    () => ({
      items,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      syncItems,
      addItem: (item, options) => {
        if (
          currentRole === "vendor" &&
          profile?.vendor?.id &&
          item.vendorId &&
          item.vendorId === profile.vendor.id
        ) {
          return;
        }

        setItems((current) => {
          const itemKey = getCartItemKey(item);
          const existing = current.find((entry) => getCartItemKey(entry) === itemKey);
          if (!existing) {
            return [...current, item];
          }

          return current.map((entry) =>
            getCartItemKey(entry) === itemKey
              ? {
                  ...entry,
                  color: item.color ?? entry.color ?? null,
                  size: item.size ?? entry.size ?? null,
                  quantity: Math.min(entry.quantity + item.quantity, entry.stock),
                }
              : entry,
          );
        });
        if (options?.openCart !== false) {
          openCart();
        }
      },
      updateItemQuantity: (itemKey, quantity) => {
        setItems((current) =>
          current
            .map((entry) =>
              getCartItemKey(entry) === itemKey
                ? { ...entry, quantity: Math.max(1, Math.min(quantity, entry.stock)) }
                : entry,
            )
            .filter((entry) => entry.quantity > 0),
        );
      },
      removeItem: (itemKey) => {
        setItems((current) => current.filter((entry) => getCartItemKey(entry) !== itemKey));
      },
      clearCart: () => setItems([]),
    }),
    [closeCart, currentRole, isCartOpen, items, openCart, profile?.vendor?.id, setItems, syncItems, toggleCart],
  );

  const favoriteIds = useMemo(
    () => new Set(favoriteItems.map((item) => item.id)),
    [favoriteItems],
  );

  const favoritesValue = useMemo<FavoritesContextValue>(
    () => ({
      items: favoriteItems,
      isFavoritesOpen,
      openFavorites,
      closeFavorites,
      toggleFavoritesDrawer,
      isFavorite: (productId) => favoriteIds.has(productId),
      toggleFavorite: (product) => {
        if (loading) {
          return;
        }

        if (!token || currentRole !== "customer") {
          redirectToCustomerLogin();
          return;
        }

        const wasFavorite = favoriteIds.has(product.id);
        setFavoriteItems((current) => {
          if (current.some((entry) => entry.id === product.id)) {
            return current.filter((entry) => entry.id !== product.id);
          }

          return [product, ...current];
        });

        void apiRequest<RemoteFavoritesResponse>(
          `/account/favorites/${product.id}`,
          {
            method: wasFavorite ? "DELETE" : "POST",
          },
          token,
        )
          .then((remoteFavorites) => {
            setFavoriteItems(remoteFavorites.items.map((item) => item.product));
          })
          .catch(() => {
            setFavoriteItems((current) => {
              if (wasFavorite) {
                return current.some((entry) => entry.id === product.id)
                  ? current
                  : [product, ...current];
              }

              return current.filter((entry) => entry.id !== product.id);
            });
          });
      },
      removeFavorite: (productId) => {
        const previous = favoriteItems.find((entry) => entry.id === productId) ?? null;
        setFavoriteItems((current) =>
          current.filter((entry) => entry.id !== productId),
        );
        if (token && currentRole === "customer") {
          void apiRequest<RemoteFavoritesResponse>(
            `/account/favorites/${productId}`,
            { method: "DELETE" },
            token,
          )
            .then((remoteFavorites) => {
              setFavoriteItems(remoteFavorites.items.map((item) => item.product));
            })
            .catch(() => {
              if (previous) {
                setFavoriteItems((current) =>
                  current.some((entry) => entry.id === previous.id)
                    ? current
                    : [previous, ...current],
                );
              }
            });
        }
      },
    }),
    [
      closeFavorites,
      currentRole,
      favoriteIds,
      favoriteItems,
      isFavoritesOpen,
      loading,
      openFavorites,
      setFavoriteItems,
      toggleFavoritesDrawer,
      token,
    ],
  );

  const brandingValue = useMemo<BrandingContextValue>(
    () => ({
      branding,
    }),
    [branding],
  );

  const languageValue = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
    }),
    [language, setLanguage],
  );

  return (
    <BrandingContext.Provider value={brandingValue}>
      <AuthContext.Provider value={authValue}>
        <LanguageContext.Provider value={languageValue}>
          <FavoritesContext.Provider value={favoritesValue}>
            <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
          </FavoritesContext.Provider>
        </LanguageContext.Provider>
      </AuthContext.Provider>
    </BrandingContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within Providers");
  }
  return value;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within Providers");
  }
  return value;
}

export function useBranding() {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error("useBranding must be used within Providers");
  }
  return value;
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) {
    throw new Error("useFavorites must be used within Providers");
  }
  return value;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within Providers");
  }
  return value;
}
