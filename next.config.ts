import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A lockfile higher up the tree would otherwise be inferred as the workspace root.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
