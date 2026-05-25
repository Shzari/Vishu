"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { apiRequest, assetUrl } from "@/lib/api";
import { getMerchantUrl, isMerchantHostname } from "@/lib/merchant-domain";
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
    body: "",
    registerBusiness: "Register your business",
  },
  sq: {
    eyebrow: "Vishu.shop",
    title: "Së shpejti",
    body: "",
    registerBusiness: "Regjistro biznesin tend",
  },
} as const;

export default function HomePage() {
  const { language } = useLanguage();
  const t = launchCopy[language];
  const [homepageHero, setHomepageHero] =
    useState<HomepageHeroConfig>(FALLBACK_HERO);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isMerchantPortal, setIsMerchantPortal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMerchantPortal(isMerchantHostname(window.location.hostname));
    }
  }, []);

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

  if (isMerchantPortal) {
    return (
      <main className="coming-soon-page merchant-home-page" data-no-translate="true">
        <section className="coming-soon-hero">
          <div className="coming-soon-copy merchant-home-copy">
            <span className="coming-soon-eyebrow">Vishu për biznese</span>
            <h1>Hapni dyqanin tuaj brenda pak minutash.</h1>
            <p>
              Krijoni llogarinë e biznesit, përgatitni katalogun dhe menaxhoni
              produktet, stokun dhe porositë nga një panel i qartë.
            </p>
            <div className="coming-soon-actions">
              <Link className="button" href="/vendor/register">
                Krijo llogari biznesi
              </Link>
              <Link className="button-secondary" href="/login?portal=vendor">
                Hyr në panel
              </Link>
            </div>
          </div>

          <section className="business-register-info" aria-label="Rreth Vishu për biznese">
            <div className="business-register-main">
              <span>Rreth Vishu</span>
              <h2>Një hapësirë marketplace për bizneset lokale të modës.</h2>
              <p>
                Vishu u ndihmon dyqaneve të përgatisin katalog profesional
                online, të menaxhojnë foto, stok, porosi dhe kërkesa të
                klientëve nga një panel biznesi.
              </p>
            </div>
            <div className="business-register-points">
              <div>
                <strong>Katalog profesional</strong>
                <p>Shtoni produkte me foto të qarta, madhësi, ngjyra, stok dhe çmime.</p>
              </div>
              <div>
                <strong>Kontroll para publikimit</strong>
                <p>Produktet qëndrojnë të fshehura derisa të kontrollohen dhe aprovohen.</p>
              </div>
              <div>
                <strong>Mjete të qarta për porosi</strong>
                <p>Menaxhoni porositë, statusin e dorëzimit dhe aktivitetin e biznesit në një vend.</p>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

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
          {t.body ? <p>{t.body}</p> : null}
          <div className="coming-soon-actions">
            <Link className="button" href={getMerchantUrl("/vendor/register")}>
              {t.registerBusiness}
            </Link>
          </div>
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
