"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/require-role";
import { FavoriteStarButton } from "@/components/favorite-star-button";
import { useAuth, useFavorites } from "@/components/providers";
import { ProductMedia } from "@/components/product-media";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
} from "@/lib/catalog";
import type { AccountSettingsProfile, CustomerAccount, CustomerAddress, CustomerOrder } from "@/lib/types";

type AccountSectionId =
  | "overview"
  | "orders"
  | "returns"
  | "reviews"
  | "favorites"
  | "addresses"
  | "payments"
  | "support"
  | "settings";
type AddressModalState =
  | {
      mode: "create" | "edit";
      addressId?: string;
    }
  | null;

interface AddressFormState {
  label: string;
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface ProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

function splitFullName(value?: string | null) {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function joinFullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

const accountSections: {
  id: AccountSectionId;
  label: string;
  description: string;
}[] = [
  { id: "overview", label: "Overview", description: "Account summary and recent activity" },
  { id: "orders", label: "Orders", description: "Review your recent purchases" },
  { id: "returns", label: "Returns", description: "Manage product returns and exchanges" },
  { id: "reviews", label: "Reviews", description: "Rate delivered products and revisit feedback" },
  { id: "favorites", label: "Favorites", description: "Saved products you want to revisit" },
  { id: "addresses", label: "Addresses", description: "Manage saved delivery destinations" },
  { id: "payments", label: "Payments", description: "Stripe-managed cards and defaults" },
  { id: "support", label: "Support", description: "Get help with orders, delivery, and account questions" },
  { id: "settings", label: "Settings", description: "Security, preferences, and recovery" },
];

function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString("en-GB", options);
}

function formatOrderStatusLabel(status?: string | null) {
  if (!status) {
    return "Unknown";
  }

  return status
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEmailVerificationStatus(account: CustomerAccount | null) {
  if (account?.profile.pendingEmail) {
    return {
      short: "Pending verification",
      long: "Pending verification",
    };
  }

  if (account?.profile.emailVerifiedAt) {
    return {
      short: "Email verified",
      long: "Verified",
    };
  }

  return {
    short: "Verification pending",
    long: "Verification pending",
  };
}

function createEmptyAddressForm(account: CustomerAccount | null): AddressFormState {
  const defaultAddress = account?.addresses.find((entry) => entry.isDefault) ?? account?.addresses[0];

  return {
    label: "",
    fullName: account?.profile.fullName || defaultAddress?.fullName || "",
    phoneNumber: account?.profile.phoneNumber || defaultAddress?.phoneNumber || "",
    line1: "",
    line2: "",
    city: defaultAddress?.city || "",
    stateRegion: defaultAddress?.stateRegion || "",
    postalCode: defaultAddress?.postalCode || "",
    country: defaultAddress?.country || "",
    isDefault: !account?.addresses.length,
  };
}

function toAddressForm(address: CustomerAddress): AddressFormState {
  return {
    label: address.label,
    fullName: address.fullName,
    phoneNumber: address.phoneNumber || "",
    line1: address.line1,
    line2: address.line2 || "",
    city: address.city,
    stateRegion: address.stateRegion || "",
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

export default function AccountPage() {
  const { token, currentRole, refreshProfile } = useAuth();
  const { items: favoriteProducts } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<AccountSectionId>("overview");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addressModal, setAddressModal] = useState<AddressModalState>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>(createEmptyAddressForm(null));
  const [addressSaving, setAddressSaving] = useState(false);
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [emailPreferences, setEmailPreferences] = useState({
    orderUpdatesEnabled: true,
    marketingEmailsEnabled: false,
  });
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailVerificationSaving, setEmailVerificationSaving] = useState(false);
  const [emailVerificationResending, setEmailVerificationResending] = useState(false);
  const [emailVerificationModalOpen, setEmailVerificationModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const paymentQueryState = searchParams.get("payments");

  const loadAccount = useCallback(async () => {
    if (!token || currentRole !== "customer") {
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const [data, orderData] = await Promise.all([
        apiRequest<CustomerAccount>("/account/me", undefined, token),
        apiRequest<CustomerOrder[]>("/orders/my", undefined, token),
      ]);
      setAccount(data);
      setOrders(orderData);
      setEmailPreferences({
        orderUpdatesEnabled: data.emailPreferences.orderUpdatesEnabled,
        marketingEmailsEnabled: data.emailPreferences.marketingEmailsEnabled,
      });
      return data;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load your account.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentRole, token]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!account) {
      return;
    }

    const splitName = splitFullName(account.profile.fullName || "");
    setProfileForm({
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      email: account.profile.pendingEmail || account.profile.email || "",
      phoneNumber: account.profile.phoneNumber || "",
    });
  }, [account]);

  useEffect(() => {
    if (!paymentQueryState) {
      return;
    }

    setSection("payments");

    if (paymentQueryState === "setup_success") {
      setMessage("Your card was added through Stripe and is now available for checkout.");
      setError(null);
      void loadAccount();
    }

    if (paymentQueryState === "setup_cancel") {
      setMessage("Card setup was cancelled. No payment method was saved.");
    }

    router.replace(pathname, { scroll: false });
  }, [loadAccount, pathname, paymentQueryState, router]);

  const recentOrders = account?.recentOrders ?? [];
  const savedAddresses = account?.addresses ?? [];
  const savedPaymentMethods = account?.paymentMethods ?? [];
  const activeOrders = useMemo(
    () => orders.filter((order) => order.status === "pending" || order.status === "confirmed" || order.status === "shipped"),
    [orders],
  );
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === "delivered"),
    [orders],
  );
  const reviewCandidates = useMemo(
    () =>
      deliveredOrders.flatMap((order) =>
        order.items
          .filter((item) => item.status === "delivered")
          .map((item) => ({
            orderId: order.id,
            orderNumber: order.orderNumber,
            deliveredAt: order.fulfillment?.deliveredAt ?? order.createdAt,
            trackingNumber: item.shipment?.trackingNumber ?? null,
            item,
          })),
      ),
    [deliveredOrders],
  );
  const emailVerificationStatus = getEmailVerificationStatus(account);
  const memberSince = formatDate(account?.profile.createdAt, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const initials = useMemo(() => {
    const name = account?.profile.fullName?.trim();
    if (name) {
      return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
    }

    return (account?.profile.email || "A").charAt(0).toUpperCase();
  }, [account?.profile.email, account?.profile.fullName]);
  const profileHasChanges = useMemo(() => {
    if (!account) {
      return false;
    }

    const combinedFullName = joinFullName(profileForm.firstName, profileForm.lastName);
    return (
      combinedFullName !== (account.profile.fullName || "").trim() ||
      profileForm.email.trim().toLowerCase() !==
        (account.profile.pendingEmail || account.profile.email).trim().toLowerCase() ||
      profileForm.phoneNumber.trim() !== (account.profile.phoneNumber || "").trim()
    );
  }, [account, profileForm.email, profileForm.firstName, profileForm.lastName, profileForm.phoneNumber]);
  const customerName = account?.profile.fullName || account?.profile.email || "Customer";
  const primaryAddress = useMemo(
    () => savedAddresses.find((entry) => entry.isDefault) ?? savedAddresses[0] ?? null,
    [savedAddresses],
  );
  const primaryPaymentMethod = useMemo(
    () => savedPaymentMethods.find((entry) => entry.isDefault) ?? savedPaymentMethods[0] ?? null,
    [savedPaymentMethods],
  );
  const latestOrder = orders[0] ?? null;
  const latestTrackedItem = useMemo(
    () =>
      orders
        .flatMap((order) =>
          order.items
            .filter((item) => item.shipment?.trackingNumber)
            .map((item) => ({
              orderNumber: order.orderNumber,
              status: order.status,
              trackingNumber: item.shipment?.trackingNumber ?? null,
            })),
        )[0] ?? null,
    [orders],
  );
  const sectionCounts = useMemo<Record<AccountSectionId, string>>(
    () => ({
      overview: "Home",
      orders: String(account?.stats.orderCount ?? 0),
      returns: String(deliveredOrders.length),
      reviews: String(reviewCandidates.length),
      favorites: String(favoriteProducts.length),
      addresses: String(savedAddresses.length),
      payments: String(savedPaymentMethods.length),
      support: account?.guestOrderRecovery.claimableCount ? "Alert" : "Help",
      settings: account?.profile.pendingEmail ? "Alert" : "Profile",
    }),
    [
      account?.profile.pendingEmail,
      account?.stats.orderCount,
      account?.guestOrderRecovery.claimableCount,
      deliveredOrders.length,
      favoriteProducts.length,
      reviewCandidates.length,
      savedAddresses.length,
      savedPaymentMethods.length,
    ],
  );

  function openCreateAddressModal() {
    setAddressForm(createEmptyAddressForm(account));
    setAddressModal({ mode: "create" });
    setMessage(null);
    setError(null);
  }

  function openEditAddressModal(address: CustomerAddress) {
    setAddressForm(toAddressForm(address));
    setAddressModal({ mode: "edit", addressId: address.id });
    setMessage(null);
    setError(null);
  }

  function closeAddressModal() {
    setAddressModal(null);
    setAddressForm(createEmptyAddressForm(account));
  }

  async function submitAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !addressModal) {
      return;
    }

