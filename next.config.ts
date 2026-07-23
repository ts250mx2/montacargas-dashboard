import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: process.cwd(),
  // pdf.js se carga tal cual desde node_modules: empaquetarlo rompe su carga de fuentes y worker
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
