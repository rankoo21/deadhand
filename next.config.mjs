/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export keeps TestLens deployable on any static host. The browser
  // reads and writes through the GenLayer adapter, so no server is required.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
