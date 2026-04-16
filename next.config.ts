import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  output: 'standalone',
  // Workaround: Turbopack in Next.js 16 doesn't generate middleware.js.nft.json
  // Generate empty trace file post-build so Vercel deployment succeeds
  outputFileTracingIncludes: {
    '/middleware': ['./middleware.ts'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

// samus-builder-images-unoptimized
// In builder runs, disable Next.js Image Optimization to avoid server-side fetch/DNS flakiness
// from non-deterministic remote placeholder image hosts.
if (process.env.SAMUS_BUILDER === '1') {
  nextConfig.images = { ...(nextConfig.images ?? {}), unoptimized: true };
}


export default nextConfig;
