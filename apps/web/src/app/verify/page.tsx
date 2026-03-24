"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function VerifyInner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your account...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing verification token.");
      return;
    }

    async function verify() {
      try {
        const response = await apiRequest<{ message: string }>("/auth/verify", {
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
    <div className="auth-page">
      <section className="auth-intro">
        <h1 className="hero-title">Verify your customer account.</h1>
        <p className="hero-copy">
          Finish your email verification to unlock customer sign in and account features.
        </p>
      </section>
      <div className="form-card form-grid auth-form-card">
        {error ? <div className="message error">{error}</div> : <div className="message success">{message}</div>}
        <div className="inline-actions">
          <Link href="/login" className="button">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="message">Loading verification link...</div>}>
      <VerifyInner />
    </Suspense>
  );
}
