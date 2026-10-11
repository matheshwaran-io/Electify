import type { MetadataRoute } from "next";

/** Install / add-to-home-screen. Icons are drawn from the "Electify Logo" canvas. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Electify",
    short_name: "Electify",
    description: "Elective registration for SRMIST: live seat counts, locked-in choices and an instant receipt.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFCFC",
    theme_color: "#FDFCFC",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
