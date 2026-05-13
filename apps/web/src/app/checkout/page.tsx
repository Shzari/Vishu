"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import { useAuth, useCart } from "@/components/providers";
import type {
  CheckoutPaymentSettings,
  CustomerAccount,
  CustomerAddress,
  CustomerOrder,
} from "@/lib/types";

type CheckoutForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  city: string;
  addressLine1: string;
  apartmentOrNote: string;
  specialRequest: string;
};

type SaveAddressPrompt = {
  fullName: string;
  phoneNumber: string;
  city: string;
  addressLine1: string;
  apartmentOrNote: string;
};

const NEW_ADDRESS_OPTION = "__new__";

const emptyCheckoutForm: CheckoutForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  city: "",
  addressLine1: "",
  apartmentOrNote: "",
  specialRequest: "",
};

function getDefaultAddress(account: CustomerAccount | null) {
  if (!account) {
    return null;
  }

  return account.addresses.find((entry) => entry.isDefault) ?? account.addresses[0] ?? null;
}

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesAddress(
  address: CustomerAddress,
  addressForm: SaveAddressPrompt,
  fullName: string,
  phoneNumber: string,
) {
  return (
    normalizeValue(address.fullName) === normalizeValue(fullName) &&
    normalizeValue(address.phoneNumber) === normalizeValue(phoneNumber) &&
    normalizeValue(address.line1) === normalizeValue(addressForm.addressLine1) &&
    normalizeValue(address.line2) === normalizeValue(addressForm.apartmentOrNote) &&
    normalizeValue(address.city) === normalizeValue(addressForm.city)
  );
}

