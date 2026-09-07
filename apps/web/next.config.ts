import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/spots/nearby",
        destination: new URL(
          "/spots/nearby",
          process.env.API_URL ?? "http://api:3001",
        ).toString(),
      },
    ];
  },
};

export default nextConfig;
