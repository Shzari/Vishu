"use client";

import { useEffect } from "react";
import { ErrorBoundaryPage } from "@/components/error-boundary-page";

export default function VendorError({
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
      description="An unexpected error occurred in your vendor dashboard."
      errorDigest={error.digest}
      backHref="/vendor/dashboard"
      backLabel="Back to dashboard"
      onReset={reset}
    />
  );
}
