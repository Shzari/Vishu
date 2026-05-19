import Image from "next/image";

interface ProductMediaProps {
  title: string;
  image?: string;
  className?: string;
  subtitle?: string;
  priority?: boolean;
}

export function ProductMedia({
  title,
  image,
  className,
  subtitle = "Clothing marketplace essential",
  priority = false,
}: ProductMediaProps) {
  if (image) {
    return (
      <span className={["product-media-frame", className].filter(Boolean).join(" ")}>
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="product-media-image"
        />
      </span>
    );
  }

  return (
    <div className={`product-fallback ${className ?? ""}`.trim()}>
      <span className="product-fallback-chip">Vishu Edit</span>
      <strong>{title}</strong>
      <p>{subtitle}</p>
    </div>
  );
}
