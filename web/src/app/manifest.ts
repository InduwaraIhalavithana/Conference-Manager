import type { MetadataRoute } from "next";

/** Makes the check-in desk installable on a phone or tablet ("Add to home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ConferenceHub",
    short_name: "ConferenceHub",
    description: "Conferences across Sri Lanka, and the organizers' check-in desk.",
    start_url: "/en/dashboard",
    display: "standalone",
    background_color: "#050c1d",
    theme_color: "#0284c7",
    icons: [
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
