import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // App pages need a session (crawlers are redirected to /login), so only the
    // secret share links and the API are kept away from crawlers.
    rules: { userAgent: "*", allow: "/", disallow: ["/share/", "/api/"] },
  };
}
