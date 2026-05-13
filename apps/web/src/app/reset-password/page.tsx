"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import { getPasswordPolicyError } from "@/lib/password-policy";
import type { SessionUser } from "@/lib/types";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, logout, setSession } = useAuth();
  const token = searchParams.get("token");
  const clearedSessionForReset = useRef(false);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackResetUrl, setFallbackResetUrl] = useState<string | null>(null);
  const [requestingReset, setRequestingReset] = useState(false);
  const passwordMismatch =
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    newPassword !== confirmPassword;
  const canSubmitNewPassword =
    Boolean(newPassword) && Boolean(confirmPassword) && !passwordMismatch;

  useEffect(() => {
    if (!token || !isAuthenticated || clearedSessionForReset.current) {
      return;
    }

    clearedSessionForReset.current = true;
    void logout();
  }, [isAuthenticated, logout, token]);

  useEffect(() => {
    if (token || message !== "Reset link has been sent.") {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push("/");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [message, router, token]);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setFallbackResetUrl(null);
    setRequestingReset(true);

    try {
      const response = await apiRequest<{
        message: string;
        resetUrl?: string;
        deliveryMethod?: "manual";
      }>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage("Reset link has been sent.");
      setFallbackResetUrl(response.resetUrl ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Reset request failed.");
    } finally {
      setRequestingReset(false);
    }
  }

  async function confirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("The two password fields do not match.");
      return;
    }

    const passwordError = getPasswordPolicyError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      const response = await apiRequest<{
        accessToken: string;
        message: string;
        user: SessionUser;
      }>(
        "/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify({ token, newPassword }),
        },
      );
      clearedSessionForReset.current = true;
      await setSession(response.user);
      setMessage(response.message);
      if (response.user.role === "admin") {
        router.replace("/admin/dashboard");
      } else if (response.user.role === "vendor") {
        router.replace("/vendor/dashboard");
      } else {
        router.replace("/account");
      }
      router.refresh();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Password reset failed.");
    }
  }

  return (
    <div className="auth-page auth-page-compact">
      <section className="auth-intro">
        <h1 className="hero-title">{token ? "New password" : "Reset password"}</h1>
      </section>
      <div className="form-card form-grid auth-form-card">
      {token ? (
        <form className="form-grid" onSubmit={confirmReset}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {passwordMismatch ? (
              <span className="message error" role="alert">
                The two passwords do not match.
              </span>
            ) : null}
          </div>
          <button className="button" type="submit" disabled={!canSubmitNewPassword}>
            Update password
          </button>
        </form>
      ) : (
        <form className="form-grid" onSubmit={requestReset}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="button" type="submit" disabled={requestingReset}>
            {requestingReset ? "Sending..." : "Send reset email"}
          </button>
        </form>
      )}
      {message && <div className="message success" role="status">{message}</div>}
      {error && <div className="message error">{error}</div>}
      {!token && fallbackResetUrl ? (
        <div className="inline-actions">
          <a className="button" href={fallbackResetUrl}>
            Continue to reset password
          </a>
        </div>
      ) : null}
      {token && message === "Password updated successfully." && (
        <div className="message">Opening your account...</div>
      )}
      {!token && message === "Reset link has been sent." && (
        <div className="message">Redirecting to shop...</div>
      )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="message">Loading reset flow...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
