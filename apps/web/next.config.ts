import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3000/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:3000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