    if (
      !addressForm.label.trim() ||
      !addressForm.fullName.trim() ||
      !addressForm.line1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.postalCode.trim() ||
      !addressForm.country.trim()
    ) {
      setError("Please complete the required address details before saving.");
      return;
    }

    try {
      setAddressSaving(true);
      setError(null);
      const payload = {
        label: addressForm.label.trim(),
        fullName: addressForm.fullName.trim(),
        phoneNumber: addressForm.phoneNumber.trim() || undefined,
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim() || undefined,
        city: addressForm.city.trim(),
        stateRegion: addressForm.stateRegion.trim() || undefined,
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim(),
        isDefault: addressForm.isDefault,
      };
      const nextAccount = await apiRequest<CustomerAccount>(
        addressModal.mode === "create"
          ? "/account/addresses"
          : `/account/addresses/${addressModal.addressId}`,
        {
          method: addressModal.mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );
      setAccount(nextAccount);
      setEmailPreferences({
        orderUpdatesEnabled: nextAccount.emailPreferences.orderUpdatesEnabled,
        marketingEmailsEnabled: nextAccount.emailPreferences.marketingEmailsEnabled,
      });
      setMessage(addressModal.mode === "create" ? "Address saved." : "Address updated.");
      closeAddressModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Address save failed.");
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteAddress(addressId: string) {
    if (!token || !window.confirm("Delete this saved address?")) {
      return;
    }

    try {
      setActiveAction(`delete-address-${addressId}`);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        `/account/addresses/${addressId}`,
        { method: "DELETE" },
        token,
      );
      setAccount(nextAccount);
      setMessage("Address removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Address delete failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function makeAddressDefault(address: CustomerAddress) {
    if (!token || address.isDefault) {
      return;
    }

    try {
      setActiveAction(`default-address-${address.id}`);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        `/account/addresses/${address.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: address.label,
            fullName: address.fullName,
            phoneNumber: address.phoneNumber || undefined,
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            stateRegion: address.stateRegion || undefined,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: true,
          }),
        },
        token,
      );
      setAccount(nextAccount);
      setMessage("Default delivery address updated.");
    } catch (defaultError) {
      setError(defaultError instanceof Error ? defaultError.message : "Could not update default address.");
    } finally {
      setActiveAction(null);
    }
  }

  async function startStripePaymentMethodSetup() {
    if (!token) {
      return;
    }

    try {
      setPaymentRedirecting(true);
      setError(null);
      const session = await apiRequest<{ sessionId: string; url: string }>(
        "/account/payment-methods/setup-session",
        { method: "POST" },
        token,
      );
      window.location.assign(session.url);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Could not start Stripe card setup.");
      setPaymentRedirecting(false);
    }
  }

  async function makePaymentMethodDefault(paymentMethodId: string) {
    if (!token) {
      return;
    }

    try {
      setActiveAction(`default-payment-${paymentMethodId}`);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        `/account/payment-methods/${paymentMethodId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isDefault: true }),
        },
        token,
      );
      setAccount(nextAccount);
      setMessage("Default payment method updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update the default payment method.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function deletePaymentMethod(paymentMethodId: string) {
    if (!token || !window.confirm("Remove this saved card from your account?")) {
      return;
    }

    try {
      setActiveAction(`delete-payment-${paymentMethodId}`);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        `/account/payment-methods/${paymentMethodId}`,
        { method: "DELETE" },
        token,
      );
      setAccount(nextAccount);
      setMessage("Saved card removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove that saved card.");
    } finally {
      setActiveAction(null);
    }
  }

  async function saveEmailPreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setPreferencesSaving(true);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        "/account/email-preferences",
        {
          method: "PATCH",
          body: JSON.stringify(emailPreferences),
        },
        token,
      );
      setAccount(nextAccount);
      setMessage("Email preferences saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function saveProfileDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !account) {
      return;
    }

