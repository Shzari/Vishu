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
      setError(
        role === "vendor"
          ? "Emri dhe mbiemri janë të detyrueshëm."
          : "First name and last name are required.",
      );
      return;
    }

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError(role === "vendor" ? "Fjalëkalimet nuk përputhen." : "Passwords do not match.");
      return;
    }

    if (role === "vendor" && !acceptedVendorTerms) {
      setError("Bizneset duhet të pranojnë rregullat, kushtet dhe vendimet e aprovimit/refundimit të Vishu.");
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : role === "vendor"
            ? "Regjistrimi dështoi."
            : "Registration failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={role === "vendor" ? "register-page register-page-vendor" : "register-page"}>
      <section className="register-intro">
        <span className="chip">{role === "vendor" ? "Regjistrim biznesi" : "Customer registration"}</span>
        <h1 className="hero-title">
          {role === "vendor" ? "Hap dyqanin tënd në pak minuta." : "Join the storefront in minutes."}
        </h1>
        <p className="hero-copy">
          {role === "vendor"
            ? "Krijo llogarinë e biznesit, verifiko emailin dhe pastaj shto produkte e menaxho dyqanin."
            : "Create a customer account and start shopping right away."}
        </p>
      </section>

      {role === "vendor" && (
        <section className="business-register-info" aria-label="About Vishu for businesses">
          <div className="business-register-main">
            <span>Rreth Vishu</span>
            <h2>Një panel marketplace për bizneset lokale të modës.</h2>
            <p>
              Vishu ndihmon bizneset të përgatisin katalog profesional online,
              të menaxhojnë fotot, stokun, porositë dhe kërkesat e klientëve
              nga një panel i qartë biznesi.
            </p>
          </div>
          <div className="business-register-points">
            <div>
              <strong>Katalog profesional</strong>
              <p>Shto produkte me foto të qarta, madhësi, ngjyra, stok dhe çmime.</p>
            </div>
            <div>
              <strong>Kontroll para publikimit</strong>
              <p>Produktet qëndrojnë të fshehura derisa të kontrollohen dhe aprovohen.</p>
            </div>
            <div>
              <strong>Mjete të qarta për porosi</strong>
              <p>Menaxho porositë, statusin e dorëzimit dhe aktivitetin e biznesit në një vend.</p>
            </div>
          </div>
        </section>
      )}

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
            <label>Emri i dyqanit</label>
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </div>
        )}

        <div className="form-grid two">
          <div className="field">
            <label>Emri</label>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="field">
            <label>Mbiemri</label>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label>{role === "vendor" ? "Numri i telefonit" : "Phone number"}</label>
          <input
            value={phoneNumber}
            placeholder={role === "vendor" ? "Opsionale" : "Optional"}
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
        </div>
        <div className="field">
          <label>{role === "vendor" ? "Fjalëkalimi" : "Password"}</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="field">
          <label>{role === "vendor" ? "Konfirmo fjalëkalimin" : "Confirm password"}</label>
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
              <strong>Pranoj kushtet dhe rregullat e Vishu për biznese.</strong>
              <small>
                E kuptoj që dyqani im duhet të ndjekë{" "}
                <Link href="/policy">Politikën e marketplace</Link>,{" "}
                <Link href="/terms">Kushtet e shërbimit</Link> dhe vendimet e aprovuara
                për klientët.
              </small>
            </span>
          </label>
        )}
        <button className="button" type="submit" disabled={submitting}>
          {submitting
            ? role === "vendor"
              ? "Duke krijuar..."
              : "Creating..."
            : role === "vendor"
              ? "Krijo llogari biznesi"
              : "Create account"}
        </button>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </form>
    </div>
  );
}
