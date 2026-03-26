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
import { apiRequest } from "@/lib/api";
import type { BrandingSettings, CartItem, ProfileResponse, SessionUser } from "@/lib/types";

interface AuthContextValue {
  token: string | null;
  user: SessionUser | null;
  profile: ProfileResponse | null;
  currentRole: SessionUser["role"] | null;
  isAuthenticated: boolean;
  loading: boolean;
  setSession: (token: string, user: SessionUser) => void;
  clearSession: () => void;
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

const defaultBranding: BrandingSettings = {
  siteName: "Vishu.shop",
  tagline: "Unified fashion store",
  logoSvg: null,
  logoDataUrl: null,
};

function parseStoredValue<T>(value: string | null, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  const [token, setToken] = usePersistentState<string | null>("vishu-token", null);
  const [user, setUser] = usePersistentState<SessionUser | null>("vishu-user", null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = usePersistentState<CartItem[]>("vishu-cart", []);
  const [isCartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const currentRole = profile?.role ?? user?.role ?? null;
  const isAuthenticated = !loading && Boolean(token && currentRole);

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setItems([]);
    setCartOpen(false);
    setCartReady(false);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (!token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const nextProfile = await apiRequest<ProfileResponse>("/auth/me", undefined, token);
      setProfile(nextProfile);
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
  };

  useEffect(() => {
    void refreshProfile();
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncSession = (event: StorageEvent) => {
      if (!event.key) {
        return;
      }

      if (event.key === "vishu-token") {
        setToken(parseStoredValue<string | null>(event.newValue, null));
      }

      if (event.key === "vishu-user") {
        setUser(parseStoredValue<SessionUser | null>(event.newValue, null));
      }

      if (event.key === "vishu-cart") {
        setItems(parseStoredValue<CartItem[]>(event.newValue, []));
      }
    };

    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, [setItems, setToken, setUser]);

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
      setSession: (nextToken, nextUser) => {
        setLoading(true);
        setProfile(null);
        setCartReady(false);
        setToken(nextToken);
        setUser(nextUser);
      },
      clearSession,
      refreshProfile,
    }),
    [currentRole, isAuthenticated, loading, profile, token, user],
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

  const brandingValue = useMemo<BrandingContextValue>(
    () => ({
      branding,
    }),
    [branding],
  );

  return (
    <BrandingContext.Provider value={brandingValue}>
      <AuthContext.Provider value={authValue}>
        <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
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
