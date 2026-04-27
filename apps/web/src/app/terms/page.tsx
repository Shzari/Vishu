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
        <p className="muted">Last updated: April 2026</p>

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
            products as a guest, but purchasing requires account registration. You are responsible
            for maintaining the confidentiality of your account credentials.
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
            Return policies vary by vendor. Each vendor&apos;s return policy is displayed on their
            shop page. Disputes between buyers and vendors should be directed to the vendor first.
            If unresolved, contact us at support@vishu.shop.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Vendor Responsibilities</h2>
          <p>
            Vendors are responsible for the accuracy of their product listings, stock levels, and
            fulfilment of orders. Misrepresentation of products may result in account suspension.
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
