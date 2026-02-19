import type { NextConfig } from "next";
import path from "path";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  devIndicators: false,
  serverExternalPackages: ["pdfkit"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pinimg.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
