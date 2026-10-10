/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  // three.js ships ES modules that Next needs to compile for the 3D view
  transpilePackages: ["three"],
  // The browser only ever talks to /api/*, which Next proxies to FastAPI.
  // This keeps the session cookie same-origin on Vercel (no CORS / SameSite=None headaches).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
