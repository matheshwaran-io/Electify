import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets an isolated server (end-to-end tests, a verification build) run next to
  // the normal dev server without sharing its .next output directory.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
