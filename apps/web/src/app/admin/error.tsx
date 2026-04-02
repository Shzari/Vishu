"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="admin-page-shell">
      <section className="admin-page-head">
        <div className="admin-page-copy">
          <h1 className="admin-page-title">Something went wrong</h1>
          <p className="admin-page-description">
            An unexpected error occurred in the admin panel.
          </p>
          {error.digest && (
            <p className="muted error-id">Error ID: {error.digest}</p>
          )}
        </div>
        <div className="admin-page-actions">
          <button className="button" onClick={reset}>
            Try again
          </button>
          <Link href="/admin/dashboard" className="button-secondary">
            Back to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
