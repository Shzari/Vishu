"use client";

import { useEffect } from "react";
import { ErrorBoundaryPage } from "@/components/error-boundary-page";

export default function AccountError({
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
      description="An unexpected error occurred while loading your account."
      errorDigest={error.digest}
      backHref="/account"
      backLabel="Back to account"
      onReset={reset}
    />
  );
}
