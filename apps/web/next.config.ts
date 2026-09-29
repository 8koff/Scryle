import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The tools moved into the signed-in app (/app). Old links, Stripe returns and shares still land in the right place.
  async redirects() {
    return [
      { source: "/scan/:pack", destination: "/app?pack=:pack", permanent: false },
      { source: "/build/:id", destination: "/app/build/:id", permanent: false },
      { source: "/renders", destination: "/app/renders", permanent: false },
    ];
  },
};

export default nextConfig;
