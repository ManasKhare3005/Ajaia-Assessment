import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only parsers: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["happy-dom", "mammoth", "pg"],
};

export default nextConfig;
