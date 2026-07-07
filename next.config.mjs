/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build for Docker — copies only the node_modules
  // Next.js actually traces as needed into .next/standalone, instead of the
  // whole node_modules tree.
  output: 'standalone',
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