    const normalizedEmail = profileForm.email.trim().toLowerCase();
    const normalizedFullName = joinFullName(profileForm.firstName, profileForm.lastName);

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    try {
      setProfileSaving(true);
      setError(null);
      const previousPendingEmail = account.profile.pendingEmail;
      const previousActiveEmail = account.profile.email.trim().toLowerCase();
      await apiRequest<AccountSettingsProfile>(
        "/account/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: normalizedFullName,
            email: normalizedEmail,
            phoneNumber: profileForm.phoneNumber.trim() || undefined,
          }),
        },
        token,
      );
      const nextAccount = await loadAccount();
      await refreshProfile();

      if (
        nextAccount?.profile.pendingEmail &&
        nextAccount.profile.pendingEmail.trim().toLowerCase() === normalizedEmail &&
        previousPendingEmail?.trim().toLowerCase() !== normalizedEmail
      ) {
        setEmailVerificationCode("");
        setEmailVerificationModalOpen(true);
        setMessage(`We sent a 6-digit verification code to ${nextAccount.profile.pendingEmail}.`);
      } else if (
        previousPendingEmail &&
        !nextAccount?.profile.pendingEmail &&
        normalizedEmail === previousActiveEmail
      ) {
        setEmailVerificationCode("");
        setEmailVerificationModalOpen(false);
        setMessage("Pending email change cancelled.");
      } else {
        setEmailVerificationModalOpen(false);
        setMessage("Account details updated.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update your account details.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function verifyPendingEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    const code = emailVerificationCode.trim();
    if (!code) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    try {
      setEmailVerificationSaving(true);
      setError(null);
      setMessage(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        "/account/email-change/verify",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
        token,
      );
      setAccount(nextAccount);
      setEmailPreferences({
        orderUpdatesEnabled: nextAccount.emailPreferences.orderUpdatesEnabled,
        marketingEmailsEnabled: nextAccount.emailPreferences.marketingEmailsEnabled,
      });
      setEmailVerificationCode("");
      setEmailVerificationModalOpen(false);
      await refreshProfile();
      setMessage("Your new email address is now verified and active.");
    } catch (verificationError) {
      setMessage(null);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Could not verify your new email address.",
      );
    } finally {
      setEmailVerificationSaving(false);
    }
  }

  async function resendPendingEmailChange() {
    if (!token || !account?.profile.pendingEmail) {
      return;
    }

    try {
      setEmailVerificationResending(true);
      setError(null);
      const nextAccount = await apiRequest<CustomerAccount>(
        "/account/email-change/resend",
        { method: "POST" },
        token,
      );
      setAccount(nextAccount);
      setEmailPreferences({
        orderUpdatesEnabled: nextAccount.emailPreferences.orderUpdatesEnabled,
        marketingEmailsEnabled: nextAccount.emailPreferences.marketingEmailsEnabled,
      });
      setEmailVerificationCode("");
      setEmailVerificationModalOpen(true);
      setMessage(`We sent a new verification code to ${nextAccount.profile.pendingEmail}.`);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend the code.");
    } finally {
      setEmailVerificationResending(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError("Please enter your current and new password.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Your new password confirmation does not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      setError(null);
      await apiRequest<{ message?: string }>(
        "/account/password",
        {
          method: "PATCH",
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        },
        token,
      );
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setMessage("Password updated.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Could not update your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function renderOverviewSection() {
    return (
      <section className="account-section">
        <article className="account-hero-card">
          <div className="account-hero-main">
            <div className="account-hero-copy">
              <span className="account-section-eyebrow">Private account</span>
              <h1 className="account-hero-title">{customerName}</h1>
              <p className="account-hero-lede">
                Orders, returns, saved pieces, cards, and delivery details arranged in one sharper
                workspace.
              </p>
            </div>
            <div className="account-hero-facts">
              <div className="account-hero-fact">
                <span>Member since</span>
                <strong>{memberSince}</strong>
              </div>
              <div className="account-hero-fact">
                <span>Verification</span>
                <strong>{emailVerificationStatus.short}</strong>
              </div>
              <div className="account-hero-fact">
                <span>Cart ready</span>
                <strong>{account?.stats.cartItemCount ?? 0} items</strong>
              </div>
            </div>
            <div className="account-hero-actions">
              <Link href="/" className="button">
                Continue shopping
              </Link>
              <button type="button" className="button-secondary" onClick={() => setSection("orders")}>
                Review recent orders
              </button>
              <button type="button" className="button-ghost" onClick={() => setSection("reviews")}>
                Open reviews
              </button>
            </div>
          </div>
          <aside className="account-hero-aside">
            <div className="account-hero-aside-label">Latest order pulse</div>
            <div className="account-hero-aside-value">
              {latestOrder ? `Order ${latestOrder.orderNumber}` : "No order activity yet"}
            </div>
            <div className="account-hero-aside-detail">
              {latestTrackedItem?.trackingNumber ? `Tracking ${latestTrackedItem.trackingNumber}` : latestOrder ? `${formatOrderStatusLabel(latestOrder.status)} order ready to review in detail` : (
                primaryAddress
                ? `${primaryAddress.label} • ${primaryAddress.city}, ${primaryAddress.country}`
                : "Place your first order to start tracking delivery and review activity here."
              )}
            </div>
            <div className="account-hero-mini-grid">
              <div>
                <span>Active orders</span>
                <strong>{activeOrders.length}</strong>
              </div>
              <div>
                <span>Ready for review</span>
                <strong>{reviewCandidates.length}</strong>
              </div>
              <div>
                <span>Addresses</span>
                <strong>{savedAddresses.length}</strong>
              </div>
              <div>
                <span>Cards</span>
                <strong>{savedPaymentMethods.length}</strong>
              </div>
            </div>
          </aside>
        </article>

          <div className="account-overview-grid">
            <article className="account-section-card account-profile-card">
              <div className="account-profile-top">
                <div className="account-avatar">{initials}</div>
                <div className="account-profile-copy">
                  <strong>{customerName}</strong>
                  <span>{account?.profile.email}</span>
                  <span>Member since {memberSince}</span>
                </div>
              </div>
              <div className="account-profile-meta">
                <div>
                  <span>Phone</span>
                  <strong>{account?.profile.phoneNumber || "Not added yet"}</strong>
                </div>
                <div>
                  <span>Email status</span>
                  <strong>{emailVerificationStatus.long}</strong>
                </div>
              </div>
              <div className="account-profile-foot">
                <div className="account-profile-foot-row">
                  <span>Default address</span>
                  <strong>{primaryAddress ? primaryAddress.label : "Not added"}</strong>
                </div>
                <div className="account-profile-foot-row">
                  <span>Default payment</span>
                  <strong>
                    {primaryPaymentMethod
                      ? `${primaryPaymentMethod.brand} •••• ${primaryPaymentMethod.last4}`
                      : "Not added"}
                  </strong>
                </div>
              </div>
            </article>

            <div className="account-stats-grid">
              <article className="account-stat-card">
                <span>Orders</span>
                <strong>{account?.stats.orderCount ?? 0}</strong>
                <p>Total purchases connected to this account.</p>
              </article>
              <article className="account-stat-card">
                <span>Returns window</span>
                <strong>{deliveredOrders.length}</strong>
                <p>Delivered orders that can be reviewed or raised with support.</p>
              </article>
              <article className="account-stat-card">
                <span>Saved addresses</span>
                <strong>{savedAddresses.length}</strong>
                <p>Ready for faster delivery on your next checkout.</p>
              </article>
              <article className="account-stat-card">
                <span>Favorites</span>
                <strong>{favoriteProducts.length}</strong>
                <p>Products you saved for a faster return later.</p>
              </article>
            </div>
          </div>

        <div className="account-overview-detail-grid">
          <article className="account-section-card account-curation-card">
            <div className="account-subsection-head">
              <div>
                <h2>Checkout readiness</h2>
                <p>The details that make your next purchase feel immediate.</p>
              </div>
            </div>
            <div className="account-curation-list">
              <div className="account-curation-row">
                <span>Delivery</span>
                <strong>
                  {primaryAddress
                    ? `${primaryAddress.label} • ${primaryAddress.city}, ${primaryAddress.country}`
                    : "No default address saved yet"}
                </strong>
              </div>
              <div className="account-curation-row">
                <span>Payment</span>
                <strong>
                  {primaryPaymentMethod
                    ? `${primaryPaymentMethod.brand} ending in ${primaryPaymentMethod.last4}`
                    : "No saved Stripe card yet"}
                </strong>
              </div>
              <div className="account-curation-row">
                <span>Favorites moodboard</span>
                <strong>
                  {favoriteProducts.length > 0
                    ? `${favoriteProducts.length} saved pieces waiting for a return visit`
                    : "Start saving products you want to revisit"}
                </strong>
              </div>
            </div>
            <div className="account-card-actions">
              <button type="button" className="button-secondary" onClick={() => setSection("addresses")}>
                Manage addresses
              </button>
              <button type="button" className="button-ghost" onClick={() => setSection("payments")}>
                Review saved cards
              </button>
            </div>
          </article>

          <article className="account-section-card account-curation-card account-curation-card-soft">
            <div className="account-subsection-head">
              <div>
                <h2>Account rhythm</h2>
                <p>A more elegant snapshot of where your account stands today.</p>
              </div>
            </div>
            <div className="account-curation-pill-grid">
              <div className="account-curation-pill">
                <span>Recent order history</span>
                <strong>{recentOrders.length > 0 ? "Active" : "Waiting for first order"}</strong>
              </div>
              <div className="account-curation-pill">
                <span>Email verification</span>
                <strong>{emailVerificationStatus.short}</strong>
              </div>
              <div className="account-curation-pill">
                <span>Saved destinations</span>
                <strong>{savedAddresses.length > 0 ? `${savedAddresses.length} ready` : "Add one"}</strong>
              </div>
              <div className="account-curation-pill">
                <span>Saved cards</span>
                <strong>{savedPaymentMethods.length > 0 ? `${savedPaymentMethods.length} ready` : "Add one"}</strong>
              </div>
            </div>
          </article>
        </div>

          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Recent orders</h2>
              <p>Your newest orders at a glance, without opening the full order history.</p>
            </div>
            <Link href="/orders" className="button-ghost">
              Open full orders
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty">No orders yet.</div>
          ) : (
            <div className="account-order-list">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="account-order-row">
                  <div className="account-order-main">
                    <strong>Order {order.orderNumber}</strong>
                    <span>{formatDate(order.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="account-order-meta">
                    <StatusBadge status={order.status} />
                    <strong>{formatCurrency(order.totalPrice)}</strong>
                    <Link href="/orders" className="button-ghost">
                      View details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderOrdersSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Orders</span>
            <h1 className="account-section-title">Track your recent purchases</h1>
            <p className="account-section-copy">
              A focused order list with the basics you need now, plus a jump to the full order
              history whenever you want deeper detail.
            </p>
          </div>
          <Link href="/orders" className="button">
            View full history
          </Link>
        </div>

        <article className="account-section-card">
          {recentOrders.length === 0 ? (
            <div className="empty">You have not placed any orders yet.</div>
          ) : (
            <div className="account-order-list account-order-list-full">
              {recentOrders.map((order) => (
                <div key={order.id} className="account-order-row account-order-row-full">
                  <div className="account-order-main">
                    <span className="account-order-label">Order number</span>
                    <strong>{order.orderNumber}</strong>
                  </div>
                  <div className="account-order-main">
                    <span className="account-order-label">Date</span>
                    <strong>
                      {formatDate(order.createdAt, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </div>
                  <div className="account-order-main">
                    <span className="account-order-label">Status</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="account-order-main">
                    <span className="account-order-label">Total</span>
                    <strong>{formatCurrency(order.totalPrice)}</strong>
                  </div>
                  <div className="account-order-actions">
                    <Link href="/orders" className="button-ghost">
                      View details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderReturnsSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Returns</span>
            <h1 className="account-section-title">Return-ready orders in one place</h1>
            <p className="account-section-copy">
              Delivered items are gathered here so customers can quickly check what arrived, open
              the order, and reach support when something needs attention.
            </p>
          </div>
          <Link href="/orders" className="button">
            Open full orders
          </Link>
        </div>

        <article className="account-section-card">
          {deliveredOrders.length === 0 ? (
            <div className="empty">No delivered orders yet. Returns will appear here after delivery.</div>
          ) : (
            <div className="account-order-list">
              {deliveredOrders.slice(0, 8).map((order) => (
                <div key={order.id} className="account-order-row">
                  <div className="account-order-main">
                    <strong>Order {order.orderNumber}</strong>
                    <span>
                      Delivered{" "}
                      {formatDate(order.fulfillment?.deliveredAt ?? order.createdAt, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="account-order-meta">
                    <strong>{order.items.length} item{order.items.length === 1 ? "" : "s"}</strong>
                    <Link href="/orders" className="button-ghost">
                      Review order
                    </Link>
                    <Link href="/contact" className="button-ghost">
                      Contact support
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderReviewsSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Reviews</span>
            <h1 className="account-section-title">Delivered items ready for feedback</h1>
            <p className="account-section-copy">
              Customers can only review products after purchase and delivery. This section gathers
              those eligible items so leaving feedback feels immediate.
            </p>
          </div>
          <span className="chip">{reviewCandidates.length} ready</span>
        </div>

        <article className="account-section-card">
          {reviewCandidates.length === 0 ? (
            <div className="empty">
              No delivered items are waiting for a review yet. Come back after your next delivery.
            </div>
          ) : (
            <div className="account-order-list">
              {reviewCandidates.slice(0, 10).map((entry) => (
                <div key={`${entry.orderId}-${entry.item.id}`} className="account-order-row">
                  <div className="account-order-main">
                    <strong>{entry.item.product.title}</strong>
                    <span>
                      Order {entry.orderNumber} - Delivered{" "}
                      {formatDate(entry.deliveredAt, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="account-order-meta">
                    <span>{formatCatalogLabel(entry.item.product.category)}</span>
                    <Link href={`/products/${entry.item.product.id}`} className="button-ghost">
                      Rate product
                    </Link>
                    <Link href="/orders" className="button-ghost">
                      Open order
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderSupportSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Support</span>
            <h1 className="account-section-title">Help with orders, delivery, and account questions</h1>
            <p className="account-section-copy">
              Quick customer support shortcuts for order help, claimable guest orders, and the
              account details that usually matter when resolving an issue.
            </p>
          </div>
          <Link href="/contact" className="button">
            Contact support
          </Link>
        </div>

        <div className="account-overview-detail-grid">
          <article className="account-section-card account-curation-card">
            <div className="account-subsection-head">
              <div>
                <h2>Fast support routes</h2>
                <p>Open the path that matches what the customer needs right now.</p>
              </div>
            </div>
            <div className="account-curation-list">
              <div className="account-curation-row">
                <span>Order help</span>
                <strong>Track delivery, check status, or inspect a recent purchase in full.</strong>
              </div>
              <div className="account-curation-row">
                <span>Claim guest orders</span>
                <strong>
                  {account?.guestOrderRecovery.claimableCount
                    ? `${account.guestOrderRecovery.claimableCount} guest order match${account.guestOrderRecovery.claimableCount === 1 ? "" : "es"} available`
                    : "No guest order matches waiting right now"}
                </strong>
              </div>
              <div className="account-curation-row">
                <span>Returns questions</span>
                <strong>Delivered orders can be reviewed with support if something arrived wrong.</strong>
              </div>
            </div>
            <div className="account-card-actions">
              <Link href="/orders" className="button-secondary">
                Open orders
              </Link>
              {account?.guestOrderRecovery.claimableCount ? (
                <Link href="/claim-orders" className="button-ghost">
                  Claim guest orders
                </Link>
              ) : null}
              <Link href="/contact" className="button-ghost">
                Send message
              </Link>
            </div>
          </article>

          <article className="account-section-card account-curation-card account-curation-card-soft">
            <div className="account-subsection-head">
              <div>
                <h2>Account signals</h2>
                <p>The core details support usually needs to resolve customer issues faster.</p>
              </div>
            </div>
            <div className="account-curation-list">
              <div className="account-curation-row">
                <span>Email status</span>
                <strong>{emailVerificationStatus.long}</strong>
              </div>
              <div className="account-curation-row">
                <span>Active orders</span>
                <strong>{activeOrders.length} in progress right now</strong>
              </div>
              <div className="account-curation-row">
                <span>Review-ready items</span>
                <strong>{reviewCandidates.length} eligible after delivered purchases</strong>
              </div>
              <div className="account-curation-row">
                <span>Default delivery</span>
                <strong>{primaryAddress ? primaryAddress.label : "No default address saved yet"}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderFavoritesSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Favorites</span>
            <h1 className="account-section-title">Saved products worth revisiting</h1>
            <p className="account-section-copy">
              Keep the pieces you like in one place, then jump back into product details whenever
              you are ready.
            </p>
          </div>
          <span className="chip">{favoriteProducts.length} saved</span>
        </div>

        {favoriteProducts.length === 0 ? (
          <article className="account-section-card">
            <div className="empty">
              No favorites yet. Use the star on any product card or product page to save it here.
            </div>
          </article>
        ) : (
          <div className="catalog-grid related-products-grid account-favorites-grid">
            {favoriteProducts.map((product) => (
              <article key={product.id} className="product-card compact-product-card account-favorite-card">
                <FavoriteStarButton product={product} className="product-card-favorite" />
                <Link href={`/products/${product.id}`} className="product-thumb">
                  <div className="product-media-shell">
                    <ProductMedia image={assetUrl(product.images[0])} title={product.title} />
                  </div>
                </Link>
                <div className="product-card-body">
                  <div className="product-kicker">Saved favorite</div>
                  <Link href={`/products/${product.id}`} className="product-title-link">
                    {product.title}
                  </Link>
                  <div className="product-secondary-line">
                    {[
                      getCatalogDepartmentDisplayLabel(product.department),
                      formatCatalogLabel(product.category),
                      product.color ? formatProductAttributeLabel(product.color) : null,
                      product.size ? formatProductAttributeLabel(product.size) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="product-price-row product-price-row-stacked">
                    <span className="price">{formatCurrency(product.price)}</span>
                  </div>
                  <div
                    className={
                      product.stock > 0
                        ? "product-stock-line"
                        : "product-stock-line product-stock-line-empty"
                    }
                  >
                    {product.stock > 0 ? `${product.stock} available now` : "Currently unavailable"}
                  </div>
                </div>
                <div className="product-card-foot">
                  {product.vendor ? (
                    <Link className="product-card-vendor" href={`/shops/${product.vendor.id}`}>
                      {product.vendor.shopName}
                    </Link>
                  ) : (
                    <span className="product-card-vendor muted">Marketplace listing</span>
                  )}
                  <div className="product-card-actions account-favorite-actions">
                    <Link
                      className="product-action-button product-action-button-secondary"
                      href={`/products/${product.id}`}
                    >
                      Open product
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderAddressesSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Addresses</span>
            <h1 className="account-section-title">Keep delivery details tidy</h1>
            <p className="account-section-copy">
              Save more than one address, switch your default any time, and keep checkout much
              shorter on repeat purchases.
            </p>
          </div>
          <button type="button" className="button" onClick={openCreateAddressModal}>
            Add address
          </button>
        </div>

        {savedAddresses.length === 0 ? (
          <article className="account-section-card">
            <div className="empty">No saved addresses yet. Add your first delivery address.</div>
          </article>
        ) : (
          <div className="account-address-grid">
            {savedAddresses.map((address) => (
              <article key={address.id} className="account-section-card account-address-card">
                <div className="account-address-head">
                  <div>
                    <div className="account-card-title-row">
                      <h2>{address.label}</h2>
                      {address.isDefault ? <span className="badge">Default</span> : null}
                    </div>
                    <p>
                      {address.fullName}
                      {address.phoneNumber ? ` | ${address.phoneNumber}` : ""}
                    </p>
                  </div>
                </div>
                <div className="account-address-lines">
                  <span>{address.line1}</span>
                  {address.line2 ? <span>{address.line2}</span> : null}
                  <span>
                    {address.city}
                    {address.stateRegion ? `, ${address.stateRegion}` : ""} {address.postalCode}
                  </span>
                  <span>{address.country}</span>
                </div>
                <div className="account-card-actions">
                  <button type="button" className="button-secondary" onClick={() => openEditAddressModal(address)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={address.isDefault || activeAction === `default-address-${address.id}`}
                    onClick={() => void makeAddressDefault(address)}
                  >
                    {activeAction === `default-address-${address.id}` ? "Saving..." : "Make default"}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={activeAction === `delete-address-${address.id}`}
                    onClick={() => void deleteAddress(address.id)}
                  >
                    {activeAction === `delete-address-${address.id}` ? "Removing..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderPaymentsSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Payments</span>
            <h1 className="account-section-title">Saved cards</h1>
          </div>
        </div>

        <article className="account-section-card">
          <div className="account-subsection-head">
            <div>
              <h2>Saved payment methods</h2>
            </div>
          </div>
          {savedPaymentMethods.length === 0 ? (
            <div className="empty">
              No saved cards yet. Add one through Stripe to make repeat checkout faster.
            </div>
          ) : (
            <div className="account-payment-list">
              {savedPaymentMethods.map((method) => (
                <div key={method.id} className="account-payment-row">
                  <div className="account-payment-main">
                    <div className="account-card-title-row">
                      <strong>
                        {method.brand} ending in {method.last4}
                      </strong>
                      {method.isDefault ? <span className="badge">Default</span> : null}
                    </div>
                    <span>
                      Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                    </span>
                    <span>{method.cardholderName || "Cardholder name from Stripe"}</span>
                  </div>
                  <div className="account-card-actions">
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={method.isDefault || activeAction === `default-payment-${method.id}`}
                      onClick={() => void makePaymentMethodDefault(method.id)}
                    >
                      {activeAction === `default-payment-${method.id}` ? "Saving..." : "Set default"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={activeAction === `delete-payment-${method.id}`}
                      onClick={() => void deletePaymentMethod(method.id)}
                    >
                      {activeAction === `delete-payment-${method.id}` ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderSettingsSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Settings</span>
            <h1 className="account-section-title">Profile, preferences, and account security</h1>
            <p className="account-section-copy">
              Update your customer details, manage notifications, and refresh your password from
              one quieter settings area.
            </p>
          </div>
        </div>

        <div className="account-settings-grid">
          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Profile details</h2>
              </div>
              <span className="chip">
                {emailVerificationStatus.short}
              </span>
            </div>
            <form className="account-stack-form" onSubmit={saveProfileDetails}>
              <div className="account-form-grid">
                <div className="field">
                  <label>Name</label>
                  <input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    placeholder="Name"
                  />
                </div>
                <div className="field">
                  <label>Surname</label>
                  <input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    placeholder="Surname"
                  />
                </div>
                <div className="field account-form-grid-span-2">
                  <label>Phone number</label>
                  <input
                    type="tel"
                    value={profileForm.phoneNumber}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value,
                      }))
                    }
                    placeholder="Optional phone number"
                  />
                </div>
                <div className="field account-form-grid-span-2">
                  <label>Email address</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="account-settings-detail-list">
                <div className="account-settings-detail-row">
                  <span>Member since</span>
                  <strong>{memberSince}</strong>
                </div>
                <div className="account-settings-detail-row">
                  <span>Email status</span>
                  <strong>{emailVerificationStatus.long}</strong>
                </div>
                {account?.profile.pendingEmail ? (
                  <div className="account-settings-detail-row account-settings-detail-row-wide">
                    <span>Pending new email</span>
                    <strong>{account.profile.pendingEmail}</strong>
                  </div>
                ) : null}
              </div>
              <div className="account-card-actions">
                <button type="submit" className="button" disabled={profileSaving || !profileHasChanges}>
                  {profileSaving ? "Saving..." : "Save settings"}
                </button>
                {account?.profile.pendingEmail ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEmailVerificationModalOpen(true)}
                  >
                    Enter OTP code
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Email preferences</h2>
              </div>
            </div>
            <form className="account-stack-form" onSubmit={saveEmailPreferences}>
              <label className="account-checkbox-row">
                <input
                  type="checkbox"
                  checked={emailPreferences.orderUpdatesEnabled}
                  onChange={(event) =>
                    setEmailPreferences((current) => ({
                      ...current,
                      orderUpdatesEnabled: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Order updates</strong>
                  <small>Delivery, confirmation, and payment-related emails.</small>
                </span>
              </label>
              <label className="account-checkbox-row">
                <input
                  type="checkbox"
                  checked={emailPreferences.marketingEmailsEnabled}
                  onChange={(event) =>
                    setEmailPreferences((current) => ({
                      ...current,
                      marketingEmailsEnabled: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Marketing emails</strong>
                  <small>News, offers, and seasonal store updates.</small>
                </span>
              </label>
              <div className="account-card-actions">
                <button type="submit" className="button" disabled={preferencesSaving}>
                  {preferencesSaving ? "Saving..." : "Save preferences"}
                </button>
              </div>
            </form>
          </article>

          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Password</h2>
              </div>
            </div>
            <form className="account-stack-form" onSubmit={changePassword}>
              <div className="field">
                <label>Current password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="account-card-actions">
                <button type="submit" className="button" disabled={passwordSaving}>
                  {passwordSaving ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </article>
        </div>
      </section>
    );
  }

  function renderSection() {
    if (!account) {
      return (
        <section className="account-section">
          <article className="account-section-card">
            <div className="empty">We could not load your customer account just yet.</div>
          </article>
        </section>
      );
    }

    if (section === "orders") {
      return renderOrdersSection();
    }

    if (section === "returns") {
      return renderReturnsSection();
    }

    if (section === "reviews") {
      return renderReviewsSection();
    }

    if (section === "favorites") {
      return renderFavoritesSection();
    }

    if (section === "addresses") {
      return renderAddressesSection();
    }

    if (section === "payments") {
      return renderPaymentsSection();
    }

    if (section === "support") {
      return renderSupportSection();
    }

    if (section === "settings") {
      return renderSettingsSection();
    }

    return renderOverviewSection();
  }

  return (
    <RequireRole requiredRole="customer">
        <div className="account-shell">
          <aside className="account-sidebar">
            <div className="account-sidebar-card">
              <div className="account-sidebar-top">
                <div className="account-avatar account-avatar-sidebar">{initials}</div>
                <div className="account-sidebar-copy">
                  <span className="account-sidebar-eyebrow">My account</span>
                  <strong>{customerName}</strong>
                  <span>{account?.profile.email || "Loading account..."}</span>
                </div>
              </div>
              <div className="account-sidebar-status">
                <span>{emailVerificationStatus.short}</span>
                <strong>Member since {memberSince}</strong>
              </div>
              <div className="account-sidebar-meta">
                <div className="account-sidebar-stat">
                  <span>Orders</span>
                  <strong>{account?.stats.orderCount ?? 0}</strong>
                </div>
                <div className="account-sidebar-stat">
                  <span>Cart</span>
                  <strong>{account?.stats.cartItemCount ?? 0}</strong>
                </div>
                <div className="account-sidebar-stat">
                  <span>Favorites</span>
                  <strong>{favoriteProducts.length}</strong>
                </div>
                <div className="account-sidebar-stat">
                  <span>Cards</span>
                  <strong>{savedPaymentMethods.length}</strong>
                </div>
              </div>
              <div className="account-sidebar-divider" />
              <nav className="account-sidebar-nav" aria-label="Account sections">
                {accountSections.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === section ? "account-nav-button active" : "account-nav-button"}
                    onClick={() => {
                      setSection(entry.id);
                      setMessage(null);
                      setError(null);
                    }}
                  >
                    <span className="account-nav-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="account-nav-copy">
                      <span>{entry.label}</span>
                    </span>
                    <span className="account-nav-count">{sectionCounts[entry.id]}</span>
                  </button>
                ))}
              </nav>
              <div className="account-sidebar-foot">
                <span>Default address</span>
                <strong>{primaryAddress ? primaryAddress.label : "Add one for faster checkout"}</strong>
              </div>
            </div>
          </aside>

        <main className="account-content">
          {loading ? <div className="message">Loading your account...</div> : null}
          {!loading && message ? <div className="message success">{message}</div> : null}
          {!loading && error ? <div className="message error">{error}</div> : null}
          {!loading ? renderSection() : null}
        </main>

        {addressModal ? (
          <div className="account-modal-backdrop" role="presentation" onClick={closeAddressModal}>
            <div
              className="account-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-address-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="account-subsection-head">
                <div>
                  <h2 id="account-address-modal-title">
                    {addressModal.mode === "create" ? "Add a new address" : "Edit address"}
                  </h2>
                  <p>Keep delivery details clean and reusable for faster checkout.</p>
                </div>
                <button type="button" className="button-ghost" onClick={closeAddressModal}>
                  Close
                </button>
              </div>
              <form className="account-modal-form" onSubmit={submitAddress}>
                <div className="account-form-grid">
                  <div className="field">
                    <label>Label</label>
                    <input
                      value={addressForm.label}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, label: event.target.value }))
                      }
                      placeholder="Home, Office, Family"
                    />
                  </div>
                  <div className="field">
                    <label>Full name</label>
                    <input
                      value={addressForm.fullName}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Phone number</label>
                    <input
                      value={addressForm.phoneNumber}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, phoneNumber: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field account-form-grid-span-2">
                    <label>Address line 1</label>
                    <input
                      value={addressForm.line1}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, line1: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field account-form-grid-span-2">
                    <label>Address line 2</label>
                    <input
                      value={addressForm.line2}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, line2: event.target.value }))
                      }
                      placeholder="Apartment, suite, floor"
                    />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input
                      value={addressForm.city}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, city: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>State / region</label>
                    <input
                      value={addressForm.stateRegion}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, stateRegion: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Postal code</label>
                    <input
                      value={addressForm.postalCode}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, postalCode: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Country</label>
                    <input
                      value={addressForm.country}
                      onChange={(event) =>
                        setAddressForm((current) => ({ ...current, country: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <label className="account-checkbox-row">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) =>
                      setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))
                    }
                  />
                  <span>
                    <strong>Make this my default address</strong>
                    <small>Use this address first during future checkout.</small>
                  </span>
                </label>
                <div className="account-card-actions account-modal-actions">
                  <button type="button" className="button-secondary" onClick={closeAddressModal}>
                    Cancel
                  </button>
                  <button type="submit" className="button" disabled={addressSaving}>
                    {addressSaving ? "Saving..." : addressModal.mode === "create" ? "Save address" : "Update address"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {emailVerificationModalOpen && account?.profile.pendingEmail ? (
          <div
            className="account-modal-backdrop"
            role="presentation"
            onClick={() => setEmailVerificationModalOpen(false)}
          >
            <div
              className="account-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-email-verification-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="account-subsection-head">
                <div>
                  <h2 id="account-email-verification-title">Verify your new email address</h2>
                  <p>
                    Enter the 6-digit code we sent to <strong>{account.profile.pendingEmail}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setEmailVerificationModalOpen(false)}
                >
                  Close
                </button>
              </div>

              <form className="account-modal-form" onSubmit={verifyPendingEmailChange}>
                <div className="field">
                  <label>Verification code</label>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={emailVerificationCode}
                    onChange={(event) =>
                      setEmailVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                  />
                </div>

                <div className="account-card-actions account-modal-actions">
                  <button
                    type="submit"
                    className="button"
                    disabled={emailVerificationSaving || emailVerificationCode.trim().length !== 6}
                  >
                    {emailVerificationSaving ? "Verifying..." : "Verify email"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={emailVerificationResending}
                    onClick={() => void resendPendingEmailChange()}
                  >
                    {emailVerificationResending ? "Sending..." : "Resend code"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </RequireRole>
  );
}
