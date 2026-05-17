import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/r/"],
        disallow: ["/admin/", "/dashboard/", "/api/"]
      }
    ],
    sitemap: `${appBaseUrl()}/sitemap.xml`
  };
}
