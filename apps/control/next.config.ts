import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript-source workspace packages: the design system and the licence contract
  transpilePackages: ["@his/ui", "@his/licence"],
  poweredByHeader: false,
};

export default nextConfig;
