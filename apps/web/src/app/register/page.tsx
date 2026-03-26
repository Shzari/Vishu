"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
type RegisterRole = "customer" | "vendor";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<RegisterRole>("customer");
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextRole =
      new URLSearchParams(window.location.search).get("role") === "vendor"
        ? "vendor"
        : "customer";
    setRole(nextRole);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      setSubmitting(true);

      if (role === "vendor") {
        const response = await apiRequest<{ message: string }>("/auth/vendor/register", {
          method: "POST",
          body: JSON.stringify({ shopName, fullName, email, phoneNumber, password }),
        });

        setMessage(response.message);
        setShopName("");
        setFullName("");
        setEmail("");
        setPhoneNumber("");
        setPassword("");
        window.setTimeout(() => router.push("/login"), 1400);
        return;
      }

      const response = await apiRequest<{ message: string }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ fullName, email, phoneNumber, password }),
        },
      );

      setMessage(response.message);
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      window.setTimeout(() => router.push("/login"), 1400);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="register-page">
      <section className="register-intro">
        <span className="chip">{role === "vendor" ? "Vendor registration" : "Customer registration"}</span>
        <h1 className="hero-title">
          {role === "vendor" ? "Open your shop in minutes." : "Join the storefront in minutes."}
        </h1>
        <p className="hero-copy">
          {role === "vendor"
            ? "Create a vendor account, verify your email, and wait for admin approval before listing products."
            : "Create a customer account, then activate it from your email to track orders and manage future purchases."}
        </p>
      </section>

      <form className="form-card form-grid register-form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Join as</label>
          <div className="register-role-grid">
            <button
              type="button"
              className={role === "customer" ? "register-role-card active" : "register-role-card"}
              onClick={() => setRole("customer")}
            >
              <strong>Customer</strong>
              <span>Shop and place orders</span>
            </button>
            <button
              type="button"
              className={role === "vendor" ? "register-role-card active" : "register-role-card"}
              onClick={() => setRole("vendor")}
            >
              <strong>Vendor</strong>
              <span>Open a shop and sell</span>
            </button>
          </div>
        </div>

        {role === "vendor" && (
          <div className="field">
            <label>Shop name</label>
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Full name</label>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label>Phone number</label>
          <input
            value={phoneNumber}
            placeholder="Optional"
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="button" type="submit" disabled={submitting}>
          {submitting
            ? "Creating..."
            : role === "vendor"
              ? "Create vendor account"
              : "Create account"}
        </button>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </form>
    </div>
  );
}
