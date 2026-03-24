"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const response = await apiRequest<{ accessToken: string; user: SessionUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );

      if (response.user.role !== "admin") {
        setError("This login page is for admin accounts only.");
        return;
      }

      setSession(response.accessToken, response.user);
      router.push("/admin/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Admin login failed.");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <h1 className="hero-title">Sign in to the admin portal.</h1>
        <p className="hero-copy">
          This area is reserved for marketplace administration only: user access, vendor approvals, orders, and platform operations.
        </p>
      </section>

      <form className="form-card form-grid auth-form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Admin email</label>
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
          Login to Admin
        </button>
        {error && <div className="message error">{error}</div>}
        <div className="inline-actions">
          <span className="muted">Admin access only</span>
        </div>
      </form>
    </div>
  );
}
