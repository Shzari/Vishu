"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function VendorVerifyInner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your vendor account...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing verification token.");
      return;
    }

    async function verify() {
      try {
        const response = await apiRequest<{ message: string }>("/auth/vendor/verify", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        setMessage(response.message);
      } catch (verifyError) {
        setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
      }
    }

    void verify();
  }, [searchParams]);

  return (
    <div className="form-card">
      {error ? <div className="message error">{error}</div> : <div className="message success">{message}</div>}
    </div>
  );
}

export default function VendorVerifyPage() {
  return (
    <Suspense fallback={<div className="message">Loading verification link...</div>}>
      <VendorVerifyInner />
    </Suspense>
  );
}
