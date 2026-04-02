"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";

let favoriteTokenKey: string | null = null;
let favoriteIdsCache: Set<string> | null = null;
let favoriteIdsPromise: Promise<Set<string>> | null = null;

async function loadFavoriteIds(cacheKey: string, token: string) {
  if (favoriteIdsCache && favoriteTokenKey === cacheKey) {
    return favoriteIdsCache;
  }

  if (favoriteIdsPromise && favoriteTokenKey === cacheKey) {
    return favoriteIdsPromise;
  }

  favoriteTokenKey = cacheKey;
  favoriteIdsPromise = apiRequest<{
    items: {
      productId: string;
    }[];
  }>("/account/favorites", undefined, token)
    .then((response) => {
      const nextIds = new Set(response.items.map((item) => item.productId));
      favoriteIdsCache = nextIds;
      favoriteIdsPromise = null;
      return nextIds;
    })
    .catch((error) => {
      favoriteIdsPromise = null;
      throw error;
    });

  return favoriteIdsPromise;
}

function writeFavoriteIds(cacheKey: string, productIds: string[]) {
  favoriteTokenKey = cacheKey;
  favoriteIdsCache = new Set(productIds);
  favoriteIdsPromise = null;
}

export function FavoriteToggleButton({
  productId,
  className = "",
}: {
  productId: string;
  className?: string;
}) {
  const { currentRole, token, user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(true);
  const favoriteOwnerKey = user?.sub ?? token ?? "";

  useEffect(() => {
    let cancelled = false;

    if (currentRole !== "customer" || !token || !favoriteOwnerKey) {
      setIsFavorite(false);
      setAvailable(true);
      return () => {
        cancelled = true;
      };
    }

    void loadFavoriteIds(favoriteOwnerKey, token)
      .then((favorites) => {
        if (!cancelled) {
          setIsFavorite(favorites.has(productId));
          setAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, favoriteOwnerKey, productId, token]);

  if (currentRole !== "customer") {
    return null;
  }

  return (
    <button
      type="button"
      className={`favorite-toggle-button${isFavorite ? " active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      disabled={saving || !available}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!token || !favoriteOwnerKey || saving || !available) {
          return;
        }

        setSaving(true);
        void apiRequest<{
          items: {
            productId: string;
          }[];
        }>(
          `/account/favorites/${productId}`,
          {
            method: isFavorite ? "DELETE" : "POST",
          },
          token,
        )
          .then((response) => {
            const nextIds = response.items.map((item) => item.productId);
            writeFavoriteIds(favoriteOwnerKey, nextIds);
            setIsFavorite(nextIds.includes(productId));
          })
          .catch(() => {
            setAvailable(false);
          })
          .finally(() => {
            setSaving(false);
          });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.4 14.7 8.88 20.75 9.76 16.37 14.03 17.4 20.06 12 17.22 6.6 20.06 7.63 14.03 3.25 9.76 9.3 8.88 12 3.4Z"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
