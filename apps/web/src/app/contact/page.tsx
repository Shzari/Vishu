import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Vishu",
  description: "Get in touch with the Vishu team.",
};

export default function ContactPage() {
  return (
    <div className="auth-page auth-page-compact">
      <section className="auth-intro">
        <h1 className="hero-title">Contact us</h1>
        <p className="hero-copy">
          Have a question, issue, or feedback? We&apos;d love to hear from you.
        </p>
      </section>

      <div className="legal-content">
        <section className="legal-section">
          <h2>General support</h2>
          <p>
            For order issues, account questions, or general enquiries:{" "}
            <a href="mailto:support@vishu.shop">support@vishu.shop</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>Vendor enquiries</h2>
          <p>
            Interested in selling on Vishu or need help with your vendor account?{" "}
            <a href="mailto:vendors@vishu.shop">vendors@vishu.shop</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>Privacy and data</h2>
          <p>
            For GDPR requests or privacy concerns:{" "}
            <a href="mailto:privacy@vishu.shop">privacy@vishu.shop</a>
          </p>
        </section>

        <p className="muted" style={{ marginTop: "2rem" }}>
          We aim to respond within 2 business days.
        </p>
      </div>
    </div>
  );
}
