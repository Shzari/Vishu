"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function ClaimOrdersPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyClaim() {
      if (!token) {
        setError("Missing guest order claim token.");
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest<{ message: string }>(
          "/account/guest-orders/claim-verify",
          {
            method: "POST",
            body: JSON.stringify({ token }),
          },
        );
        setMessage(response.message);
      } catch (claimError) {
        setError(
          claimError instanceof Error
            ? claimError.message
            : "Failed to verify guest order claim.",
        );
      } finally {
        setLoading(false);
      }
    }

    void verifyClaim();
  }, [token]);

  return (
    <div className="checkout-shell">
      <section className="checkout-main checkout-success-panel">
        <span className="checkout-kicker">Guest order recovery</span>
        <h1 className="checkout-title">Order claim status</h1>
        {loading ? <p className="checkout-copy">Verifying your link…</p> : null}
        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        <div className="checkout-success-actions">
          <Link href="/account" className="button">
            Open my account
          </Link>
          <Link href="/orders" className="button-secondary">
            My orders
          </Link>
        </div>
      </section>
    </div>
  );
}
