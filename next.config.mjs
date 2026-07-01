/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the chamber can be hosted on any static host. The app
  // talks to the GenLayer contract directly from the browser, so no server
  // runtime is needed.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
