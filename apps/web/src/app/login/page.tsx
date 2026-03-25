"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ accessToken: string; user: SessionUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );

      setSession(response.accessToken, response.user);
      setMessage("Logged in successfully.");

      if (response.user.role === "admin") router.push("/admin/dashboard");
      else if (response.user.role === "vendor") router.push("/vendor/dashboard");
      else router.push("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    try {
      setResendingVerification(true);
      setError(null);
      const response = await apiRequest<{ message: string }>("/auth/verification/resend", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <div className="auth-page auth-page-compact">
      <section className="auth-intro">
        <h1 className="hero-title">Sign in to your marketplace account.</h1>
        <p className="hero-copy">
          Customers can place orders, vendors can manage their products, and admins can approve shops and oversee the whole platform.
        </p>
      </section>

      <form className="form-card form-grid auth-form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="button" type="submit">
          Login
        </button>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        {error?.includes("Verify your email") && (
          <div className="inline-actions">
            <button
              type="button"
              className="button-secondary"
              disabled={resendingVerification}
              onClick={() => void resendVerification()}
            >
              {resendingVerification ? "Sending..." : "Resend verification email"}
            </button>
          </div>
        )}
        <div className="inline-actions">
          <Link href="/register" className="button-ghost">
            Create account
          </Link>
          <Link href="/reset-password" className="button-ghost">
            Reset password
          </Link>
        </div>
      </form>
    </div>
  );
}
