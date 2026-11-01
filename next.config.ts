import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ada package-lock.json lain di folder home; root proyek ditetapkan eksplisit.
  turbopack: { root: path.join(__dirname) },
  // Cache Components sengaja tidak diaktifkan (Bab 3, Subbab Konfigurasi SSR dan SSG):
  // pada model tersebut opsi segmen `dynamic` dihapus dan satu route dapat memadukan
  // static shell dengan bagian dinamis, sehingga batas SSR dan SSG menjadi kabur.
  cacheComponents: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Snapshot dibaca dengan fs saat request (SSR), jadi berkasnya harus ikut ke bundel fungsi.
  outputFileTracingIncludes: {
    '/ssr/[slug]': ['./data/snapshot.json'],
  },
};

export default nextConfig;
