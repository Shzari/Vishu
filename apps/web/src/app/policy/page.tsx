import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Marketplace Policy | Vishu",
  description: "Customer, vendor, order, return, and platform policies for Vishu.shop.",
};

export default function PolicyPage() {
  return (
    <div className="auth-page legal-page">
      <div className="legal-content">
        <h1 className="hero-title">Marketplace Policy</h1>
        <p className="muted">Last updated: May 2026</p>

        <section className="legal-section">
          <h2>Customer Policy</h2>
          <p>
            Customers may browse Vishu, save favorites, place eligible orders, and contact support
            for order or account help. Customers are responsible for providing accurate delivery
            details and keeping account credentials secure.
          </p>
        </section>

        <section className="legal-section">
          <h2>Vendor Policy</h2>
          <p>
            Vendors are responsible for accurate product listings, stock availability, pricing,
            order fulfilment, and shop return information. Vishu may review, hide, or suspend
            shops that provide misleading listings, unsafe products, or unresolved customer issues.
          </p>
          <p>
            Every vendor approved to sell on Vishu accepts the platform refund policy. A shop may
            add its own return instructions, but it may not refuse a refund or return that Vishu
            approves under marketplace policy or applicable customer protection rules.
          </p>
        </section>

        <section className="legal-section">
          <h2>Orders and Payments</h2>
          <p>
            Card payments are processed through Stripe hosted checkout when enabled. Cash on
            delivery may be available where supported by the vendor. Orders may be cancelled when
            products are unavailable, payment cannot be verified, or fraud checks require action.
          </p>
        </section>

        <section className="legal-section">
          <h2>Refund and Return Policy</h2>
          <p>
            Customers can request help with refunds or returns for cancelled orders, missing
            deliveries, damaged or defective products, wrong items, or products that materially do
            not match the listing. Return eligibility can depend on product type, condition,
            timing, hygiene rules, customisation, and delivery evidence.
          </p>
          <p>
            Vendors must respond in good faith, provide return instructions when needed, and follow
            Vishu&apos;s decision when a refund or return is approved. Vendor shop policies may explain
            how returns are handled, but they cannot override Vishu&apos;s refund policy or mandatory
            customer rights.
          </p>
          <p>
            Customers should review the vendor return policy on the shop or product page and
            contact support if an issue cannot be resolved directly.
          </p>
        </section>

        <section className="legal-section">
          <h2>Data and Privacy</h2>
          <p>
            Vishu handles account, order, and support data according to the{" "}
            <Link href="/privacy">Privacy Policy</Link>. Privacy or deletion requests can be sent
            to <a href="mailto:privacy@vishu.shop">privacy@vishu.shop</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Need Help?</h2>
          <p>
            For order, account, vendor, or policy questions, contact{" "}
            <a href="mailto:support@vishu.shop">support@vishu.shop</a> or visit{" "}
            <Link href="/contact">Contact</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
