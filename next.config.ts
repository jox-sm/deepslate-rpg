import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler:true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "taeltdzrygfgphozyjtd.supabase.co",
      },
    ],
    qualities: [75, 85],
  },
  experimental:{
    turbopackFileSystemCacheForDev:true,
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
