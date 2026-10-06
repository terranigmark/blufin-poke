import type { NextConfig } from "next";

// Set when the site is served from a sub-path, e.g. "/blufin-poke" on GitHub Pages.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Static export: the whole site is client-side (no checkout, no backend), so it
// can be served from any static host. Orders travel inside the QR link itself.
const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
