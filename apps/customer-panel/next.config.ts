import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the design system ships TypeScript source
  transpilePackages: ["@his/ui"],
  turbopack: {
    // lib/server reads customers/ and packages/ at runtime on purpose; the panel
    // is a local tool, never traced into a deployable image
    ignoreIssue: [{ path: "**/lib/server/**", title: /Dynamic filesystem access/ }],
  },
};

export default nextConfig;
