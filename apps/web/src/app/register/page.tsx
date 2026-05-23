"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import { getMerchantUrl, isMerchantHostname, isStorefrontHostname } from "@/lib/merchant-domain";
import { getPasswordPolicyError } from "@/lib/password-policy";
import type { SessionUser } from "@/lib/types";
type RegisterRole = "customer" | "vendor";

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [role, setRole] = useState<RegisterRole>("customer");
  const [shopName, setShopName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedVendorTerms, setAcceptedVendorTerms] = useState(false);
  const [isMerchantPortal, setIsMerchantPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hostname = window.location.hostname;
    const onMerchantPortal = isMerchantHostname(hostname);
    const onStorefront = isStorefrontHostname(hostname);
    const requestedVendor =
      new URLSearchParams(window.location.search).get("role") === "vendor";

    setIsMerchantPortal(onMerchantPortal);

    if (onStorefront && requestedVendor) {
      window.location.href = getMerchantUrl("/register?role=vendor");
      return;
    }

    const nextRole =
      onMerchantPortal || requestedVendor
        ? "vendor"
        : "customer";
    setRole(nextRole);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (role === "vendor" && !acceptedVendorTerms) {
      setError("Vendors must accept Vishu terms, marketplace policy, and refund policy.");
      return;
    }

    try {
      setSubmitting(true);
      const normalizedPhoneNumber = phoneNumber.trim() || undefined;

      if (role === "vendor") {
        const response = await apiRequest<{ message: string }>("/auth/vendor/register", {
          method: "POST",
          body: JSON.stringify({
            shopName,
            firstName,
            lastName,
            email,
            phoneNumber: normalizedPhoneNumber,
            password,
            acceptedTerms: acceptedVendorTerms,
          }),
        });

        setMessage(response.message);
        setShopName("");
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhoneNumber("");
        setPassword("");
        setConfirmPassword("");
        setAcceptedVendorTerms(false);
        window.setTimeout(() => router.push("/login?portal=vendor"), 1400);
        return;
      }

      const response = await apiRequest<{
        accessToken: string;
        user: SessionUser;
        message: string;
      }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            phoneNumber: normalizedPhoneNumber,
            password,
          }),
        },
      );

      await setSession(response.user);
      setMessage(response.message);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setConfirmPassword("");
      setAcceptedVendorTerms(false);
      window.setTimeout(() => {
        router.push("/");
      }, 500);
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
            ? "Create a vendor account, verify your email, then sign in to add products and manage your shop."
            : "Create a customer account and start shopping right away."}
        </p>
      </section>

      <form className="form-card form-grid register-form-card" onSubmit={handleSubmit}>
        {!isMerchantPortal && (
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
              <a
                className="register-role-card"
                href={getMerchantUrl("/register?role=vendor")}
              >
                <strong>Vendor</strong>
                <span>Open a shop and sell</span>
              </a>
            </div>
          </div>
        )}

        {role === "vendor" && (
          <div className="field">
            <label>Shop name</label>
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </div>
        )}

        <div className="form-grid two">
          <div className="field">
            <label>First name</label>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
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
        <div className="field">
          <label>Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {role === "vendor" && (
          <label className="account-checkbox-row register-policy-check">
            <input
              type="checkbox"
              checked={acceptedVendorTerms}
              onChange={(event) => setAcceptedVendorTerms(event.target.checked)}
            />
            <span>
              <strong>I accept Vishu vendor terms and refund rules.</strong>
              <small>
                I understand that my shop must follow Vishu&apos;s{" "}
                <Link href="/policy">Marketplace Policy</Link>,{" "}
                <Link href="/terms">Terms of Service</Link>, and approved customer
                refund decisions.
              </small>
            </span>
          </label>
        )}
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
