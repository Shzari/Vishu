import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Vishu",
  description: "How Vishu collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="auth-page legal-page">
      <div className="legal-content">
        <h1 className="hero-title">Privacy Policy</h1>
        <p className="muted">Last updated: April 2026</p>

        <section className="legal-section">
          <h2>1. Data We Collect</h2>
          <p>When you use Vishu, we may collect:</p>
          <ul>
            <li>Account information: name, email address, password (hashed)</li>
            <li>Order information: shipping address, items purchased, payment status</li>
            <li>Usage data: pages visited, search queries, device/browser type</li>
            <li>Vendor data: shop name, product listings, business details</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Process and fulfil orders</li>
            <li>Send order confirmations and transactional emails</li>
            <li>Provide customer support</li>
            <li>Improve the Platform and detect fraud</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </section>

        <section className="legal-section">
          <h2>3. Cookies</h2>
          <p>
            Vishu uses session cookies for authentication. No third-party tracking or advertising
            cookies are used. You can disable cookies in your browser, but this may affect
            Platform functionality.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Data Retention</h2>
          <p>
            Account data is retained for as long as your account is active. Order records are
            retained for 7 years for legal and accounting purposes. You may request deletion of
            your account at any time.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Your GDPR Rights</h2>
          <p>If you are in the EU, you have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
            <li>Object to processing or request restriction</li>
            <li>Data portability</li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a href="mailto:privacy@vishu.shop">privacy@vishu.shop</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Data Security</h2>
          <p>
            We use industry-standard measures including HTTPS, hashed passwords, and JWT-based
            authentication. No transmission over the internet is 100% secure. Use the Platform at
            your own risk.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Changes to This Policy</h2>
          <p>
            We may update this policy at any time. We will notify registered users of material
            changes by email.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Contact</h2>
          <p>
            Privacy questions or deletion requests:{" "}
            <a href="mailto:privacy@vishu.shop">privacy@vishu.shop</a>
          </p>
        </section>
      </div>
    </div>
  );
}
