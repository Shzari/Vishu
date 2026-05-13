"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStarted = useRef(false);
  const token = searchParams.get("token");
  const email = searchParams.get("email")?.trim().toLowerCase() || "";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(
    token ? "Verifying your account..." : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

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

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>("/auth/verify/code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setMessage(response.message);
      setCode("");
      window.setTimeout(() => {
        router.replace("/login");
      }, 1400);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Verification failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (!email) {
      setError("Missing email address for verification.");
      return;
    }

    setResending(true);
    setError(null);

    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/verification/resend",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(response.message);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Could not resend the verification code.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <h1 className="hero-title">Verify your customer account.</h1>
        <p className="hero-copy">
          {token
            ? "Finish your email verification, then continue to login and start using your account."
            : "Enter the 6-digit code we sent to your email address within 10 minutes to finish creating your account."}
        </p>
      </section>

      <div className="form-card form-grid auth-form-card">
        {token ? (
          !token ? (
            <div className="message error">Missing verification token.</div>
          ) : error ? (
            <div className="message error">{error}</div>
          ) : (
            <>
              <div className="message success">{message}</div>
              <div className="muted">Redirecting to login...</div>
            </>
          )
        ) : !email ? (
          <div className="message error">Missing email address for verification.</div>
        ) : (
          <>
            <div className="muted">Verification email: {email}. Code expires in 10 minutes.</div>
            <form className="form-grid" onSubmit={handleCodeSubmit}>
              <div className="field">
                <label>Verification code</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify account"}
              </button>
            </form>
            {message ? <div className="message success">{message}</div> : null}
            {error ? <div className="message error">{error}</div> : null}
            <div className="inline-actions">
              <button
                type="button"
                className="button-secondary"
                disabled={resending}
                onClick={() => void resendCode()}
              >
                {resending ? "Sending..." : "Resend code"}
              </button>
            </div>
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
