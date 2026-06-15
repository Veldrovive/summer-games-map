import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/map-data',
        destination: 'https://aadl.org/summergame/map/data/SummerGame2026',
      },
    ]
  },
  allowedDevOrigins: ['100.114.21.53'],
};

export default nextConfig;
