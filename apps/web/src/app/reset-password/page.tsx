"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || message !== "Password updated successfully.") {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push("/login");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [message, router, token]);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Reset request failed.");
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

    try {
      const response = await apiRequest<{ message: string }>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(response.message);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Password reset failed.");
    }
  }

  return (
    <div className="form-card form-grid">
      <h1 className="section-title">{token ? "Set a new password" : "Request a password reset"}</h1>
      {token ? (
        <p className="muted">
          This page also activates customer accounts created after checkout once you set your password.
        </p>
      ) : null}
      {token ? (
        <form className="form-grid" onSubmit={confirmReset}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label>Type password again</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <button className="button" type="submit">
            Update password
          </button>
        </form>
      ) : (
        <form className="form-grid" onSubmit={requestReset}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="button" type="submit">
            Send reset email
          </button>
        </form>
      )}
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
      {token && message === "Password updated successfully." && (
        <div className="message">Redirecting to login...</div>
      )}
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
