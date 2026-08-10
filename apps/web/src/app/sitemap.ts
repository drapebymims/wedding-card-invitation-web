import type { MetadataRoute } from "next";
import { getCoupleSlugs } from "@/lib/config";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";

// Static export requires an explicit dynamic mode on metadata routes.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/admin`, lastModified: new Date() },
    ...getCoupleSlugs().map((slug) => ({
      url: `${base}/w/${slug}/`,
      lastModified: new Date(),
    })),
  ];
}
