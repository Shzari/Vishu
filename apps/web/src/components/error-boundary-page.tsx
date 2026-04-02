"use client";

import Link from "next/link";

interface ErrorBoundaryPageProps {
  title?: string;
  description?: string;
  errorDigest?: string;
  backHref: string;
  backLabel: string;
  onReset: () => void;
}

export function ErrorBoundaryPage({
  title = "Something went wrong",
  description,
  errorDigest,
  backHref,
  backLabel,
  onReset,
}: ErrorBoundaryPageProps) {
  return (
    <div className="auth-page auth-page-compact">
      <section className="auth-intro">
        <h1 className="hero-title">{title}</h1>
        {description && <p className="hero-copy">{description}</p>}
        {errorDigest && (
          <p className="muted error-id">Error ID: {errorDigest}</p>
        )}
      </section>
      <div className="inline-actions">
        <button className="button" onClick={onReset}>
          Try again
        </button>
        <Link href={backHref} className="button-secondary">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
