import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ambilProduk } from '@/lib/data';
import { PENGENAL_INSTANS } from '@/lib/instance';
import TombolSimpan from './TombolSimpan';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

type Props = {
  slug: string;
  // Awalan dipakai hanya untuk tautan produk terkait agar tetap di kondisi yang sama.
  // Panjang '/ssr' dan '/ssg' sama sehingga ukuran HTML kedua kondisi tetap setara.
  awalan: '/ssr' | '/ssg';
};

// Komponen halaman tunggal yang dipakai oleh kedua kondisi (Bab 3, Arsitektur Aplikasi Uji).
export default async function HalamanUji({ slug, awalan }: Props) {
  const data = await ambilProduk(slug);
  if (!data) notFound();
  const { produk, terkait } = data;

  // Probe render (Bab 3, Verifikasi Kondisi Rendering): SSR berubah tiap request,
  // SSG tetap sama dengan waktu build. Panjang ISO 8601 selalu 24 karakter.
  const waktuRender = new Date().toISOString();
  console.log(
    JSON.stringify({ event: 'render', route: `${awalan}/${slug}`, waktuRender, instans: PENGENAL_INSTANS }),
  );

  return (
    <main className="halaman">
      <nav className="remah" aria-label="Navigasi">
        <a href="/">Katalog</a> / <span>{produk.kategori}</span>
      </nav>

      <article>
        <header className="kepala">
          <img
            className="gambar-utama"
            src={produk.gambar}
            alt={produk.nama}
            width={1200}
            height={675}
            fetchPriority="high"
          />
          <div className="ringkasan">
            <p className="kategori">{produk.kategori}</p>
            <h1>{produk.nama}</h1>
            <p className="harga">{rupiah.format(produk.harga)}</p>
            <p className="rating">
              Rating {produk.rating.toFixed(1)} dari 5 ({produk.jumlahUlasan} ulasan)
            </p>
            <TombolSimpan />
          </div>
        </header>

        <section>
          <h2>Deskripsi</h2>
          {produk.deskripsi.map((paragraf, i) => (
            <p key={i}>{paragraf}</p>
          ))}
        </section>

        <section>
          <h2>Spesifikasi</h2>
          <table className="spesifikasi">
            <tbody>
              {produk.spesifikasi.map(([kunci, nilai]) => (
                <tr key={kunci}>
                  <th scope="row">{kunci}</th>
                  <td>{nilai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Ulasan Pembeli</h2>
          <ul className="ulasan">
            {produk.ulasan.map((u, i) => (
              <li key={i}>
                <strong>{u.nama}</strong> &middot; {u.bintang}/5
                <p>{u.isi}</p>
              </li>
            ))}
          </ul>
        </section>
      </article>

      <section className="terkait">
        <h2>Produk Terkait</h2>
        <ul className="kartu">
          {terkait.map((t) => (
            <li key={t.slug}>
              {/* prefetch dimatikan agar tidak ada request tambahan setelah halaman dimuat. */}
              <Link href={`${awalan}/${t.slug}`} prefetch={false}>
                <span className="nama-kartu">{t.nama}</span>
                <span className="harga-kartu">{rupiah.format(t.harga)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div hidden data-rendered-at={waktuRender} data-instance={PENGENAL_INSTANS} />
    </main>
  );
}
