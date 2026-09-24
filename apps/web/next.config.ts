import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Workspace packages ship TypeScript source; Next compiles them
    transpilePackages: ["@repo/types", "@repo/ui"],
};

export default nextConfig;
