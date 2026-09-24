import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore'],
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  devIndicators: false,
  productionBrowserSourceMaps: false,
  httpAgentOptions: {
    keepAlive: true,
  },
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  allowedDevOrigins: [
    '192.168.1.33:3000',
    '192.168.1.33',
    '192.168.68.110:3000',
    '192.168.68.110',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/health",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
