// Membangkitkan snapshot data produk secara deterministik (seed tetap),
// sehingga isi halaman SSR dan SSG selalu identik dan dapat dibangkitkan ulang.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SEED = 20261102;
const JUMLAH_PRODUK = 60;
const JUMLAH_GAMBAR = 12;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const acak = mulberry32(SEED);
const pilih = (daftar) => daftar[Math.floor(acak() * daftar.length)];
const bilangan = (min, max) => min + Math.floor(acak() * (max - min + 1));

const KATEGORI = {
  'Perabot Kantor': ['Meja Kerja', 'Kursi Ergonomis', 'Rak Arsip', 'Lemari Dokumen', 'Meja Lipat'],
  'Perlengkapan Dapur': ['Panci Presto', 'Wajan Antilengket', 'Rak Piring', 'Talenan Kayu', 'Set Pisau'],
  'Elektronik Rumah': ['Kipas Angin', 'Lampu Meja', 'Penanak Nasi', 'Pemurni Udara', 'Ketel Listrik'],
  'Alat Tulis': ['Buku Catatan', 'Pena Gel', 'Organizer Meja', 'Papan Tulis', 'Map Plastik'],
  'Perlengkapan Olahraga': ['Matras Yoga', 'Dumbel', 'Tali Skipping', 'Botol Minum', 'Sepatu Lari'],
  'Peralatan Taman': ['Selang Air', 'Gunting Dahan', 'Pot Tanaman', 'Sekop Kecil', 'Penyiram Otomatis'],
};
const SIFAT = ['Premium', 'Ringkas', 'Serbaguna', 'Klasik', 'Modern', 'Lipat', 'Pro', 'Eco', 'Plus', 'Lite'];
const BAHAN = ['baja ringan', 'kayu jati', 'plastik ABS', 'aluminium', 'bambu', 'kaca tempered', 'kain kanvas'];
const WARNA = ['hitam', 'putih', 'abu-abu', 'cokelat', 'hijau zaitun', 'biru tua', 'krem'];
const KOTA = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Yogyakarta', 'Medan', 'Makassar', 'Tangerang'];
const NAMA = ['Andi', 'Bunga', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gita', 'Hendra', 'Indah', 'Joko', 'Kirana', 'Lukas'];

const KALIMAT = [
  (p) => `${p.nama} dirancang untuk penggunaan sehari-hari dengan bahan ${p.bahan} yang kokoh dan mudah dirawat.`,
  (p) => `Produk ini hadir dalam warna ${p.warna} sehingga mudah dipadukan dengan berbagai gaya ruangan.`,
  (p) => `Setiap unit melewati pemeriksaan kualitas sebelum dikirim dari gudang kami di ${p.kota}.`,
  () => 'Desainnya mengutamakan kenyamanan, keamanan, dan efisiensi ruang tanpa mengorbankan tampilan.',
  () => 'Permukaannya diberi lapisan pelindung agar tahan terhadap goresan ringan dan noda.',
  () => 'Komponen pengganti tersedia sehingga masa pakai produk dapat diperpanjang.',
  (p) => `Garansi resmi berlaku selama ${p.garansi} bulan sejak tanggal pembelian.`,
  () => 'Kemasan menggunakan bahan daur ulang untuk mengurangi limbah pengiriman.',
  () => 'Petunjuk perakitan disertakan dan dapat diikuti tanpa alat khusus.',
  () => 'Cocok digunakan di rumah, kantor kecil, maupun ruang usaha.',
];

const ULASAN = [
  'Kualitasnya sesuai deskripsi dan pengiriman cepat.',
  'Bahannya terasa kokoh, sepadan dengan harganya.',
  'Warnanya sedikit berbeda dari foto, tetapi tetap bagus.',
  'Mudah dirakit dan petunjuknya jelas.',
  'Sudah dipakai dua bulan dan masih seperti baru.',
  'Ukurannya pas untuk ruangan saya yang tidak terlalu besar.',
  'Pelayanan penjual ramah dan responsif.',
  'Akan membeli lagi untuk kebutuhan kantor.',
];

const produk = [];
const daftarKategori = Object.keys(KATEGORI);
for (let i = 1; i <= JUMLAH_PRODUK; i += 1) {
  const kategori = daftarKategori[(i - 1) % daftarKategori.length];
  const p = {
    slug: `produk-${String(i).padStart(3, '0')}`,
    nama: `${pilih(KATEGORI[kategori])} ${pilih(SIFAT)} ${bilangan(100, 999)}`,
    kategori,
    harga: bilangan(45, 4800) * 1000,
    rating: Math.round((3.5 + acak() * 1.5) * 10) / 10,
    jumlahUlasan: bilangan(12, 860),
    bahan: pilih(BAHAN),
    warna: pilih(WARNA),
    kota: pilih(KOTA),
    garansi: pilih([6, 12, 24]),
    gambar: `/img/produk-${String(((i - 1) % JUMLAH_GAMBAR) + 1).padStart(2, '0')}.jpg`,
  };
  p.deskripsi = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => pilih(KALIMAT)(p)).join(' '),
  );
  p.spesifikasi = [
    ['Kategori', kategori],
    ['Bahan utama', p.bahan],
    ['Warna', p.warna],
    ['Dimensi', `${bilangan(20, 160)} x ${bilangan(20, 90)} x ${bilangan(5, 120)} cm`],
    ['Berat', `${(bilangan(2, 300) / 10).toFixed(1)} kg`],
    ['Garansi', `${p.garansi} bulan`],
    ['Asal pengiriman', p.kota],
    ['Kode produk', `KP-${String(i).padStart(4, '0')}`],
  ];
  p.ulasan = Array.from({ length: 6 }, () => ({
    nama: pilih(NAMA),
    bintang: bilangan(3, 5),
    isi: pilih(ULASAN),
  }));
  produk.push(p);
}

for (const p of produk) {
  const kandidat = produk.filter((q) => q.slug !== p.slug);
  const terkait = new Set();
  while (terkait.size < 8) terkait.add(kandidat[Math.floor(acak() * kandidat.length)].slug);
  p.terkait = [...terkait];
}

const snapshot = { versi: 1, seed: SEED, dibuat: '2026-11-02', produk };
const tujuan = path.join(process.cwd(), 'data', 'snapshot.json');
await mkdir(path.dirname(tujuan), { recursive: true });
await writeFile(tujuan, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`snapshot: ${produk.length} produk -> ${tujuan}`);
