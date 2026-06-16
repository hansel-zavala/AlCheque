import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimización de imágenes para Supabase
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Suprimir errores de JSX en paquetes externos
  transpilePackages: [],
};

export default nextConfig;
