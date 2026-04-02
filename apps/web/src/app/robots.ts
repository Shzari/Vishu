import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://vishu.shop").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/vendor/", "/account/", "/checkout", "/cart", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
