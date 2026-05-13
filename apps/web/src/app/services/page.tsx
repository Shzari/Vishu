import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Services | Vishu",
  description: "Customer, vendor, marketplace, payment, and support services from Vishu.shop.",
};

export default function ServicesPage() {
  return (
    <div className="auth-page legal-page services-page">
      <div className="legal-content">
        <h1 className="hero-title">Services</h1>
        <p className="hero-copy">
          Vishu connects customers with independent fashion vendors and keeps the buying, selling,
          payment, and support experience in one marketplace.
        </p>

        <section className="legal-section">
          <h2>Marketplace Shopping</h2>
          <p>
            Customers can browse products, compare shops, save favorite items, add products to cart,
            and place orders through the Vishu storefront.
          </p>
        </section>

        <section className="legal-section">
          <h2>Vendor Shop Tools</h2>
          <p>
            Approved vendors can manage shop profiles, product listings, stock, order fulfilment,
            return information, and marketplace visibility from the vendor workspace.
          </p>
        </section>

        <section className="legal-section">
          <h2>Checkout and Payments</h2>
          <p>
            Vishu supports hosted card checkout through Stripe when card payments are enabled, plus
            cash on delivery where supported. Payment settings and order completion are managed by
            the platform.
          </p>
        </section>

        <section className="legal-section">
          <h2>Account Support</h2>
          <p>
            Customers can manage account details, password security, saved addresses, favorites,
            recent orders, returns, and support shortcuts from the account area.
          </p>
        </section>

        <section className="legal-section">
          <h2>Policy and Help</h2>
          <p>
            Review the <Link href="/policy">Marketplace Policy</Link>,{" "}
            <Link href="/terms">Terms of Service</Link>, and{" "}
            <Link href="/privacy">Privacy Policy</Link>. For direct help, email{" "}
            <a href="mailto:support@vishu.shop">support@vishu.shop</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