function formatAddressLine(address: CustomerAddress) {
  return [address.line1, address.line2].filter(Boolean).join(", ");
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, currentRole, loading: authLoading } = useAuth();
  const { items, clearCart } = useCart();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<CheckoutPaymentSettings | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm);
  const [selectedAddressId, setSelectedAddressId] = useState(NEW_ADDRESS_OPTION);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<CustomerOrder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [saveAddressPrompt, setSaveAddressPrompt] = useState<SaveAddressPrompt | null>(null);
  const [savingAddressChoice, setSavingAddressChoice] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCustomer = (currentRole === "customer" || currentRole === "vendor") && Boolean(token);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const savedAddresses = useMemo(() => account?.addresses ?? [], [account]);
  const selectedSavedAddress = useMemo(
    () => savedAddresses.find((entry) => entry.id === selectedAddressId) ?? null,
    [savedAddresses, selectedAddressId],
  );
  const usingNewAddress =
    !isCustomer || selectedAddressId === NEW_ADDRESS_OPTION || !selectedSavedAddress;
  const activeCity = selectedSavedAddress?.city ?? form.city;
  const activeAddressLine1 = selectedSavedAddress?.line1 ?? form.addressLine1;
  const activeApartmentOrNote = selectedSavedAddress?.line2 ?? form.apartmentOrNote;
  const missingContactFields = {
    fullName: !form.fullName.trim(),
    email: !form.email.trim(),
    phoneNumber: !form.phoneNumber.trim(),
  };
  const canPlaceOrder =
    items.length > 0 &&
    form.fullName.trim() &&
    form.email.trim() &&
    form.phoneNumber.trim() &&
    activeCity.trim() &&
    activeAddressLine1.trim();

  useEffect(() => {
    async function loadPaymentSettings() {
      try {
        const settings = await apiRequest<CheckoutPaymentSettings>("/checkout/payment-settings");
        setPaymentSettings(settings);
      } catch (settingsError) {
        setError(
          settingsError instanceof Error
            ? settingsError.message
            : "Failed to load payment settings.",
        );
      }
    }

    void loadPaymentSettings();
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if (paymentState === "cancel") {
      setMessage("Card checkout was cancelled. You can try again or choose cash on delivery.");
      router.replace("/checkout", { scroll: false });
      return;
    }

    if (paymentState !== "success" || !sessionId) {
      return;
    }

    if (authLoading) {
      setMessage("Confirming your sign-in before completing payment...");
      return;
    }

    const completedSessionId = sessionId;

    async function completeStripeOrder() {
      try {
        setPlacingOrder(true);
        setError(null);
        setMessage("Confirming card payment...");
        const response = await apiRequest<CustomerOrder>(
          isCustomer
            ? `/orders/stripe-checkout/${encodeURIComponent(completedSessionId)}/complete`
            : `/orders/guest/stripe-checkout/${encodeURIComponent(completedSessionId)}/complete`,
          { method: "POST" },
          isCustomer ? token ?? undefined : undefined,
        );
        setPlacedOrder(response);
        clearCart();
        setMessage(`Order ${response.orderNumber} placed successfully.`);
        router.replace("/checkout", { scroll: false });
      } catch (completeError) {
        setError(
          completeError instanceof Error
            ? completeError.message
            : "Could not confirm Stripe payment.",
        );
      } finally {
        setPlacingOrder(false);
      }
    }

    void completeStripeOrder();
  }, [authLoading, clearCart, isCustomer, router, searchParams, token]);

  useEffect(() => {
    async function loadAccount() {
      if (!token || (currentRole !== "customer" && currentRole !== "vendor")) {
        setAccount(null);
        setSelectedAddressId(NEW_ADDRESS_OPTION);
        return;
      }

      try {
        setAccountLoading(true);
        const data = await apiRequest<CustomerAccount>("/account/me", undefined, token);
        const preferredAddress = getDefaultAddress(data);

        setAccount(data);
        setSelectedAddressId(preferredAddress?.id ?? NEW_ADDRESS_OPTION);
        setForm((current) => ({
          ...current,
          fullName: current.fullName || data.profile.fullName || preferredAddress?.fullName || "",
          email: current.email || data.profile.email || "",
          phoneNumber:
            current.phoneNumber ||
            data.profile.phoneNumber ||
            preferredAddress?.phoneNumber ||
            "",
        }));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load saved checkout details.",
        );
      } finally {
        setAccountLoading(false);
      }
    }

    void loadAccount();
  }, [currentRole, token]);

  const summaryItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        total: item.price * item.quantity,
      })),
    [items],
  );

  async function saveAddressChoice(mode: "skip" | "save" | "default") {
    if (!saveAddressPrompt) {
      return;
    }

    if (mode === "skip") {
      setSaveAddressPrompt(null);
      setMessage(`Order ${placedOrder?.orderNumber ?? ""} placed successfully.`.trim());
      return;
    }

    try {
      setSavingAddressChoice(true);
      setError(null);

      const updatedAccount = await apiRequest<CustomerAccount>(
        "/account/addresses",
        {
          method: "POST",
          body: JSON.stringify({
            label: mode === "default" ? "Default delivery" : "Saved delivery",
            fullName: saveAddressPrompt.fullName,
            phoneNumber: saveAddressPrompt.phoneNumber,
            line1: saveAddressPrompt.addressLine1,
            line2: saveAddressPrompt.apartmentOrNote || undefined,
            city: saveAddressPrompt.city,
            postalCode: "-",
            country: "Local marketplace",
            isDefault: mode === "default",
          }),
        },
        token,
      );

      const nextDefaultAddress = getDefaultAddress(updatedAccount);
      setAccount(updatedAccount);
      setSelectedAddressId(
        mode === "default" && nextDefaultAddress ? nextDefaultAddress.id : selectedAddressId,
      );
      setSaveAddressPrompt(null);
      setMessage(
        mode === "default"
          ? "Order placed and this address is now your default."
          : "Order placed and this address is saved for next time.",
      );
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : "Failed to save address.");
    } finally {
      setSavingAddressChoice(false);
    }
  }

  function requestPlaceOrder() {
    if (!canPlaceOrder) {
      setError("Please complete the contact and delivery details first.");
      return;
    }

    if (paymentSettings && !paymentSettings.cashOnDeliveryEnabled) {
      setError("Cash on delivery is not available right now.");
      return;
    }

    setError(null);
    setConfirmOrderOpen(true);
  }

  async function placeOrder() {
    if (!canPlaceOrder) {
      setError("Please complete the contact and delivery details first.");
      return;
    }

    const deliverySnapshot = {
      city: activeCity.trim(),
      addressLine1: activeAddressLine1.trim(),
      apartmentOrNote: activeApartmentOrNote.trim(),
    };

    try {
      setPlacingOrder(true);
      setError(null);
      setMessage(null);
      setConfirmOrderOpen(false);

      if (paymentSettings && !paymentSettings.cashOnDeliveryEnabled) {
        setError("Cash on delivery is not available right now.");
        return;
      }

      const payload = {
        items: items.map((item) => ({
          productId: item.productId,
          sizeId: item.sizeId || undefined,
          quantity: item.quantity,
        })),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        city: deliverySnapshot.city,
        addressLine1: deliverySnapshot.addressLine1,
        apartmentOrNote: deliverySnapshot.apartmentOrNote || undefined,
        specialRequest: form.specialRequest.trim() || undefined,
        paymentMethod: "cash_on_delivery" as const,
      };

      const response = await apiRequest<CustomerOrder>(
        isCustomer ? "/orders" : "/orders/guest",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        isCustomer ? token ?? undefined : undefined,
      );

      setPlacedOrder(response);
      clearCart();

      setMessage(
        isCustomer
          ? `Order ${response.orderNumber} placed successfully.`
          : `Guest order ${response.orderNumber} placed successfully.`,
      );
      if (isCustomer) {
        redirectTimerRef.current = setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (checkoutError) {
      setMessage(null);
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
    } finally {
      setPlacingOrder(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="checkout-shell">
        <section className="checkout-main checkout-success-panel">
          <span className="checkout-kicker">Order placed</span>
          <h1 className="checkout-title">Your order is confirmed.</h1>

          {message ? <div className="message success">{message}</div> : null}
          {error ? <div className="message error">{error}</div> : null}

          <div className="checkout-success-meta">
            <div className="checkout-success-row">
              <span>Order number</span>
              <strong>{placedOrder.orderNumber}</strong>
            </div>
            <div className="checkout-success-row">
              <span>Total</span>
              <strong>{formatCurrency(placedOrder.totalPrice)}</strong>
            </div>
            <div className="checkout-success-row">
              <span>Payment</span>
              <strong>Cash on delivery</strong>
            </div>
          </div>

          <p className="muted">
            {isCustomer
              ? "Taking you back to Vishu..."
              : "You can continue shopping or create an account later to connect this order."}
          </p>

          {!isCustomer ? (
            <div className="checkout-guest-followup">
              <strong>No login was needed for this order.</strong>
              <div className="checkout-success-actions">
                <Link href="/" className="button">
                  Continue shopping
                </Link>
                <Link href="/login" className="button-secondary">
                  Sign in later
                </Link>
              </div>
            </div>
          ) : (
            <div className="checkout-success-actions">
              <Link href="/orders" className="button">
                View my orders
              </Link>
              <Link href="/" className="button-secondary">
                Continue shopping
              </Link>
            </div>
          )}
        </section>

        {saveAddressPrompt ? (
          <div
            className="account-modal-backdrop"
            role="presentation"
            onClick={() => !savingAddressChoice && void saveAddressChoice("skip")}
          >
            <div
              className="account-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-save-address-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="account-subsection-head">
                <div>
                  <h2 id="checkout-save-address-title">Save this address for next time?</h2>
                </div>
                <button
                  type="button"
                  className="button-ghost"
                  disabled={savingAddressChoice}
                  onClick={() => void saveAddressChoice("skip")}
                >
                  Close
                </button>
              </div>

              <div className="checkout-address-preview">
                <strong>{saveAddressPrompt.fullName}</strong>
                <span>{saveAddressPrompt.phoneNumber}</span>
                <span>{saveAddressPrompt.addressLine1}</span>
                {saveAddressPrompt.apartmentOrNote ? (
                  <span>{saveAddressPrompt.apartmentOrNote}</span>
                ) : null}
                <span>{saveAddressPrompt.city}</span>
              </div>

              <div className="account-card-actions account-modal-actions checkout-save-address-actions">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={savingAddressChoice}
                  onClick={() => void saveAddressChoice("skip")}
                >
                  Just this order
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={savingAddressChoice}
                  onClick={() => void saveAddressChoice("save")}
                >
                  {savingAddressChoice ? "Saving..." : "Save address"}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={savingAddressChoice}
                  onClick={() => void saveAddressChoice("default")}
                >
                  {savingAddressChoice ? "Saving..." : "Save as default"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="checkout-shell">
      <section className="checkout-main">
        <div className="checkout-head">
          <div>
            <span className="checkout-kicker">Checkout</span>
            <h1 className="checkout-title">Fast local checkout</h1>
          </div>
          <div className="checkout-head-actions">
            {!isCustomer ? (
              <>
                <Link className="table-link" href="/login">
                  Sign in
                </Link>
                <Link className="table-link" href="/register">
                  Create account
                </Link>
              </>
            ) : (
              <Link className="table-link" href="/account">
                Saved account details
              </Link>
            )}
          </div>
        </div>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        {items.length === 0 ? (
          <div className="checkout-empty">
            <strong>Your cart is empty.</strong>
            <Link href="/" className="button">
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Contact</h2>
              </div>

              {isCustomer ? (
                <>
                  <div className="checkout-contact-summary">
                    <article className="checkout-contact-card">
                      <span>Full name</span>
                      <strong>{form.fullName || "Needed for checkout"}</strong>
                    </article>
                    <article className="checkout-contact-card">
                      <span>Email</span>
                      <strong>{form.email || "Needed for checkout"}</strong>
                    </article>
                    <article className="checkout-contact-card">
                      <span>Phone number</span>
                      <strong>{form.phoneNumber || "Needed for checkout"}</strong>
                    </article>
                  </div>

                  {missingContactFields.fullName ||
                  missingContactFields.email ||
                  missingContactFields.phoneNumber ? (
                    <div className="checkout-form-grid">
                      {missingContactFields.fullName ? (
                        <label className="field">
                          <span>Full name</span>
                          <input
                            value={form.fullName}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                fullName: event.target.value,
                              }))
                            }
                            placeholder="Full name"
                          />
                        </label>
                      ) : null}

                      {missingContactFields.email ? (
                        <label className="field">
                          <span>Email</span>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            placeholder="you@example.com"
                          />
                        </label>
                      ) : null}

                      {missingContactFields.phoneNumber ? (
                        <label className="field">
                          <span>Phone number</span>
                          <input
                            value={form.phoneNumber}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                phoneNumber: event.target.value,
                              }))
                            }
                            placeholder="Phone number"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                </>
              ) : (
                <div className="checkout-form-grid">
                  <label className="field">
                    <span>Full name</span>
                    <input
                      value={form.fullName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      placeholder="Full name"
                    />
                  </label>

                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="you@example.com"
                    />
                  </label>

                  <label className="field">
                    <span>Phone number</span>
                    <input
                      value={form.phoneNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phoneNumber: event.target.value,
                        }))
                      }
                      placeholder="Phone number"
                    />
                  </label>
                </div>
              )}

            </section>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Delivery details</h2>
              </div>

              {isCustomer ? (
                <>
                  <div className="checkout-address-options">
                    {savedAddresses.map((address) => (
                      <label
                        key={address.id}
                        className={`checkout-address-choice${
                          selectedAddressId === address.id ? " is-selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="delivery-address"
                          checked={selectedAddressId === address.id}
                          onChange={() => setSelectedAddressId(address.id)}
                        />
                        <div className="checkout-choice-copy">
                          <strong>{address.isDefault ? "Default address" : address.label}</strong>
                          <p>{formatAddressLine(address)}</p>
                          <span>{address.city}</span>
                        </div>
                      </label>
                    ))}

                    <label
                      className={`checkout-address-choice${
                        selectedAddressId === NEW_ADDRESS_OPTION ? " is-selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="delivery-address"
                        checked={selectedAddressId === NEW_ADDRESS_OPTION}
                        onChange={() => setSelectedAddressId(NEW_ADDRESS_OPTION)}
                      />
                      <div className="checkout-choice-copy">
                        <strong>Add new address</strong>
                      </div>
                    </label>
                  </div>

                  {usingNewAddress ? (
                    <div className="checkout-form-grid">
                      <label className="field">
                        <span>City</span>
                        <input
                          value={form.city}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              city: event.target.value,
                            }))
                          }
                          placeholder="City"
                        />
                      </label>

                      <label className="field checkout-field-wide">
                        <span>Address</span>
                        <input
                          value={form.addressLine1}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              addressLine1: event.target.value,
                            }))
                          }
                          placeholder="Street and building"
                        />
                      </label>

                      <label className="field checkout-field-wide">
                        <span>Apartment or delivery note</span>
                        <input
                          value={form.apartmentOrNote}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              apartmentOrNote: event.target.value,
                            }))
                          }
                          placeholder="Apartment, floor, or local delivery note"
                        />
                      </label>
                    </div>
                  ) : selectedSavedAddress ? (
                    <div className="checkout-address-preview">
                      <strong>
                        {selectedSavedAddress.isDefault
                          ? "Default address"
                          : selectedSavedAddress.label}
                      </strong>
                      <span>{selectedSavedAddress.fullName}</span>
                      {selectedSavedAddress.phoneNumber ? (
                        <span>{selectedSavedAddress.phoneNumber}</span>
                      ) : null}
                      <span>{formatAddressLine(selectedSavedAddress)}</span>
                      <span>{selectedSavedAddress.city}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="checkout-form-grid">
                  <label className="field">
                    <span>City</span>
                    <input
                      value={form.city}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      placeholder="City"
                    />
                  </label>

                  <label className="field checkout-field-wide">
                    <span>Address</span>
                    <input
                      value={form.addressLine1}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          addressLine1: event.target.value,
                        }))
                      }
                      placeholder="Street and building"
                    />
                  </label>

                  <label className="field checkout-field-wide">
                    <span>Apartment or delivery note</span>
                    <input
                      value={form.apartmentOrNote}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          apartmentOrNote: event.target.value,
                        }))
                      }
                      placeholder="Apartment, floor, or local delivery note"
                    />
                  </label>
                </div>
              )}

              <div className="checkout-form-grid">
                <label className="field checkout-field-wide">
                  <span>Order note</span>
                  <textarea
                    value={form.specialRequest}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        specialRequest: event.target.value,
                      }))
                    }
                    placeholder="Optional delivery or packaging note"
                  />
                </label>
              </div>
            </section>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Payment method</h2>
              </div>

              {paymentSettings?.cashOnDeliveryEnabled !== false ? (
                <label className="checkout-payment-choice">
                  <input
                    type="radio"
                    name="payment-method"
                    checked
                    readOnly
                  />
                  <div>
                    <strong>Cash on delivery</strong>
                  </div>
                </label>
              ) : null}

              {paymentSettings && !paymentSettings.cashOnDeliveryEnabled ? (
                <div className="message error">No payment methods are enabled right now.</div>
              ) : null}

              {isCustomer && accountLoading ? (
                <p className="muted">Loading saved details...</p>
              ) : null}
            </section>
          </>
        )}
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-card">
          <div className="checkout-summary-head">
            <h2>Order summary</h2>
            <span>{totalUnits} units</span>
          </div>

          <div className="checkout-summary-list">
            {summaryItems.map((item) => (
              <div key={item.productId} className="checkout-summary-item">
                <div className="checkout-summary-item-media">
                  {item.image ? (
                    <img
                      src={assetUrl(item.image)}
                      alt={item.title}
                      className="checkout-summary-item-image"
                    />
                  ) : (
                    <span className="checkout-summary-item-placeholder">Vishu</span>
                  )}
                </div>
                <div className="checkout-summary-item-copy">
                  <strong>{item.title}</strong>
                  {(item.color || item.size) && (
                    <span className="checkout-summary-item-meta">
                      {[item.color, item.size].filter(Boolean).join(" - ")}
                    </span>
                  )}
                  <span className="checkout-summary-item-total">
                    Qty {item.quantity} - {formatCurrency(item.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-summary-totals">
            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="checkout-summary-row">
              <span>Total</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
          </div>

          <button
            className="button checkout-submit"
            type="button"
            onClick={requestPlaceOrder}
            disabled={placingOrder || items.length === 0}
          >
            {placingOrder ? "Placing order..." : "Place order"}
          </button>

          <Link href="/cart" className="button-secondary checkout-back-link">
            Back to cart
          </Link>
        </div>
      </aside>

      {confirmOrderOpen ? (
        <div
          className="account-modal-backdrop"
          role="presentation"
          onClick={() => !placingOrder && setConfirmOrderOpen(false)}
        >
          <div
            className="account-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-confirm-order-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="account-subsection-head">
              <div>
                <h2 id="checkout-confirm-order-title">Confirm cash on delivery order?</h2>
              </div>
              <button
                type="button"
                className="button-ghost"
                disabled={placingOrder}
                onClick={() => setConfirmOrderOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="checkout-address-preview">
              <strong>{form.fullName.trim()}</strong>
              <span>{form.phoneNumber.trim()}</span>
              <span>{activeAddressLine1.trim()}</span>
              {activeApartmentOrNote.trim() ? <span>{activeApartmentOrNote.trim()}</span> : null}
              <span>{activeCity.trim()}</span>
              <span>Total {formatCurrency(subtotal)}</span>
            </div>

            <div className="account-card-actions account-modal-actions">
              <button
                type="button"
                className="button-secondary"
                disabled={placingOrder}
                onClick={() => setConfirmOrderOpen(false)}
              >
                Review order
              </button>
              <button
                type="button"
                className="button"
                disabled={placingOrder}
                onClick={() => void placeOrder()}
              >
                {placingOrder ? "Placing order..." : "Confirm order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
