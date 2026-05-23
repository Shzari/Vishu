"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { apiRequest, assetUrl } from "@/lib/api";
import { getMerchantUrl } from "@/lib/merchant-domain";
import type { HomepageHeroConfig, HomepageHeroSlide } from "@/lib/types";

const FALLBACK_HERO: HomepageHeroConfig = {
  autoRotate: true,
  intervalSeconds: 6,
  slides: [],
};

const launchCopy = {
  en: {
    eyebrow: "Vishu.shop",
    title: "Coming soon",
    body: "We are preparing Vishu for launch. Product browsing, shops, cart, and checkout will open when the marketplace is ready.",
    merchantPortal: "Merchant portal",
    contact: "Contact Vishu",
    customersLabel: "Customers",
    customersTitle: "Shopping opens soon",
    customersBody: "The public marketplace is hidden until launch.",
    shopsLabel: "Businesses",
    shopsTitle: "Business tools stay open",
    shopsBody: "Approved businesses can keep preparing products and shop details.",
  },
  sq: {
    eyebrow: "Vishu.shop",
    title: "Së shpejti",
    body: "Po e përgatisim Vishu për lansim. Produktet, dyqanet, shporta dhe pagesa do të hapen kur marketplace të jetë gati.",
    merchantPortal: "Portali i bizneseve",
    contact: "Kontakto Vishu",
    customersLabel: "Klientët",
    customersTitle: "Blerja hapet së shpejti",
    customersBody: "Marketplace publik është i fshehur deri në lansim.",
    shopsLabel: "Bizneset",
    shopsTitle: "Paneli i bizneseve mbetet hapur",
    shopsBody: "Bizneset e aprovuara mund të vazhdojnë përgatitjen e produkteve dhe dyqanit.",
  },
} as const;

export default function HomePage() {
  const { language } = useLanguage();
  const t = launchCopy[language];
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

        <div className="coming-soon-copy">
          <span className="coming-soon-eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <div className="coming-soon-actions">
            <Link className="button" href={getMerchantUrl("/")}>
              {t.merchantPortal}
            </Link>
            <Link className="button-secondary" href="/contact">
              {t.contact}
            </Link>
          </div>
        </div>
      </section>

      <section className="coming-soon-info">
        <div>
          <span>{t.customersLabel}</span>
          <strong>{t.customersTitle}</strong>
          <p>{t.customersBody}</p>
        </div>
        <div>
          <span>{t.shopsLabel}</span>
          <strong>{t.shopsTitle}</strong>
          <p>{t.shopsBody}</p>
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
