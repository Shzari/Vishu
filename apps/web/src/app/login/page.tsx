"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type LoginResponse =
  | { accessToken: string; user: SessionUser }
  | {
      requiresVendorOtp: true;
      challengeId: string;
      expiresInSeconds: number;
      message: string;
    }
  | {
      requiresVendorReactivation: true;
      message: string;
    };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentRole, isAuthenticated, loading, setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [vendorOtpChallengeId, setVendorOtpChallengeId] = useState<string | null>(null);
  const [vendorOtpCode, setVendorOtpCode] = useState("");
  const [lastSubmittedVendorOtp, setLastSubmittedVendorOtp] = useState("");
  const [verifyingVendorOtp, setVerifyingVendorOtp] = useState(false);
  const [resendingVendorOtp, setResendingVendorOtp] = useState(false);
  const requestedNextPath = searchParams.get("next");

  useEffect(() => {
    if (loading || !isAuthenticated || !currentRole) {
      return;
    }

    if (currentRole === "admin") {
      router.replace("/admin/dashboard");
      return;
    }

    router.replace(getSafeNextPath(requestedNextPath, currentRole));
  }, [currentRole, isAuthenticated, loading, requestedNextPath, router]);

  useEffect(() => {
    if (
      !vendorOtpChallengeId ||
      vendorOtpCode.length !== 6 ||
      verifyingVendorOtp ||
      vendorOtpCode === lastSubmittedVendorOtp
    ) {
      return;
    }

    void verifyVendorOtpCode(vendorOtpCode);
  }, [lastSubmittedVendorOtp, vendorOtpChallengeId, vendorOtpCode, verifyingVendorOtp]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setVendorOtpCode("");

    try {
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if ("requiresVendorOtp" in response) {
        setVendorOtpChallengeId(response.challengeId);
        setLastSubmittedVendorOtp("");
        setMessage(response.message);
        return;
      }

      if ("requiresVendorReactivation" in response) {
        setMessage(response.message);
        return;
      }

      await setSession(response.user);
      setMessage("Logged in successfully.");

      if (response.user.role === "admin") router.replace("/admin/dashboard");
      else router.replace(getSafeNextPath(requestedNextPath, response.user.role));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    }
  }

  async function verifyVendorOtpCode(code: string) {
    if (!vendorOtpChallengeId) {
      setError("Start vendor login again.");
      return;
    }

    const normalizedCode = code.trim();
    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit vendor login code.");
      return;
    }

    try {
      setLastSubmittedVendorOtp(normalizedCode);
      setVerifyingVendorOtp(true);
      setError(null);
      setMessage(null);
      const response = await apiRequest<{ accessToken: string; user: SessionUser }>(
        "/auth/vendor/login/verify",
        {
          method: "POST",
          body: JSON.stringify({
            challengeId: vendorOtpChallengeId,
            code: normalizedCode,
          }),
        },
      );

      await setSession(response.user);
      setMessage("Logged in successfully.");
      router.replace(getSafeNextPath(requestedNextPath, response.user.role));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not verify the vendor login code.",
      );
    } finally {
      setVerifyingVendorOtp(false);
    }
  }

  async function verifyVendorOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyVendorOtpCode(vendorOtpCode);
  }

  async function resendVendorOtp() {
    if (!vendorOtpChallengeId) {
      setError("Start vendor login again.");
      return;
    }

    try {
      setResendingVendorOtp(true);
      setError(null);
      const response = await apiRequest<{ message: string; expiresInSeconds: number }>(
        "/auth/vendor/login/resend",
        {
          method: "POST",
          body: JSON.stringify({ challengeId: vendorOtpChallengeId }),
        },
      );
      setVendorOtpCode("");
      setLastSubmittedVendorOtp("");
      setMessage(response.message);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not resend the vendor login code.",
      );
    } finally {
      setResendingVendorOtp(false);
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
      {vendorOtpChallengeId && (
        <div className="account-modal-backdrop" role="presentation">
          <form className="form-card form-grid auth-form-card vendor-otp-modal" onSubmit={verifyVendorOtp}>
            <div>
              <h2 className="section-title">Enter 6-digit code</h2>
              <p className="muted">
                We emailed a vendor login code. Paste or type the code and we will continue automatically.
              </p>
            </div>
            <div className="field">
              <label>Login code</label>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={vendorOtpCode}
                onChange={(event) =>
                  setVendorOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}
            {verifyingVendorOtp ? <div className="message">Checking code...</div> : null}
            <div className="inline-actions">
              <button
                className="button-secondary"
                type="button"
                disabled={resendingVendorOtp}
                onClick={() => void resendVendorOtp()}
              >
                {resendingVendorOtp ? "Sending..." : "Resend code"}
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={() => {
                  setVendorOtpChallengeId(null);
                  setVendorOtpCode("");
                  setLastSubmittedVendorOtp("");
                  setMessage(null);
                  setError(null);
                }}
              >
                Change login details
              </button>
            </div>
          </form>
        </div>
      )}

      {!vendorOtpChallengeId && (
        <>
          <section className="auth-intro">
            <h1 className="hero-title">Sign in to Vishu.shop</h1>
            <p className="hero-copy">
              Customers can place orders and vendors can manage products, photos, stock, and shop activity.
            </p>
          </section>

          <form className="form-card form-grid auth-form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordField
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
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
        </>
      )}
    </div>
  );
}

function getSafeNextPath(nextPath: string | null, role: SessionUser["role"]) {
  if (role === "vendor") {
    return "/vendor/dashboard";
  }

  if (
    nextPath &&
    nextPath.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.startsWith("/admin")
  ) {
    return nextPath;
  }

  return "/";
}
