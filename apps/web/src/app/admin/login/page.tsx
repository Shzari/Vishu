"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useBranding } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding } = useBranding();
  const { currentRole, isAuthenticated, loading, logout, setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logoSrc = branding.logoDataUrl ?? "/vishu-tab-logo.png";
  const requestedNextPath = searchParams.get("next");

  useEffect(() => {
    if (loading || !isAuthenticated || !currentRole) {
      return;
    }

    if (currentRole === "admin") {
      router.replace(getSafeAdminNextPath(requestedNextPath));
      return;
    }

    router.replace(currentRole === "vendor" ? "/vendor/dashboard" : "/");
  }, [currentRole, isAuthenticated, loading, requestedNextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const response = await apiRequest<{
        accessToken: string;
        user: SessionUser;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (response.user.role !== "admin") {
        await logout();
        setError("This login page is for admin accounts only.");
        return;
      }

      setSession(response.user);
      router.push(getSafeAdminNextPath(requestedNextPath));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Admin login failed.",
      );
    }
  }

  return (
    <div className="auth-page auth-page-compact admin-login-page">
      <form
        className="form-card form-grid auth-form-card admin-login-form-card"
        onSubmit={handleSubmit}
      >
        <div className="admin-login-branding">
          <div className="admin-login-logo-wrap">
            <Image
              src={logoSrc}
              alt={`${branding.siteName} logo`}
              className="admin-login-logo"
              width={72}
              height={72}
              unoptimized={logoSrc.startsWith("data:")}
            />
          </div>
          <div className="admin-login-copy">
            <span className="admin-login-eyebrow">Operations Console</span>
            <h1 className="hero-title">Vishu.shop Admin</h1>
            <p className="hero-copy">
              Secure sign-in for marketplace approvals, vendor oversight, order
              control, and platform operations.
            </p>
          </div>
        </div>

        <div className="field">
          <label>Admin email</label>
          <input
            type="email"
            autoComplete="username"
            placeholder="admin@vishu.shop"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="button admin-login-submit" type="submit">
          Sign in
        </button>
        {error && <div className="message error">{error}</div>}
        <div className="admin-login-note">
          <strong>Secure access</strong>
          <span>
            Only approved Vishu.shop operators should use this console.
          </span>
        </div>
      </form>
    </div>
  );
}

function getSafeAdminNextPath(nextPath: string | null) {
  if (
    nextPath &&
    nextPath.startsWith("/admin") &&
    !nextPath.startsWith("//")
  ) {
    return nextPath;
  }

  return "/admin/dashboard";
}
