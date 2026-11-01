import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type Ulasan = { nama: string; bintang: number; isi: string };

export type Produk = {
  slug: string;
  nama: string;
  kategori: string;
  harga: number;
  rating: number;
  jumlahUlasan: number;
  gambar: string;
  deskripsi: string[];
  spesifikasi: [string, string][];
  ulasan: Ulasan[];
  terkait: string[];
};

type Snapshot = { versi: number; seed: number; dibuat: string; produk: Produk[] };

const LOKASI_SNAPSHOT = path.join(process.cwd(), 'data', 'snapshot.json');

// Snapshot sengaja dibaca dan di-parse ulang pada setiap pemanggilan tanpa cache.
// Pada SSR pekerjaan ini terjadi pada setiap request; pada SSG hanya saat build.
async function bacaSnapshot(): Promise<Snapshot> {
  const isi = await readFile(LOKASI_SNAPSHOT, 'utf8');
  return JSON.parse(isi) as Snapshot;
}

export async function ambilDaftarSlug(): Promise<string[]> {
  const snapshot = await bacaSnapshot();
  return snapshot.produk.map((p) => p.slug);
}

export async function ambilProduk(slug: string) {
  const snapshot = await bacaSnapshot();
  const produk = snapshot.produk.find((p) => p.slug === slug);
  if (!produk) return null;
  const terkait = produk.terkait
    .map((s) => snapshot.produk.find((p) => p.slug === s))
    .filter((p): p is Produk => Boolean(p));
  return { produk, terkait };
}
