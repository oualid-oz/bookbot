import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  transpilePackages: ['@bookbot/db', '@bookbot/core', '@bookbot/puzzles', '@bookbot/shared', '@bookbot/storage'],
  // Queue client stays a plain Node dependency rather than being bundled
  serverExternalPackages: ['bullmq'],
};

export default nextConfig;
