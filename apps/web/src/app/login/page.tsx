"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { useAuth, useLanguage } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import { getMerchantUrl, isMerchantHostname } from "@/lib/merchant-domain";
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

const loginCopy = {
  en: {
    title: "Sign in to Vishu.shop",
    merchantTitle: "Merchant login",
    intro: "Customers can place orders and vendors can manage products, photos, stock, and shop activity.",
    merchantIntro: "Sign in to manage products, photos, stock, orders, and shop activity.",
    email: "Email",
    password: "Password",
    login: "Login",
    createAccount: "Create account",
    createVendorAccount: "Create vendor account",
    vendorPortal: "Vendor portal",
    customerPortalOnly: "This login is for customers. Vendors should use the merchant portal.",
    merchantPortalOnly: "This portal is for vendors. Customers should use Vishu.shop login.",
    resetPassword: "Reset password",
    loggedIn: "Logged in successfully.",
    loginFailed: "Login failed.",
    enterEmailFirst: "Enter your email first.",
    resendVerification: "Resend verification email",
    sending: "Sending...",
    resendVerificationFailed: "Could not resend verification email.",
    otpTitle: "Enter 6-digit code",
    otpIntro: "We emailed a vendor login code. Paste or type the code and we will continue automatically.",
    otpLabel: "Login code",
    otpPlaceholder: "Enter 6-digit code",
    checkingCode: "Checking code...",
    resendCode: "Resend code",
    changeLoginDetails: "Change login details",
    startVendorLoginAgain: "Start vendor login again.",
    enterVendorCode: "Enter the 6-digit vendor login code.",
    verifyVendorCodeFailed: "Could not verify the vendor login code.",
    resendVendorCodeFailed: "Could not resend the vendor login code.",
  },
  sq: {
    title: "Hyr ne Vishu.shop",
    merchantTitle: "Hyrje per biznes",
    intro: "Klientet mund te bejne porosi dhe bizneset mund te menaxhojne produktet, fotot, stokun dhe aktivitetin e dyqanit.",
    merchantIntro: "Hyni per te menaxhuar produktet, fotot, stokun, porosite dhe aktivitetin e dyqanit.",
    email: "Email",
    password: "Fjalekalimi",
    login: "Hyr",
    createAccount: "Krijo llogari",
    createVendorAccount: "Krijo llogari biznesi",
    vendorPortal: "Portali i bizneseve",
    customerPortalOnly: "Kjo hyrje eshte per klientet. Bizneset duhet te perdorin portalin e bizneseve.",
    merchantPortalOnly: "Ky portal eshte per bizneset. Klientet duhet te perdorin hyrjen ne Vishu.shop.",
    resetPassword: "Rivendos fjalekalimin",
    loggedIn: "Hyrja u krye me sukses.",
    loginFailed: "Hyrja deshtoi.",
    enterEmailFirst: "Shkruani fillimisht emailin tuaj.",
    resendVerification: "Ridergo emailin e verifikimit",
    sending: "Duke derguar...",
    resendVerificationFailed: "Emaili i verifikimit nuk mund te ridergohej.",
    otpTitle: "Shkruani kodin 6-shifror",
    otpIntro: "Ju derguam me email kodin e hyrjes per biznesin. Vendoseni kodin dhe do te vazhdojme automatikisht.",
    otpLabel: "Kodi i hyrjes",
    otpPlaceholder: "Shkruani kodin 6-shifror",
    checkingCode: "Duke kontrolluar kodin...",
    resendCode: "Ridergo kodin",
    changeLoginDetails: "Ndrysho te dhenat e hyrjes",
    startVendorLoginAgain: "Filloni perseri hyrjen si biznes.",
    enterVendorCode: "Shkruani kodin 6-shifror te hyrjes per biznes.",
    verifyVendorCodeFailed: "Kodi i hyrjes per biznesin nuk mund te verifikohej.",
    resendVendorCodeFailed: "Kodi i hyrjes per biznesin nuk mund te ridergohej.",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentRole, isAuthenticated, loading, setSession } = useAuth();
  const { language } = useLanguage();
  const t = loginCopy[language];
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
  const [isMerchantPortal, setIsMerchantPortal] = useState(false);
  const requestedNextPath = searchParams.get("next");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsMerchantPortal(isMerchantHostname(window.location.hostname));
  }, []);

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

      if (isMerchantPortal && response.user.role !== "vendor") {
        setError(t.merchantPortalOnly);
        return;
      }

      await setSession(response.user);
      setMessage(t.loggedIn);

      if (response.user.role === "admin") router.replace("/admin/dashboard");
      else router.replace(getSafeNextPath(requestedNextPath, response.user.role));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.loginFailed);
    }
  }

  async function verifyVendorOtpCode(code: string) {
    if (!vendorOtpChallengeId) {
      setError(t.startVendorLoginAgain);
      return;
    }

    const normalizedCode = code.trim();
    if (normalizedCode.length !== 6) {
      setError(t.enterVendorCode);
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

      if (isMerchantPortal && response.user.role !== "vendor") {
        setError(t.merchantPortalOnly);
        return;
      }

      await setSession(response.user);
      setMessage(t.loggedIn);
      router.replace(getSafeNextPath(requestedNextPath, response.user.role));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t.verifyVendorCodeFailed,
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
      setError(t.startVendorLoginAgain);
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
          : t.resendVendorCodeFailed,
      );
    } finally {
      setResendingVendorOtp(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setError(t.enterEmailFirst);
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
      setError(submitError instanceof Error ? submitError.message : t.resendVerificationFailed);
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <div className="auth-page auth-page-compact" data-no-translate="true">
      {vendorOtpChallengeId && (
        <div className="account-modal-backdrop" role="presentation">
          <form className="form-card form-grid auth-form-card vendor-otp-modal" onSubmit={verifyVendorOtp}>
            <div>
              <h2 className="section-title">{t.otpTitle}</h2>
              <p className="muted">
                {t.otpIntro}
              </p>
            </div>
            <div className="field">
              <label>{t.otpLabel}</label>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t.otpPlaceholder}
                value={vendorOtpCode}
                onChange={(event) =>
                  setVendorOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}
            {verifyingVendorOtp ? <div className="message">{t.checkingCode}</div> : null}
            <div className="inline-actions">
              <button
                className="button-secondary"
                type="button"
                disabled={resendingVendorOtp}
                onClick={() => void resendVendorOtp()}
              >
                {resendingVendorOtp ? t.sending : t.resendCode}
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
                {t.changeLoginDetails}
              </button>
            </div>
          </form>
        </div>
      )}

      {!vendorOtpChallengeId && (
        <>
          <section className="auth-intro">
            <h1 className="hero-title">{isMerchantPortal ? t.merchantTitle : t.title}</h1>
            <p className="hero-copy">
              {isMerchantPortal ? t.merchantIntro : t.intro}
            </p>
          </section>

          <form className="form-card form-grid auth-form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label>{t.email}</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label>{t.password}</label>
              <PasswordField
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="button" type="submit">
              {t.login}
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
                  {resendingVerification ? t.sending : t.resendVerification}
                </button>
              </div>
            )}
            <div className="inline-actions">
              <Link
                href={isMerchantPortal ? "/register?role=vendor" : "/register"}
                className="button-ghost"
              >
                {isMerchantPortal ? t.createVendorAccount : t.createAccount}
              </Link>
              {!isMerchantPortal && (
                <Link href={getMerchantUrl("/login?portal=vendor")} className="button-ghost">
                  {t.vendorPortal}
                </Link>
              )}
              <Link href="/reset-password" className="button-ghost">
                {t.resetPassword}
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
