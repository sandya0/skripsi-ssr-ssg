# Aplikasi Uji SSR vs SSG pada Next.js App Router

Repositori ini berisi aplikasi uji, otomasi audit, dan skrip analisis untuk skripsi
**"Analisis Perbandingan Kinerja Rendering antara Server-Side Rendering (SSR) dan Static
Site Generation (SSG) pada Aplikasi Web Next.js"** (Sandya Pradayan Harijanto, Informatika UMN).
Setiap bagian dirujuk dari Bab 3 laporan.

## Struktur

| Folder/berkas | Isi | Bab 3 |
|---|---|---|
| `app/ssr/[slug]/page.tsx` | Kondisi SSR (`dynamic = 'force-dynamic'`) | Konfigurasi SSR dan SSG |
| `app/ssg/[slug]/page.tsx` | Kondisi SSG (`generateStaticParams`, `dynamicParams = false`) | Konfigurasi SSR dan SSG |
| `components/HalamanUji.tsx` | Satu komponen halaman untuk kedua kondisi, termasuk probe render | Arsitektur Aplikasi Uji; Verifikasi Kondisi Rendering |
| `lib/data.ts` | Membaca dan mem-parse snapshot pada setiap pemanggilan (tanpa cache) | Estimand Penelitian |
| `data/snapshot.json` | 60 produk, dibangkitkan deterministik (`scripts/generate-data.mjs`) | Lingkungan Pengujian |
| `public/img/` | 12 gambar produk 1200x675 (`scripts/generate-images.py`) | Lingkungan Pengujian |
| `next.config.ts`, `vercel.json` | Cache Components nonaktif; region fungsi `sin1` (Singapura) | Konfigurasi; Lingkungan Pengujian |
| `experiment/run-audits.mjs` | Audit Lighthouse berpasangan, urutan acak ber-seed, pemanasan, probe, eksklusi | Prosedur Pengumpulan Data |
| `experiment/check-equivalence.mjs` | Kesetaraan DOM, jaringan, elemen LCP; ekspor screenshot | Verifikasi Kesetaraan Konten |
| `analysis/analyze.py` | Uji berpasangan, ukuran efek, Bonferroni, interval, sensitivitas, perencanaan jumlah pasangan | Analisis Data |
| `analysis/compare_screenshots.py` | Perbandingan screenshot per piksel | Verifikasi Kesetaraan Konten |
| `results/` | Data mentah (laporan JSON terkompresi) dan CSV per sesi | Penyimpanan dan Repositori |

## Prasyarat

- Node.js 22.x (>= 22.19 untuk Lighthouse 13), npm
- Google Chrome
- Python 3 dengan `numpy`, `pandas`, `scipy`, `matplotlib`, `Pillow`

```bash
npm install
npm run setup:experiment      # memasang lighthouse dan chrome-launcher di experiment/
```

## Menjalankan secara lokal

```bash
npm run build                 # keluaran build harus menunjukkan /ssr/[slug] = ƒ (Dynamic)
npm run start                 # dan /ssg/produk-xxx = ● (SSG)
```

Lalu buka `http://localhost:3000/ssr/produk-001` dan `http://localhost:3000/ssg/produk-001`.

## Deployment ke Vercel

1. Buka <https://vercel.com/new>, impor repositori ini dari GitHub, biarkan pengaturan bawaan Next.js.
2. Region fungsi otomatis `sin1` dari `vercel.json`; versi Node mengikuti `engines` (22.x).
3. Catat URL produksi, misalnya `https://skripsi-ssr-ssg.vercel.app`.

Alternatif CLI: `npx vercel login` lalu `npx vercel --prod`.

## Prosedur eksperimen (Bab 3)

Ganti `BASE` dengan URL produksi. Jalankan dari PC uji dengan koneksi kabel, aplikasi lain ditutup.

```bash
# 1. Verifikasi kesetaraan konten dan kondisi rendering
node experiment/check-equivalence.mjs --base-url BASE --out results/equivalence

# 2. Pilot: 12 pasangan (devtools) + 6 pasangan (simulate) untuk memeriksa peredaman
node experiment/run-audits.mjs --base-url BASE --mode pilot --pairs 12 --session pilot-devtools --seed 101
node experiment/run-audits.mjs --base-url BASE --mode pilot --pairs 6 --session pilot-simulate --seed 102 --throttling simulate

# 3. Kesetaraan jaringan, elemen LCP, dan screenshot dari satu pasangan pilot
node experiment/check-equivalence.mjs --base-url BASE --out results/equivalence \
     --lhr-ssr results/pilot-devtools/raw/pilot-devtools-b001-SSR.json.gz \
     --lhr-ssg results/pilot-devtools/raw/pilot-devtools-b001-SSG.json.gz
python analysis/compare_screenshots.py results/equivalence

# 4. Perencanaan jumlah pasangan dari pilot (Persamaan 3.4)
python analysis/analyze.py results/pilot-devtools/runs.csv --plan --out results/rencana

# 5. Pengumpulan utama: n pasangan dibagi rata ke tiga sesi pada hari dan waktu berbeda
#    (pagi 08.00-10.00, siang 13.00-15.00, malam 20.00-22.00 WIB)
node experiment/run-audits.mjs --base-url BASE --mode main --pairs N/3 --session main-1 --seed 201
node experiment/run-audits.mjs --base-url BASE --mode main --pairs N/3 --session main-2 --seed 202
node experiment/run-audits.mjs --base-url BASE --mode main --pairs N/3 --session main-3 --seed 203

# 6. Analisis konfirmatori
python analysis/analyze.py results/main-1/runs.csv results/main-2/runs.csv results/main-3/runs.csv \
       --mode main --expected-lcp "main.halaman > article > header.kepala > img.gambar-utama" \
       --out results/analisis
```

Parameter bawaan runner: pemanasan 3 request per route per blok, jeda 10 detik antaraudit,
penghentian bila proporsi pasangan keluar melebihi 10% setelah 10 blok.

## Catatan temuan uji coba lokal

- **TTFB pada throttling `devtools`.** Latensi tiruan (`requestLatencyMs` 562,5 ms pada preset
  mobile) diterapkan Chrome setelah header respons diterima, sehingga `timeToFirstByte` berisi
  TTFB nyata (jaringan sebenarnya + waktu server), sedangkan FCP dan LCP terkena throttling.
  Nilai TTFB absolut karena itu tidak dibandingkan dengan ambang Core Web Vitals; selisih
  SSR-SSG tetap bermakna.
- **Perbedaan bawaan dokumen.** DOM yang tampil identik dan screenshot identik per piksel, tetapi
  dokumen SSR membawa payload RSC dalam 11 tag `<script>` dan SSG dalam 13 tag (selisih 124 byte
  sebelum kompresi). Byte transfer dokumen SSR lebih besar (5.166 vs 4.303 byte secara lokal)
  karena dikirim secara streaming dengan header berbeda. Seluruh 10 subresource identik.
  Perbedaan ini merupakan bagian dari perlakuan, bukan perbedaan isi.
- Data uji coba lokal (`results/smoke-*`) bukan data penelitian dan tidak disertakan di Git.
