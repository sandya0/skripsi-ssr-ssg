import Link from 'next/link';
import { ambilDaftarSlug } from '@/lib/data';

// Halaman indeks untuk pemeriksaan manual; tidak termasuk route yang diukur.
export default async function Indeks() {
  const daftarSlug = await ambilDaftarSlug();
  return (
    <main className="halaman">
      <h1>Aplikasi Uji SSR dan SSG</h1>
      <p>
        Setiap produk tersedia pada dua route dengan isi identik: <code>/ssr/[slug]</code> dirender
        pada setiap request, sedangkan <code>/ssg/[slug]</code> diprarender saat build.
      </p>
      <ul className="daftar-indeks">
        {daftarSlug.map((slug) => (
          <li key={slug}>
            {slug}: <Link href={`/ssr/${slug}`} prefetch={false}>SSR</Link> &middot;{' '}
            <Link href={`/ssg/${slug}`} prefetch={false}>SSG</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
