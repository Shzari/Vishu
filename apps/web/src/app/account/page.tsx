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
import type { CustomerAccount, CustomerAddress } from "@/lib/types";

type AccountSectionId =
  | "overview"
  | "orders"
  | "favorites"
  | "addresses"
  | "payments"
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

const accountSections: {
  id: AccountSectionId;
  label: string;
  description: string;
}[] = [
  { id: "overview", label: "Overview", description: "Account summary and recent activity" },
  { id: "orders", label: "Orders", description: "Review your recent purchases" },
  { id: "favorites", label: "Favorites", description: "Saved products you want to revisit" },
  { id: "addresses", label: "Addresses", description: "Manage saved delivery destinations" },
  { id: "payments", label: "Payments", description: "Stripe-managed cards and defaults" },
  { id: "settings", label: "Settings", description: "Security, preferences, and recovery" },
];

function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString("en-GB", options);
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
  const { token, currentRole } = useAuth();
  const { items: favoriteProducts } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
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
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [guestRecoveryPhone, setGuestRecoveryPhone] = useState("");
  const [guestRecoverySaving, setGuestRecoverySaving] = useState(false);

  const paymentQueryState = searchParams.get("payments");

  const loadAccount = useCallback(async () => {
    if (!token || currentRole !== "customer") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<CustomerAccount>("/account/me", undefined, token);
      setAccount(data);
      setEmailPreferences({
        orderUpdatesEnabled: data.emailPreferences.orderUpdatesEnabled,
        marketingEmailsEnabled: data.emailPreferences.marketingEmailsEnabled,
      });
      setGuestRecoveryPhone(data.profile.phoneNumber || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load your account.");
    } finally {
      setLoading(false);
    }
  }, [currentRole, token]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

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
      setGuestRecoveryPhone(nextAccount.profile.phoneNumber || guestRecoveryPhone);
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

  async function requestGuestOrderRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setGuestRecoverySaving(true);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        "/account/guest-orders/claim-request",
        {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: guestRecoveryPhone.trim() || undefined,
          }),
        },
        token,
      );
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start guest order recovery.");
    } finally {
      setGuestRecoverySaving(false);
    }
  }

  function renderOverviewSection() {
    return (
      <section className="account-section">
        <div className="account-section-head">
          <div>
            <span className="account-section-eyebrow">Overview</span>
            <h1 className="account-section-title">A cleaner view of your shopping account</h1>
            <p className="account-section-copy">
              Your core account details, recent orders, and quick stats stay here so the rest of
              the workspace can stay focused.
            </p>
          </div>
          <Link href="/shop" className="button-secondary">
            Continue shopping
          </Link>
        </div>

        <div className="account-overview-grid">
          <article className="account-section-card account-profile-card">
            <div className="account-profile-top">
              <div className="account-avatar">{initials}</div>
              <div className="account-profile-copy">
                <strong>{account?.profile.fullName || "Customer account"}</strong>
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
                <strong>{account?.profile.emailVerifiedAt ? "Verified" : "Verification pending"}</strong>
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
              <span>Cart items</span>
              <strong>{account?.stats.cartItemCount ?? 0}</strong>
              <p>Products waiting in your cart right now.</p>
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
            <h1 className="account-section-title">Saved cards, handled by Stripe</h1>
            <p className="account-section-copy">
              Sensitive card details never live in your account here. Stripe securely manages saved
              cards and checkout authorization for you.
            </p>
          </div>
          <button
            type="button"
            className="button"
            disabled={paymentRedirecting}
            onClick={() => void startStripePaymentMethodSetup()}
          >
            {paymentRedirecting ? "Opening Stripe..." : "Add card with Stripe"}
          </button>
        </div>

        <article className="account-section-card account-payments-note">
          <strong>How it works</strong>
          <p>
            Add a new card through Stripe, then choose your preferred default for faster future
            checkouts. Your account stores payment method references only.
          </p>
        </article>

        <article className="account-section-card">
          <div className="account-subsection-head">
            <div>
              <h2>Saved payment methods</h2>
              <p>Only cards currently available in Stripe for this account appear here.</p>
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
            <h1 className="account-section-title">Preferences and account security</h1>
            <p className="account-section-copy">
              Keep notifications in check, refresh your password, and recover older guest orders
              from one quieter settings area.
            </p>
          </div>
        </div>

        <div className="account-settings-grid">
          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Email preferences</h2>
                <p>Control the updates you receive after purchase and beyond checkout.</p>
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
                <p>Keep your sign-in secure with a fresh password whenever you need one.</p>
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

          <article className="account-section-card">
            <div className="account-subsection-head">
              <div>
                <h2>Guest order recovery</h2>
                <p>
                  Connect older guest orders to this account by requesting a secure recovery email.
                </p>
              </div>
              <span className="chip">{account?.guestOrderRecovery.claimableCount ?? 0} available</span>
            </div>
            <form className="account-stack-form" onSubmit={requestGuestOrderRecovery}>
              <div className="field">
                <label>Phone number for matching guest orders</label>
                <input
                  type="tel"
                  value={guestRecoveryPhone}
                  onChange={(event) => setGuestRecoveryPhone(event.target.value)}
                  placeholder="Optional if your account phone already matches"
                />
              </div>
              <div className="account-card-actions">
                <button type="submit" className="button-secondary" disabled={guestRecoverySaving}>
                  {guestRecoverySaving ? "Sending..." : "Send recovery email"}
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

    if (section === "favorites") {
      return renderFavoritesSection();
    }

    if (section === "addresses") {
      return renderAddressesSection();
    }

    if (section === "payments") {
      return renderPaymentsSection();
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
                <strong>{account?.profile.fullName || account?.profile.email || "Customer"}</strong>
                <span>{account?.profile.email || "Loading account..."}</span>
              </div>
            </div>
            <div className="account-sidebar-meta">
              <div>
                <span>Orders</span>
                <strong>{account?.stats.orderCount ?? 0}</strong>
              </div>
              <div>
                <span>Cart</span>
                <strong>{account?.stats.cartItemCount ?? 0}</strong>
              </div>
              <div>
                <span>Favorites</span>
                <strong>{favoriteProducts.length}</strong>
              </div>
            </div>
            <nav className="account-sidebar-nav" aria-label="Account sections">
              {accountSections.map((entry) => (
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
                  <span>{entry.label}</span>
                  <small>{entry.description}</small>
                </button>
              ))}
            </nav>
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
      </div>
    </RequireRole>
  );
}
