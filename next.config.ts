import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` and `next dev` share .next by default, so a build run while the
  // dev server is up corrupts its chunks. Set NEXT_DIST_DIR to build elsewhere.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // A lockfile higher up the tree would otherwise be inferred as the workspace root.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
