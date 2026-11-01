import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Katalog Produk - Aplikasi Uji SSR dan SSG',
  description: 'Aplikasi uji untuk membandingkan SSR dan SSG pada Next.js App Router.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
