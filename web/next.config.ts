import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8003";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only ever talks to this site: /api/* is passed to the API, so its httpOnly cookies are
  // first-party (same origin) and no CORS is needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  poweredByHeader: false,
};

export default createNextIntlPlugin()(nextConfig);
