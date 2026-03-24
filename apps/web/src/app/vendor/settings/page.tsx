"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import type { AccountSettingsProfile } from "@/lib/types";

export default function VendorSettingsPage() {
  const { token, user, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<AccountSettingsProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [subscriptionAction, setSubscriptionAction] = useState<"monthly" | "yearly" | null>(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [cardType, setCardType] = useState<"debit" | "credit">("debit");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<AccountSettingsProfile>("/account/settings", undefined, token);
      setSettings(data);
      setFullName(data.fullName ?? "");
      setEmail(data.email);
      setPhoneNumber(data.phoneNumber ?? "");
      setShopName(data.vendor?.shopName ?? "");
      setSupportEmail(data.vendor?.supportEmail ?? "");
      setSupportPhone(data.vendor?.supportPhone ?? "");
      setShopDescription(data.vendor?.shopDescription ?? "");
      setLogoUrl(data.vendor?.logoUrl ?? "");
      setBannerUrl(data.vendor?.bannerUrl ?? "");
      setBusinessAddress(data.vendor?.businessAddress ?? "");
      setReturnPolicy(data.vendor?.returnPolicy ?? "");
      setBusinessHours(data.vendor?.businessHours ?? "");
      setShippingNotes(data.vendor?.shippingNotes ?? "");
      setLowStockThreshold(String(data.vendor?.lowStockThreshold ?? 5));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vendor settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && user?.role === "vendor") {
      void loadSettings();
    }
  }, [token, user]);

  const logoPreviewUrl = useMemo(() => {
    if (!logoFile) {
      return null;
    }

    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  async function saveProfile() {
    if (!token) return;
    const emailChanged = email.trim().toLowerCase() !== settings?.email.trim().toLowerCase();
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AccountSettingsProfile>(
        "/account/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ fullName, email, phoneNumber }),
        },
        token,
      );
      setSettings(next);
      await refreshProfile();
      setMessage(
        emailChanged
          ? "Vendor profile updated. Verify your new email before your next sign in."
          : "Vendor profile updated.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vendor profile.");
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!token || !settings) return;

    try {
      setResendingVerification(true);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        "/auth/verification/resend",
        {
          method: "POST",
          body: JSON.stringify({ email: settings.email }),
        },
        token,
      );
      setMessage(response.message);
    } catch (resendError) {
      setError(
        resendError instanceof Error ? resendError.message : "Could not resend verification email.",
      );
    } finally {
      setResendingVerification(false);
    }
  }

  async function saveVendorProfile() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const body = new FormData();
      body.append("shopName", shopName);
      if (supportEmail) body.append("supportEmail", supportEmail);
      if (supportPhone) body.append("supportPhone", supportPhone);
      if (shopDescription) body.append("shopDescription", shopDescription);
      if (!logoFile && logoUrl) body.append("logoUrl", logoUrl);
      if (logoFile) body.append("logoImage", logoFile);
      if (bannerUrl) body.append("bannerUrl", bannerUrl);
      if (businessAddress) body.append("businessAddress", businessAddress);
      if (returnPolicy) body.append("returnPolicy", returnPolicy);
      if (businessHours) body.append("businessHours", businessHours);
      if (shippingNotes) body.append("shippingNotes", shippingNotes);
      body.append("lowStockThreshold", String(Number(lowStockThreshold || 0)));
      const next = await apiRequest<AccountSettingsProfile>(
        "/account/vendor-profile",
        {
          method: "PATCH",
          body,
        },
        token,
      );
      setSettings(next);
      setLogoUrl(next.vendor?.logoUrl ?? "");
      setLogoFile(null);
      await refreshProfile();
      setMessage("Vendor shop profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vendor shop profile.");
    } finally {
      setSaving(false);
    }
  }

  async function activateSubscription(planType: "monthly" | "yearly") {
    if (!token) return;

    try {
      setSubscriptionAction(planType);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AccountSettingsProfile>(
        "/account/vendor-subscription",
        {
          method: "POST",
          body: JSON.stringify({ planType }),
        },
        token,
      );
      setSettings(next);
      setMessage(
        planType === "yearly"
          ? "Yearly subscription activated. Your products stay visible for the next year."
          : "Monthly subscription activated. Your products stay visible for the next month.",
      );
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error ? subscriptionError.message : "Failed to activate subscription.");
    } finally {
      setSubscriptionAction(null);
    }
  }

  async function confirmSubscription() {
    const cleanedCardNumber = cardNumber.replace(/\s+/g, "");
    if (!cardholderName.trim()) {
      setError("Cardholder name is required.");
      return;
    }

    if (!/^\d{12,19}$/.test(cleanedCardNumber)) {
      setError("Enter a valid card number.");
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
      setError("Use expiry in MM/YY format.");
      return;
    }

    if (!/^\d{3,4}$/.test(cardCvv.trim())) {
      setError("Enter a valid card security code.");
      return;
    }

    await activateSubscription(selectedPlan);
    setSubscribeModalOpen(false);
    setCardholderName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
  }

  async function changePassword() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        "/account/password",
        {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        token,
      );
      setCurrentPassword("");
      setNewPassword("");
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <RequireRole requiredRole="vendor">
        <div className="message">Loading vendor settings...</div>
      </RequireRole>
    );
  }

  const subscription = settings.vendor?.subscription ?? {
    planType: null,
    status: "inactive" as const,
    startedAt: null,
    endsAt: null,
    source: "automatic" as const,
    monthlyPrice: 29,
    yearlyPrice: 290,
  };
  const subscriptionStatusLabel =
    subscription?.status === "active"
      ? "Active"
      : subscription?.status === "expired"
        ? "Expired"
        : "Not subscribed";
  const subscriptionEndsLabel = subscription?.endsAt
    ? new Date(subscription.endsAt).toLocaleDateString()
    : "Not scheduled";
  const automaticSubscription = settings.vendor?.automaticSubscription ?? {
    planType: null,
    status: "inactive" as const,
    startedAt: null,
    endsAt: null,
  };
  const manualOverride = settings.vendor?.manualOverride ?? null;
  const subscriptionHistory = settings.vendor?.subscriptionHistory ?? [];
  const subscriptionEndsAt = subscription.endsAt;
  const subscriptionLocked =
    subscription.status === "active" && subscriptionEndsAt !== null && new Date(subscriptionEndsAt) > new Date();
  const subscribeButtonLabel = subscriptionLocked ? "Subscription active" : "Subscribe";
  const selectedPlanPrice =
    selectedPlan === "yearly"
      ? subscription.yearlyPrice ?? 290
      : subscription.monthlyPrice ?? 29;
  const onboardingSteps = [
    {
      label: "Verify vendor email",
      done: Boolean(settings.vendor?.isVerified && settings.emailVerifiedAt),
      hint: settings.vendor?.isVerified
        ? "Done"
        : "Verify your vendor email before the shop can move forward.",
    },
    {
      label: "Wait for admin approval",
      done: Boolean(settings.vendor?.isActive),
      hint: settings.vendor?.isActive
        ? "Done"
        : "Admin must activate your vendor account before the shop can go live.",
    },
    {
      label: "Activate subscription",
      done: subscription.status === "active",
      hint:
        subscription.status === "active"
          ? "Done"
          : "Activate a monthly or yearly listing plan to make products public.",
    },
  ];
  const nextOnboardingStep = onboardingSteps.find((step) => !step.done) ?? null;
  const vendorCanGoPublic = onboardingSteps.every((step) => step.done);

  return (
    <RequireRole requiredRole="vendor">
      <div className="stack account-page">
      <section className="panel hero-panel">
        <span className="chip">Vendor Settings</span>
        <h1 className="hero-title account-hero-title">Manage vendor profile and marketplace subscription.</h1>
        <p className="hero-copy">
          Choose a monthly or yearly vendor subscription to keep your products visible on the marketplace, then manage shop details separately from customer buying flows.
        </p>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
      <div className={settings.emailVerifiedAt ? "message success" : "message error"}>
        Email status: {settings.emailVerifiedAt ? "Verified" : "Not verified"}
      </div>

      {!settings.emailVerifiedAt && (
        <div className="inline-actions">
          <button
            className="button-secondary"
            type="button"
            disabled={resendingVerification}
            onClick={() => void resendVerification()}
          >
            {resendingVerification ? "Sending..." : "Resend verification email"}
          </button>
        </div>
      )}

      <section className="form-card stack">
        <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="section-title">Vendor Onboarding</h2>
            <p className="muted">
              This is the checklist that decides whether your products can be shown publicly.
            </p>
          </div>
          <span className={vendorCanGoPublic ? "badge" : "badge warn"}>
            {vendorCanGoPublic ? "Public-ready" : "Still blocked"}
          </span>
        </div>
        <div className="mini-stats">
          {onboardingSteps.map((step) => (
            <div key={step.label} className="mini-stat">
              <strong>{step.done ? "Done" : "Pending"}</strong>
              <span className="muted">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <strong>
            {vendorCanGoPublic
              ? "Your shop can be shown publicly."
              : `Next step: ${nextOnboardingStep?.label ?? "Review your setup"}`}
          </strong>
          <p className="muted">
            {vendorCanGoPublic
              ? "Email verification, admin activation, and subscription are all complete."
              : nextOnboardingStep?.hint ?? "Complete the remaining onboarding steps to go public."}
          </p>
        </div>
      </section>

      <section className="mini-stats">
        <div className="mini-stat">
          <strong>{subscriptionStatusLabel}</strong>
          <span className="muted">Marketplace visibility</span>
        </div>
        <div className="mini-stat">
          <strong>{subscription?.planType ? subscription.planType : "No plan"}</strong>
          <span className="muted">Current plan</span>
        </div>
        <div className="mini-stat">
          <strong>{subscriptionEndsLabel}</strong>
          <span className="muted">Visible until</span>
        </div>
        <div className="mini-stat">
          <strong>{subscription?.source === "manual_override" ? "Manual override" : "Automatic"}</strong>
          <span className="muted">Control mode</span>
        </div>
        <div className="mini-stat">
          <strong>{formatCurrency(subscription?.monthlyPrice ?? 29)}</strong>
          <span className="muted">Monthly plan</span>
        </div>
        <div className="mini-stat">
          <strong>{formatCurrency(subscription?.yearlyPrice ?? 290)}</strong>
          <span className="muted">Yearly plan</span>
        </div>
      </section>

      <section className="form-card stack">
        <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 className="section-title">Marketplace Subscription</h2>
            <p className="muted">
              Keep your shop visible with one smooth subscription flow. Your normal plan stays automatic, and admin can still help manually if needed.
            </p>
          </div>
          <span className={subscription?.status === "active" ? "badge" : subscription?.status === "expired" ? "badge warn" : "badge"}>
            {subscriptionStatusLabel}
          </span>
        </div>
        <div className="subscription-compact-shell">
          <div className="subscription-compact-copy">
            <strong>{subscription.status === "active" ? "Subscription is active" : "Start your marketplace subscription"}</strong>
            <p className="muted">
              {subscriptionLocked
                ? `Your shop is already visible until ${subscriptionEndsLabel}. You can subscribe again after that date.`
                : subscription.status === "active"
                  ? `Your last subscription is marked active until ${subscriptionEndsLabel}.`
                : "Open the popup, choose monthly or yearly, and activate with a debit or credit card."}
            </p>
          </div>
          <button
            className="button subscription-compact-button"
            type="button"
            disabled={subscriptionAction !== null || subscriptionLocked}
            onClick={() => {
              setSelectedPlan(subscription.planType ?? "monthly");
              setError(null);
              setSubscribeModalOpen(true);
            }}
          >
            {subscribeButtonLabel}
          </button>
        </div>
        <div className="card">
          <strong>Current visibility window</strong>
          <p className="muted">
            {subscriptionLocked
              ? `Your products are visible until ${subscriptionEndsLabel}.`
              : "Your products stay hidden from the public shop until a subscription is activated."}
          </p>
          {subscription?.startedAt && (
            <p className="muted">Started: {new Date(subscription.startedAt).toLocaleDateString()}</p>
          )}
        </div>
        <div className="form-grid two">
          <div className="card">
            <strong>Automatic plan</strong>
            <p className="muted">
              {automaticSubscription?.planType ?? "No plan"} | {automaticSubscription?.status ?? "inactive"}
            </p>
            <p className="muted">
              {automaticSubscription?.endsAt
                ? `Base plan until ${new Date(automaticSubscription.endsAt).toLocaleDateString()}`
                : "No automatic end date"}
            </p>
          </div>
          <div className="card">
            <strong>Manual admin override</strong>
            <p className="muted">
              {manualOverride
                ? `${manualOverride.planType ?? "No plan"} | ${manualOverride.status}`
                : "No manual override applied"}
            </p>
            <p className="muted">
              {manualOverride?.endsAt
                ? `Override until ${new Date(manualOverride.endsAt).toLocaleDateString()}`
                : "Automatic plan is controlling visibility"}
            </p>
            {manualOverride?.note && <p className="muted">{manualOverride.note}</p>}
          </div>
        </div>
        <div className="stack">
          <h3 className="section-title" style={{ fontSize: "0.96rem" }}>Subscription history</h3>
          {subscriptionHistory.length ? (
            subscriptionHistory.map((entry) => (
              <div key={entry.id} className="card">
                <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{entry.planType} plan</strong>
                  <span className={entry.status === "active" ? "badge" : "badge warn"}>{entry.status}</span>
                </div>
                <p className="muted">
                  {formatCurrency(entry.amount)} | {new Date(entry.startsAt).toLocaleDateString()} to {new Date(entry.endsAt).toLocaleDateString()}
                </p>
                {(entry.adminNote || entry.adminEmail) && (
                  <p className="muted">
                    {entry.adminNote ?? "Manual admin change"}
                    {entry.adminEmail ? ` | ${entry.adminEmail}` : ""}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="empty">No subscription history yet.</div>
          )}
        </div>
      </section>

      {subscribeModalOpen && (
        <div className="product-quick-view-overlay" onClick={() => setSubscribeModalOpen(false)}>
          <div className="subscription-modal-shell" onClick={(event) => event.stopPropagation()}>
            <button
              className="product-quick-view-close"
              type="button"
              onClick={() => setSubscribeModalOpen(false)}
            >
              Close
            </button>
            <section className="subscription-modal-card">
              <div className="subscription-modal-head">
                <div>
                  <span className="chip">Vendor subscription</span>
                  <h2 className="section-title">Choose your plan and pay by card</h2>
                  <p className="muted">
                    Select monthly or yearly, then continue with a debit or credit card to keep your shop listed.
                  </p>
                </div>
                <div className="subscription-modal-price">
                  <strong>{formatCurrency(selectedPlanPrice)}</strong>
                  <span className="muted">{selectedPlan === "yearly" ? "per year" : "per month"}</span>
                </div>
              </div>
              {subscriptionLocked && (
                <div className="message">
                  Your subscription is already active until {subscriptionEndsLabel}. You can buy a new plan after it ends.
                </div>
              )}

              <div className="subscription-choice-grid">
                <label className={`subscription-choice-card ${selectedPlan === "monthly" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="planType"
                    checked={selectedPlan === "monthly"}
                    disabled={subscriptionLocked}
                    onChange={() => setSelectedPlan("monthly")}
                  />
                  <strong>Monthly</strong>
                  <span>{formatCurrency(subscription.monthlyPrice ?? 29)} every month</span>
                  <p>Flexible option if you want a lighter start.</p>
                </label>

                <label className={`subscription-choice-card ${selectedPlan === "yearly" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="planType"
                    checked={selectedPlan === "yearly"}
                    disabled={subscriptionLocked}
                    onChange={() => setSelectedPlan("yearly")}
                  />
                  <strong>Yearly</strong>
                  <span>{formatCurrency(subscription.yearlyPrice ?? 290)} every year</span>
                  <p>Best for long uninterrupted storefront visibility.</p>
                </label>
              </div>

              <div className="subscription-choice-grid subscription-choice-grid-compact">
                <label className={`subscription-choice-card ${cardType === "debit" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="cardType"
                    checked={cardType === "debit"}
                    disabled={subscriptionLocked}
                    onChange={() => setCardType("debit")}
                  />
                  <strong>Debit card</strong>
                  <span>Pay directly from your bank card</span>
                </label>

                <label className={`subscription-choice-card ${cardType === "credit" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="cardType"
                    checked={cardType === "credit"}
                    disabled={subscriptionLocked}
                    onChange={() => setCardType("credit")}
                  />
                  <strong>Credit card</strong>
                  <span>Pay with your credit line</span>
                </label>
              </div>

              <div className="form-grid two">
                <div className="field">
                  <label>Cardholder name</label>
                  <input
                    value={cardholderName}
                    disabled={subscriptionLocked}
                    onChange={(event) => setCardholderName(event.target.value)}
                    placeholder="Name on card"
                  />
                </div>
                <div className="field">
                  <label>Card number</label>
                  <input
                    inputMode="numeric"
                    value={cardNumber}
                    disabled={subscriptionLocked}
                    onChange={(event) => setCardNumber(event.target.value)}
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
              </div>

              <div className="form-grid two">
                <div className="field">
                  <label>Expiry</label>
                  <input
                    inputMode="numeric"
                    value={cardExpiry}
                    disabled={subscriptionLocked}
                    onChange={(event) => setCardExpiry(event.target.value)}
                    placeholder="MM/YY"
                  />
                </div>
                <div className="field">
                  <label>Security code</label>
                  <input
                    inputMode="numeric"
                    value={cardCvv}
                    disabled={subscriptionLocked}
                    onChange={(event) => setCardCvv(event.target.value)}
                    placeholder="CVV"
                  />
                </div>
              </div>

              <div className="subscription-modal-actions">
                <button
                  className="button-ghost"
                  type="button"
                  disabled={subscriptionAction !== null}
                  onClick={() => setSubscribeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={subscriptionAction !== null || subscriptionLocked}
                  onClick={() => void confirmSubscription()}
                >
                  {subscriptionAction ? "Processing..." : `Pay ${formatCurrency(selectedPlanPrice)} and activate`}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Account Profile</h2>
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
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </div>
          <button className="button" type="button" disabled={saving} onClick={saveProfile}>
            {saving ? "Saving..." : "Save account details"}
          </button>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Vendor Security</h2>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <button className="button" type="button" disabled={saving} onClick={changePassword}>
            {saving ? "Saving..." : "Change password"}
          </button>
        </div>
      </section>

      <section className="form-card stack">
        <div>
          <h2 className="section-title">Shop Profile</h2>
          <p className="muted">
            Update how your business is represented internally for vendor and admin workflows.
          </p>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Shop name</label>
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </div>
          <div className="field">
            <label>Support email</label>
            <input value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Support phone</label>
            <input value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} />
          </div>
          <div className="card">
            <strong>Current shop state</strong>
            <p className="muted">
              {settings.vendor?.shopName || "No shop name yet"}
            </p>
            <p className="muted">
              {settings.vendor?.supportEmail || "No support email"}
            </p>
            <p className="muted">
              {settings.vendor?.supportPhone || "No support phone"}
            </p>
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Shop logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
            <span className="muted">Upload a logo image instead of typing a link.</span>
          </div>
          <div className="field">
            <label>Banner URL</label>
            <input
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
              placeholder="https://example.com/banner.jpg"
            />
          </div>
        </div>
        {(logoPreviewUrl || logoUrl) && (
          <div className="card">
            <strong>Logo preview</strong>
            <div
              style={{
                width: "100%",
                maxWidth: "220px",
                borderRadius: "7px",
                overflow: "hidden",
                border: "1px solid var(--line)",
                background: "#fff",
              }}
            >
              <img
                src={logoPreviewUrl ?? assetUrl(logoUrl)}
                alt="Vendor logo preview"
                style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
              />
            </div>
            {logoFile && <p className="muted">{logoFile.name}</p>}
          </div>
        )}
        <div className="field">
          <label>Shop description</label>
          <textarea
            rows={5}
            value={shopDescription}
            onChange={(event) => setShopDescription(event.target.value)}
            placeholder="Short business summary, service notes, or internal shop profile description"
          />
        </div>
        <div className="field">
          <label>Business address</label>
          <textarea
            rows={3}
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            placeholder="Street, city, postal code, country"
          />
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Business hours</label>
            <textarea
              rows={3}
              value={businessHours}
              onChange={(event) => setBusinessHours(event.target.value)}
              placeholder="Mon-Fri 09:00-18:00, Sat 10:00-14:00"
            />
          </div>
          <div className="field">
            <label>Shipping notes</label>
            <textarea
              rows={3}
              value={shippingNotes}
              onChange={(event) => setShippingNotes(event.target.value)}
              placeholder="Processing time, courier notes, dispatch expectations"
            />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Low stock alert threshold</label>
            <input
              type="number"
              min={0}
              max={999}
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
              placeholder="5"
            />
          </div>
          <div className="card">
            <strong>Stock alert rule</strong>
            <p className="muted">
              Products at or below <strong>{lowStockThreshold || "0"}</strong> units will be marked as low stock and emailed only to your vendor account.
            </p>
            <p className="muted">
              Set this to <strong>0</strong> if you want to turn low stock alerts off.
            </p>
          </div>
        </div>
        <div className="field">
          <label>Return policy</label>
          <textarea
            rows={5}
            value={returnPolicy}
            onChange={(event) => setReturnPolicy(event.target.value)}
            placeholder="Return window, condition requirements, exchange notes"
          />
        </div>
        {(logoUrl || bannerUrl) && (
          <div className="card">
            <strong>Branding status</strong>
            <p className="muted">{logoUrl ? "Logo image stored" : "No logo uploaded yet"}</p>
            <p className="muted">{bannerUrl || "No banner URL"}</p>
          </div>
        )}
        <button className="button" type="button" disabled={saving} onClick={saveVendorProfile}>
          {saving ? "Saving..." : "Save shop profile"}
        </button>
      </section>

      </div>
    </RequireRole>
  );
}
