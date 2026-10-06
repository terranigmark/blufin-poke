import type { NextConfig } from "next";

// Static export: the whole site is client-side (no checkout, no backend), so it
// can be served from any static host. Orders travel inside the QR link itself.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
