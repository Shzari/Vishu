"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { formatCurrency, apiRequest } from "@/lib/api";
import type { CustomerAccount } from "@/lib/types";

const emptyAddress = {
  label: "",
  fullName: "",
  phoneNumber: "",
  line1: "",
  line2: "",
  city: "",
  stateRegion: "",
  postalCode: "",
  country: "",
  isDefault: false,
};

const emptyPaymentForm = {
  nickname: "",
  cardholderName: "",
  cardNumber: "",
  expMonth: "",
  expYear: "",
  isDefault: false,
};

export default function AccountPage() {
  const { token, user, refreshProfile } = useAuth();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAccount() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<CustomerAccount>("/account/me", undefined, token);
      setAccount(data);
      setFullName(data.profile.fullName ?? "");
      setEmail(data.profile.email);
      setPhoneNumber(data.profile.phoneNumber ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && user?.role === "customer") {
      void loadAccount();
    }
  }, [token, user]);

  function resetAddressForm() {
    setAddressForm(emptyAddress);
    setEditingAddressId(null);
  }

  function resetPaymentForm() {
    setPaymentForm(emptyPaymentForm);
    setEditingPaymentId(null);
  }

  async function updateProfile() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      await apiRequest(
        "/account/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ fullName, email, phoneNumber }),
        },
        token,
      );
      await loadAccount();
      await refreshProfile();
      setMessage("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(
        editingAddressId ? `/account/addresses/${editingAddressId}` : "/account/addresses",
        {
          method: editingAddressId ? "PATCH" : "POST",
          body: JSON.stringify(addressForm),
        },
        token,
      );
      setAccount(next);
      resetAddressForm();
      setMessage(editingAddressId ? "Address updated." : "Address saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save address.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddress(id: string) {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(`/account/addresses/${id}`, { method: "DELETE" }, token);
      setAccount(next);
      if (editingAddressId === id) {
        resetAddressForm();
      }
      setMessage("Address removed.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove address.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultAddress(id: string) {
    if (!token || !account) return;
    const address = account.addresses.find((entry) => entry.id === id);
    if (!address) return;

    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(
        `/account/addresses/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: address.label,
            fullName: address.fullName,
            phoneNumber: address.phoneNumber ?? "",
            line1: address.line1,
            line2: address.line2 ?? "",
            city: address.city,
            stateRegion: address.stateRegion ?? "",
            postalCode: address.postalCode,
            country: address.country,
            isDefault: true,
          }),
        },
        token,
      );
      setAccount(next);
      setMessage("Default address updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update default address.");
    } finally {
      setSaving(false);
    }
  }

  async function savePaymentMethod() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(
        editingPaymentId ? `/account/payment-methods/${editingPaymentId}` : "/account/payment-methods",
        {
          method: editingPaymentId ? "PATCH" : "POST",
          body: JSON.stringify(
            editingPaymentId
              ? {
                  nickname: paymentForm.nickname,
                  cardholderName: paymentForm.cardholderName,
                  isDefault: paymentForm.isDefault,
                }
              : {
                  ...paymentForm,
                  expMonth: Number(paymentForm.expMonth),
                  expYear: Number(paymentForm.expYear),
                },
          ),
        },
        token,
      );
      setAccount(next);
      resetPaymentForm();
      setMessage(editingPaymentId ? "Saved card updated." : "Saved card added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save card.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePaymentMethod(id: string) {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(`/account/payment-methods/${id}`, { method: "DELETE" }, token);
      setAccount(next);
      if (editingPaymentId === id) {
        resetPaymentForm();
      }
      setMessage("Saved card removed.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove card.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultPaymentMethod(id: string) {
    if (!token || !account) return;
    const method = account.paymentMethods.find((entry) => entry.id === id);
    if (!method) return;

    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<CustomerAccount>(
        `/account/payment-methods/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            nickname: method.nickname ?? "",
            cardholderName: method.cardholderName,
            isDefault: true,
          }),
        },
        token,
      );
      setAccount(next);
      setMessage("Default card updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update default card.");
    } finally {
      setSaving(false);
    }
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

  if (loading || !account) {
    return (
      <RequireRole requiredRole="customer">
        <div className="message">Loading your account...</div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="customer">
      <div className="stack account-page">
      <section className="panel hero-panel">
        <span className="chip">My Account</span>
        <h1 className="hero-title account-hero-title">Manage your profile, addresses, and saved cards.</h1>
        <p className="hero-copy">
          Update your profile, checkout details, and password, then review your current cart and recent orders in one place.
        </p>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <section className="mini-stats">
        <div className="mini-stat">
          <strong>{account.addresses.length}</strong>
          <span className="muted">Addresses</span>
        </div>
        <div className="mini-stat">
          <strong>{account.paymentMethods.length}</strong>
          <span className="muted">Saved cards</span>
        </div>
        <div className="mini-stat">
          <strong>{account.cart.itemCount}</strong>
          <span className="muted">Cart items</span>
        </div>
        <div className="mini-stat">
          <strong>{account.recentOrders.length}</strong>
          <span className="muted">Recent orders</span>
        </div>
      </section>

      <section className="account-top-grid">
        <div className="form-card stack">
          <h2 className="section-title">Profile</h2>
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
          <button className="button" type="button" disabled={saving} onClick={updateProfile}>
            {saving ? "Saving..." : "Save profile"}
          </button>
          <div className="card">
            <strong>Account created</strong>
            <p className="muted">{new Date(account.profile.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title">Addresses</h2>
            {editingAddressId && (
              <button className="button-ghost" type="button" onClick={resetAddressForm}>
                Cancel edit
              </button>
            )}
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Label</label>
              <input value={addressForm.label} onChange={(event) => setAddressForm((current) => ({ ...current, label: event.target.value }))} />
            </div>
            <div className="field">
              <label>Full name</label>
              <input value={addressForm.fullName} onChange={(event) => setAddressForm((current) => ({ ...current, fullName: event.target.value }))} />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={addressForm.phoneNumber} onChange={(event) => setAddressForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
            </div>
            <div className="field">
              <label>Address line 1</label>
              <input value={addressForm.line1} onChange={(event) => setAddressForm((current) => ({ ...current, line1: event.target.value }))} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} />
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Postal code</label>
                <input value={addressForm.postalCode} onChange={(event) => setAddressForm((current) => ({ ...current, postalCode: event.target.value }))} />
              </div>
              <div className="field">
                <label>Country</label>
                <input value={addressForm.country} onChange={(event) => setAddressForm((current) => ({ ...current, country: event.target.value }))} />
              </div>
            </div>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={addressForm.isDefault}
              onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            <span>Set as default address</span>
          </label>
          <button className="button" type="button" disabled={saving} onClick={saveAddress}>
            {saving ? "Saving..." : editingAddressId ? "Update address" : "Add address"}
          </button>
          {account.addresses.map((address) => (
            <div key={address.id} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{address.label}</strong>
                  <p className="muted">
                    {address.fullName}
                    {address.phoneNumber ? ` | ${address.phoneNumber}` : ""}
                  </p>
                  <p className="muted">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                  </p>
                  <p className="muted">
                    {address.city}, {address.stateRegion ?? ""} {address.postalCode}, {address.country}
                  </p>
                </div>
                <div className="chip-row">
                  {address.isDefault && <span className="chip">Default</span>}
                  {!address.isDefault && (
                    <button className="button-ghost" type="button" disabled={saving} onClick={() => void setDefaultAddress(address.id)}>
                      Make default
                    </button>
                  )}
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => {
                      setEditingAddressId(address.id);
                      setAddressForm({
                        label: address.label,
                        fullName: address.fullName,
                        phoneNumber: address.phoneNumber ?? "",
                        line1: address.line1,
                        line2: address.line2 ?? "",
                        city: address.city,
                        stateRegion: address.stateRegion ?? "",
                        postalCode: address.postalCode,
                        country: address.country,
                        isDefault: address.isDefault,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className="button-ghost" type="button" disabled={saving} onClick={() => void deleteAddress(address.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title">Saved Cards</h2>
            {editingPaymentId && (
              <button className="button-ghost" type="button" onClick={resetPaymentForm}>
                Cancel edit
              </button>
            )}
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Nickname</label>
              <input value={paymentForm.nickname} onChange={(event) => setPaymentForm((current) => ({ ...current, nickname: event.target.value }))} />
            </div>
            <div className="field">
              <label>Cardholder name</label>
              <input value={paymentForm.cardholderName} onChange={(event) => setPaymentForm((current) => ({ ...current, cardholderName: event.target.value }))} />
            </div>
            {!editingPaymentId && (
              <>
                <div className="field">
                  <label>Card number</label>
                  <input value={paymentForm.cardNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, cardNumber: event.target.value.replace(/\D/g, "") }))} />
                </div>
                <div className="form-grid two">
                  <div className="field">
                    <label>Expiry month</label>
                    <input value={paymentForm.expMonth} onChange={(event) => setPaymentForm((current) => ({ ...current, expMonth: event.target.value.replace(/\D/g, "") }))} />
                  </div>
                  <div className="field">
                    <label>Expiry year</label>
                    <input value={paymentForm.expYear} onChange={(event) => setPaymentForm((current) => ({ ...current, expYear: event.target.value.replace(/\D/g, "") }))} />
                  </div>
                </div>
              </>
            )}
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={paymentForm.isDefault}
              onChange={(event) => setPaymentForm((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            <span>Set as default card</span>
          </label>
          <p className="muted">Only masked card details are stored.</p>
          <button className="button" type="button" disabled={saving} onClick={savePaymentMethod}>
            {saving ? "Saving..." : editingPaymentId ? "Update saved card" : "Add card"}
          </button>
          {account.paymentMethods.map((method) => (
            <div key={method.id} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{method.nickname || `${method.brand} ending ${method.last4}`}</strong>
                  <p className="muted">
                    {method.cardholderName} | {method.brand} **** {method.last4}
                  </p>
                  <p className="muted">
                    Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                  </p>
                </div>
                <div className="chip-row">
                  {method.isDefault && <span className="chip">Default</span>}
                  {!method.isDefault && (
                    <button className="button-ghost" type="button" disabled={saving} onClick={() => void setDefaultPaymentMethod(method.id)}>
                      Make default
                    </button>
                  )}
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => {
                      setEditingPaymentId(method.id);
                      setPaymentForm({
                        nickname: method.nickname ?? "",
                        cardholderName: method.cardholderName,
                        cardNumber: "",
                        expMonth: String(method.expMonth),
                        expYear: String(method.expYear),
                        isDefault: method.isDefault,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className="button-ghost" type="button" disabled={saving} onClick={() => void deletePaymentMethod(method.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Security</h2>
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

        <div className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title">Current Cart</h2>
            <Link className="button-secondary" href="/cart">
              Open cart
            </Link>
          </div>
          {account.cart.items.length ? (
            account.cart.items.map((item) => (
              <div key={item.productId} className="card">
                <strong>{item.title}</strong>
                <p className="muted">
                  {item.category} | Qty {item.quantity} | {formatCurrency(item.price)}
                </p>
                <p className="muted">Updated {new Date(item.updatedAt).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="muted">Your cart is currently empty.</p>
          )}
        </div>
      </section>

      <section className="form-card stack">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Recent Purchases</h2>
          <Link className="button-secondary" href="/orders">
            Full history
          </Link>
        </div>
        {account.recentOrders.length ? (
          account.recentOrders.map((order) => (
            <div key={order.id} className="card">
              <strong>{formatCurrency(order.totalPrice)}</strong>
              <p className="muted">
                {order.status} | {new Date(order.createdAt).toLocaleString()}
              </p>
              {order.specialRequest && <p className="muted">Request: {order.specialRequest}</p>}
            </div>
          ))
        ) : (
          <p className="muted">You have not placed any orders yet.</p>
        )}
      </section>
      </div>
    </RequireRole>
  );
}
