import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Vishu",
  description: "Terms and conditions for using Vishu marketplace.",
};

export default function TermsPage() {
  return (
    <div className="auth-page legal-page">
      <div className="legal-content">
        <h1 className="hero-title">Terms of Service</h1>
        <p className="muted">Last updated: May 2026</p>

        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Vishu (&quot;the Platform&quot;), you agree to be bound by these
            Terms of Service. If you do not agree, please do not use the Platform.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Use of the Platform</h2>
          <p>
            Vishu is a marketplace connecting buyers and independent vendors. You may browse
            products, add items to cart, and place eligible orders as a guest. If you create an
            account, you are responsible for maintaining the confidentiality of your account
            credentials.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Orders and Payments</h2>
          <p>
            All prices are displayed in EUR. Orders are subject to product availability. Vishu
            reserves the right to cancel any order due to pricing errors, stock issues, or
            suspected fraud. You will be notified by email if an order is cancelled.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Returns and Refunds</h2>
          <p>
            Vendors that sell on Vishu agree to follow Vishu&apos;s marketplace refund policy.
            A vendor may publish shop-specific return instructions, such as return address,
            product condition requirements, or handling steps, but those instructions cannot
            remove customer rights, block an approved refund, or conflict with these Terms.
          </p>
          <p>
            Refunds may be approved when an order is cancelled before fulfilment, an item is not
            delivered, the wrong item is delivered, an item is materially different from the
            listing, or a product arrives damaged or defective. Some products may be ineligible
            for return after use, damage by the customer, hygiene restriction, customisation, or
            other lawful exception.
          </p>
          <p>
            Customers should contact the vendor first where possible. If the issue is unresolved,
            Vishu may review the order, messages, delivery status, product listing, and evidence
            from both sides. Vendors must cooperate with Vishu&apos;s review and honour refund or
            return outcomes approved through the Platform.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Vendor Responsibilities</h2>
          <p>
            Vendors are responsible for the accuracy of their product listings, stock levels, and
            fulfilment of orders. Misrepresentation of products may result in account suspension.
          </p>
          <p>
            By creating or operating a vendor account, the vendor confirms that they accept these
            Terms, the Marketplace Policy, and Vishu&apos;s refund rules. Vendors that repeatedly
            refuse valid refund requests, delay resolution, or publish return terms that conflict
            with Vishu policy may have products hidden, payouts delayed where lawful, or their
            shop suspended.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Intellectual Property</h2>
          <p>
            All content on the Platform, including logos, design, and text, belongs to Vishu or
            its licensors. Product images remain the property of the respective vendors.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Limitation of Liability</h2>
          <p>
            Vishu acts as an intermediary marketplace and is not liable for vendor product quality,
            delivery delays, or disputes between buyers and vendors beyond the remedies provided
            in these Terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the European Union. Any disputes shall be
            resolved in the competent courts of the applicable jurisdiction.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Platform after changes
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a href="mailto:support@vishu.shop">support@vishu.shop</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
