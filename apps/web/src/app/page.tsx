"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, assetUrl } from "@/lib/api";
import { getMerchantUrl } from "@/lib/merchant-domain";
import type { HomepageHeroConfig, HomepageHeroSlide } from "@/lib/types";

const FALLBACK_HERO: HomepageHeroConfig = {
  autoRotate: true,
  intervalSeconds: 6,
  slides: [],
};

export default function HomePage() {
  const [homepageHero, setHomepageHero] =
    useState<HomepageHeroConfig>(FALLBACK_HERO);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPromotion() {
      try {
        const heroData = await apiRequest<HomepageHeroConfig>("/homepage-hero");
        if (active) {
          setHomepageHero(heroData);
        }
      } catch {
        if (active) {
          setHomepageHero(FALLBACK_HERO);
        }
      }
    }

    void loadPromotion();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!homepageHero.autoRotate || homepageHero.slides.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % homepageHero.slides.length);
    }, Math.max(homepageHero.intervalSeconds, 3) * 1000);

    return () => window.clearInterval(interval);
  }, [homepageHero.autoRotate, homepageHero.intervalSeconds, homepageHero.slides.length]);

  const activeSlide = homepageHero.slides[activeHeroIndex] ?? null;

  return (
    <main className="coming-soon-page" data-no-translate="true">
      <section className="coming-soon-hero">
        <div className="coming-soon-copy">
          <span className="coming-soon-eyebrow">Vishu.shop</span>
          <h1>Marketplace coming soon.</h1>
          <p>
            Vishu is preparing a curated fashion marketplace for customers and
            local shops. Product browsing will open when the public launch is
            ready.
          </p>
          <div className="coming-soon-actions">
            <Link className="button" href={getMerchantUrl("/")}>
              Merchant portal
            </Link>
            <Link className="button-secondary" href="/contact">
              Contact Vishu
            </Link>
          </div>
        </div>

        <div className="coming-soon-promotion" aria-label="Vishu promotion">
          {activeSlide ? (
            <PromotionSlide slide={activeSlide} />
          ) : (
            <div className="coming-soon-placeholder">
              <span>Vishu</span>
              <strong>New fashion marketplace</strong>
              <p>Promotions and launch updates will appear here soon.</p>
            </div>
          )}
          {homepageHero.slides.length > 1 ? (
            <div className="coming-soon-dots" aria-label="Promotion slides">
              {homepageHero.slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={index === activeHeroIndex ? "active" : ""}
                  aria-label={`Show promotion ${index + 1}`}
                  aria-pressed={index === activeHeroIndex}
                  onClick={() => setActiveHeroIndex(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="coming-soon-info">
        <div>
          <span>For customers</span>
          <strong>Shopping opens soon</strong>
          <p>Products, shops, cart, and checkout are hidden until launch.</p>
        </div>
        <div>
          <span>For shops</span>
          <strong>Vendor tools stay open</strong>
          <p>Approved merchants can keep preparing products and store details.</p>
        </div>
        <div>
          <span>For launch</span>
          <strong>Promotion first</strong>
          <p>The public site now focuses only on launch messaging.</p>
        </div>
      </section>
    </main>
  );
}

function PromotionSlide({ slide }: { slide: HomepageHeroSlide }) {
  const imageUrl = assetUrl(slide.imageUrl || slide.mobileImageUrl || "");

  if (!imageUrl) {
    return (
      <div className="coming-soon-placeholder">
        <span>Vishu</span>
        <strong>{slide.internalName || "Launch promotion"}</strong>
        <p>Promotion image will appear here soon.</p>
      </div>
    );
  }

  return (
    <picture className="coming-soon-picture">
      {slide.mobileImageUrl ? (
        <source media="(max-width: 720px)" srcSet={assetUrl(slide.mobileImageUrl)} />
      ) : null}
      <img src={imageUrl} alt={slide.internalName || "Vishu promotion"} />
    </picture>
  );
}
