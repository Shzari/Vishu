"use client";

import { useFavorites } from "@/components/providers";
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(product.id);

  return (
    <button
      type="button"
      className={`favorite-star-button${favorite ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-label={
        favorite
          ? `Remove ${product.title} from favorites`
          : `Add ${product.title} to favorites`
      }
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
