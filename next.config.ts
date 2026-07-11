import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wymuszony root projektu: w katalogu domowym leży zabłąkany pnpm-lock.yaml,
  // przez który Turbopack wybierał C:\Users\sta3rs jako workspace root i app/
  // przestawał istnieć (404 na każdej trasie).
  turbopack: { root: __dirname },
};

export default nextConfig;
