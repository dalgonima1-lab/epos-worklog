import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/wedding", destination: "/wedding-app.html" }];
  },
};

export default nextConfig;
