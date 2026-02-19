import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Configuración de Turbopack (Next.js 16 usa Turbopack por defecto)
  turbopack: {
    // Configuración vacía para silenciar el warning
    // La resolución de módulos se maneja automáticamente
  },
};

export default nextConfig;
