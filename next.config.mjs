/** @type {import('next').NextConfig} */
const nextConfig = {
  // Let Node `require` these natively instead of letting webpack bundle them —
  // bundling `ws` breaks its native bufferutil/utf-8-validate addons, which
  // the Neon serverless driver's WebSocket transport depends on.
  experimental: {
    serverComponentsExternalPackages: [
      'ws',
      'bufferutil',
      'utf-8-validate',
      '@neondatabase/serverless',
      '@prisma/adapter-neon',
    ],
  },
};

export default nextConfig;
