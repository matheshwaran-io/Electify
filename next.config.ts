import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets an isolated server (end-to-end tests, a verification build) run next to
  // the normal dev server without sharing its .next output directory.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Dev-mode Server Function logging prints call arguments, including sign-in
  // passwords, to the terminal. Keep it off.
  logging: { serverFunctions: false },
};

export default nextConfig;
