import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-page auth-page-compact">
      <section className="auth-intro">
        <p style={{ fontSize: "4rem", fontWeight: 800, color: "var(--ink)", lineHeight: 1, marginBottom: "0.5rem" }}>
          404
        </p>
        <h1 className="hero-title">Page not found</h1>
        <p className="hero-copy">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </section>
      <div className="inline-actions">
        <Link href="/" className="button">
          Go home
        </Link>
        <Link href="/shops" className="button-secondary">
          Browse shops
        </Link>
      </div>
    </div>
  );
}
