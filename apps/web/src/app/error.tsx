"use client";

import { useEffect } from "react";
import { ErrorBoundaryPage } from "@/components/error-boundary-page";

export default function Error({
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
    <ErrorBoundaryPage
      description="An unexpected error occurred. Try again or go back to the homepage."
      errorDigest={error.digest}
      backHref="/"
      backLabel="Go home"
      onReset={reset}
    />
  );
}
