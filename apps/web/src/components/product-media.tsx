interface ProductMediaProps {
  title: string;
  image?: string;
  className?: string;
  subtitle?: string;
}

export function ProductMedia({
  title,
  image,
  className,
  subtitle = "Clothing marketplace essential",
}: ProductMediaProps) {
  if (image) {
    return <img src={image} alt={title} className={className} />;
  }

  return (
    <div className={`product-fallback ${className ?? ""}`.trim()}>
      <span className="product-fallback-chip">Vishu Edit</span>
      <strong>{title}</strong>
      <p>{subtitle}</p>
    </div>
  );
}
