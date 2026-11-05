import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image; trace from the monorepo root
  // so workspace packages are included (builds run from apps/web)
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // Font files are read from disk by /fonts/[file], so tracing can't find them
  outputFileTracingIncludes: {
    "/fonts/[file]": ["../../packages/fonts/files/*.ttf"],
    // Exports rendered in the web app (Vercel) embed these fonts
    "/api/export": ["../../packages/fonts/files/*.ttf"],
  },
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
  transpilePackages: ['@bookbot/db', '@bookbot/core', '@bookbot/exporter', '@bookbot/fonts', '@bookbot/puzzles', '@bookbot/shared', '@bookbot/storage'],
  // Queue client stays a plain Node dependency rather than being bundled
  serverExternalPackages: ['bullmq'],
  // The cover editor moved into each project
  async redirects() {
    return [{ source: '/studio', destination: '/projects', permanent: false }];
  },
};

export default nextConfig;
