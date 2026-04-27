"use client";

import Link from "next/link";
import { useAuth, useFavorites } from "@/components/providers";
import { getCustomerLoginRedirectHref } from "@/lib/login-redirect";
import type { Product } from "@/lib/types";

interface FavoriteStarButtonProps {
  product: Product;
  className?: string;
  showLabel?: boolean;
}

export function FavoriteStarButton({
  product,
  className,
  showLabel = false,
}: FavoriteStarButtonProps) {
  const { isAuthenticated, loading } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(product.id);
  const classNames = `favorite-star-button${favorite ? " is-active" : ""}${className ? ` ${className}` : ""}`;
  const label = favorite
    ? `Remove ${product.title} from favorites`
    : `Add ${product.title} to favorites`;

  if (loading) {
    return (
      <button
        type="button"
        className={classNames}
        aria-label={label}
        aria-pressed={favorite}
        disabled
      >
        <span className="favorite-star-glyph" aria-hidden="true">
          {favorite ? "\u2605" : "\u2606"}
        </span>
        {showLabel ? <span>{favorite ? "Saved" : "Save"}</span> : null}
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={getCustomerLoginRedirectHref()}
        className={classNames}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <span className="favorite-star-glyph" aria-hidden="true">
          {favorite ? "\u2605" : "\u2606"}
        </span>
        {showLabel ? <span>{favorite ? "Saved" : "Save"}</span> : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classNames}
      aria-label={label}
      aria-pressed={favorite}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        toggleFavorite(product);
      }}
    >
      <span className="favorite-star-glyph" aria-hidden="true">
        {favorite ? "\u2605" : "\u2606"}
      </span>
      {showLabel ? <span>{favorite ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
