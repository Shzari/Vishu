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
  setSession: (user: SessionUser) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface CartContextValue {
  items: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: CartItem) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

interface BrandingContextValue {
  branding: BrandingSettings;
}

interface FavoritesContextValue {
  items: Product[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product) => void;
  removeFavorite: (productId: string) => void;
}

interface RemoteCartResponse {
  items: {
    productId: string;
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const CartContext = createContext<CartContextValue | undefined>(undefined);
const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);
const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

const defaultBranding: BrandingSettings = {
  siteName: "Vishu.shop",
  tagline: "Unified fashion store",
  logoSvg: null,
  logoDataUrl: null,
};

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
  const [isCartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const currentRole = profile?.role ?? user?.role ?? null;
  const isAuthenticated = !loading && Boolean(token && currentRole);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setItems([]);
    setCartOpen(false);
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
      clearSession();
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
      void refreshProfile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
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
    if (!token || currentRole !== "customer") {
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
            merged.set(item.productId, {
              productId: item.productId,
              title: item.product.title,
              price: item.product.price,
              image: item.product.images[0],
              color: current.find((entry) => entry.productId === item.productId)?.color ?? null,
              size: current.find((entry) => entry.productId === item.productId)?.size ?? null,
              quantity: item.quantity,
              stock: item.product.stock,
            });
          }

          for (const item of current) {
            const existing = merged.get(item.productId);
            merged.set(item.productId, {
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
    if (!token || currentRole !== "customer" || !cartReady) {
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

  const openCart = useCallback(() => {
    setCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setCartOpen((current) => !current);
  }, []);

  const authValue = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      profile,
      currentRole,
      isAuthenticated,
      loading,
      setSession: (nextUser) => {
        setLoading(true);
        setProfile(null);
        setCartReady(false);
        setToken(getCookieSessionToken());
        setUser(nextUser);
        void refreshProfile();
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
      addItem: (item) => {
        setItems((current) => {
          const existing = current.find((entry) => entry.productId === item.productId);
          if (!existing) {
            return [...current, item];
          }

          return current.map((entry) =>
            entry.productId === item.productId
              ? {
                  ...entry,
                  color: item.color ?? entry.color ?? null,
                  size: item.size ?? entry.size ?? null,
                  quantity: Math.min(entry.quantity + item.quantity, entry.stock),
                }
              : entry,
          );
        });
        openCart();
      },
      updateItemQuantity: (productId, quantity) => {
        setItems((current) =>
          current
            .map((entry) =>
              entry.productId === productId
                ? { ...entry, quantity: Math.max(1, Math.min(quantity, entry.stock)) }
                : entry,
            )
            .filter((entry) => entry.quantity > 0),
        );
      },
      removeItem: (productId) => {
        setItems((current) => current.filter((entry) => entry.productId !== productId));
      },
      clearCart: () => setItems([]),
    }),
    [closeCart, isCartOpen, items, openCart, setItems, toggleCart],
  );

  const favoriteIds = useMemo(
    () => new Set(favoriteItems.map((item) => item.id)),
    [favoriteItems],
  );

  const favoritesValue = useMemo<FavoritesContextValue>(
    () => ({
      items: favoriteItems,
      isFavorite: (productId) => favoriteIds.has(productId),
      toggleFavorite: (product) => {
        setFavoriteItems((current) => {
          if (current.some((entry) => entry.id === product.id)) {
            return current.filter((entry) => entry.id !== product.id);
          }

          return [product, ...current];
        });
      },
      removeFavorite: (productId) => {
        setFavoriteItems((current) =>
          current.filter((entry) => entry.id !== productId),
        );
      },
    }),
    [favoriteIds, favoriteItems, setFavoriteItems],
  );

  const brandingValue = useMemo<BrandingContextValue>(
    () => ({
      branding,
    }),
    [branding],
  );

  return (
    <BrandingContext.Provider value={brandingValue}>
      <AuthContext.Provider value={authValue}>
        <FavoritesContext.Provider value={favoritesValue}>
          <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
        </FavoritesContext.Provider>
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
