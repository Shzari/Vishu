"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStarted = useRef(false);
  const [message, setMessage] = useState("Verifying your account...");
  const [error, setError] = useState<string | null>(null);
  const token = searchParams.get("token");

  useEffect(() => {
    if (hasStarted.current || !token) {
      return;
    }

    hasStarted.current = true;
    let active = true;

    async function verify() {
      try {
        const response = await apiRequest<{ message: string }>("/auth/verify", {
          method: "POST",
          body: JSON.stringify({ token }),
        });

        if (!active) {
          return;
        }

        setMessage(response.message);
        window.setTimeout(() => {
          router.replace("/login");
        }, 1800);
      } catch (verifyError) {
        if (!active) {
          return;
        }

        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Verification failed.",
        );
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <h1 className="hero-title">Verify your customer account.</h1>
        <p className="hero-copy">
          Finish your email verification, then continue to login and start using
          your account.
        </p>
      </section>

      <div className="form-card form-grid auth-form-card">
        {!token ? (
          <div className="message error">Missing verification token.</div>
        ) : error ? (
          <div className="message error">{error}</div>
        ) : (
          <>
            <div className="message success">{message}</div>
            <div className="muted">Redirecting to login...</div>
          </>
        )}

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
    <Suspense fallback={<div className="message">Loading verification...</div>}>
      <VerifyPageContent />
    </Suspense>
  );
}
