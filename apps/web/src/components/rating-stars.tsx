"use client";

interface RatingStarsProps {
  value: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  className?: string;
}

export function RatingStars({
  value,
  count,
  size = "md",
  interactive = false,
  onChange,
  showValue = true,
  className,
}: RatingStarsProps) {
  const normalizedValue =
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  const activeStars = Math.round(normalizedValue);

  return (
    <div className={["rating-stars", `rating-stars-${size}`, className].filter(Boolean).join(" ")}>
      <div className="rating-stars-icons" aria-label={describeRating(value, count)}>
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= activeStars;

          if (!interactive) {
            return (
              <span
                key={starValue}
                className={isFilled ? "rating-star filled" : "rating-star"}
                aria-hidden="true"
              >
                ★
              </span>
            );
          }

          return (
            <button
              key={starValue}
              type="button"
              className={isFilled ? "rating-star-button filled" : "rating-star-button"}
              onClick={() => onChange?.(starValue)}
              aria-label={`Rate ${starValue} out of 5`}
            >
              ★
            </button>
          );
        })}
      </div>
      {showValue ? (
        <div className="rating-stars-copy">
          <strong>{value ? value.toFixed(1) : "New"}</strong>
          {typeof count === "number" ? (
            <span>{count === 0 ? "No reviews yet" : `${count} review${count === 1 ? "" : "s"}`}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function describeRating(value: number | null, count?: number) {
  if (!value || !count) {
    return "No reviews yet";
  }

  return `${value.toFixed(1)} out of 5 stars from ${count} review${count === 1 ? "" : "s"}`;
}
