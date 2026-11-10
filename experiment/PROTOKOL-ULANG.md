# Protokol Pengumpulan Ulang (ulang-1, ulang-2, ulang-3)

Ditetapkan pada 10 November 2026, sebelum audit pertama pengumpulan ulang dijalankan.

## Alasan

Pengumpulan pertama (`main-1`, `main-2`, `main-3`, 2–6 November 2026) memiliki tiga kekurangan pelaksanaan:

1. Seed blok dihitung sebagai `s + b` dengan seed sesi berurutan (201, 202, 203), sehingga urutan ketiga sesi merupakan deret yang sama dengan pergeseran satu blok. Hasilnya, 39 pasangan hanya memakai 15 nilai acak yang berbeda, dengan SSR lebih dahulu pada 28 pasangan dan SSG pada 11 pasangan.
2. Browser Chrome peneliti tetap terbuka pada `main-2` dan `main-3`, dan statusnya pada `main-1` tidak tercatat.
3. Layanan Windows Update tidak dijeda selama sesi.

Data pengumpulan pertama tidak menunjukkan gangguan (`benchmarkIndex` −5,0% sampai +3,5% dari median pilot, tidak ada eksklusi, dan tidak ada peristiwa pembaruan pada log sistem). Meskipun demikian, ketiga sesi diulang dengan prosedur yang lebih bersih.

## Status data

- **Data konfirmatori adalah pengumpulan ulang** (`ulang-1`, `ulang-2`, `ulang-3`, 39 pasangan).
- Pengumpulan pertama tidak dihapus maupun diubah. Data ini dilaporkan sebagai pengumpulan pertama, dan perbandingannya dengan pengumpulan ulang diperlakukan sebagai analisis eksploratif.
- Status ini ditetapkan sebelum data ulang ada dan tidak diubah berdasarkan hasilnya.

## Yang tidak berubah

- Deployment produksi yang sama: `https://skripsi-ssr-ssrg.vercel.app`, build SSG `2026-11-01T18:17:42.910Z` (komit `417e5e6`). Cabang `main` tidak di-push sampai pengumpulan ulang selesai.
- Route `produk-001`, metode throttling `devtools`, pemanasan 3 request, jeda 10 detik, 13 pasangan valid per sesi, batas eksklusi 10%, dan kriteria eksklusi.
- Analisis konfirmatori: `analysis/analyze.py` tanpa perubahan, dengan Δ = 100 ms untuk ketiga metrik, koreksi Bonferroni, dan elemen LCP yang sama.

## Yang berubah

### Pengacakan urutan (`--order seimbang`)

Setiap dua blok berurutan (1–2, 3–4, …, 11–12) berisi satu blok SSR>SSG dan satu blok SSG>SSR. Blok pertama setiap pasangan blok ditentukan oleh satu aliran acak per sesi, `mulberry32(s)`, dan blok kedua mengambil urutan sebaliknya. Blok ke-13 ditentukan oleh undian berikutnya dari aliran yang sama. Karena setiap sesi memakai satu aliran dengan seed-nya sendiri, urutan antarsesi tidak tumpang tindih.

| Sesi | Jendela (WIB) | Seed | Urutan rencana (R = SSR dahulu, G = SSG dahulu) | SSR : SSG dahulu |
|---|---|---|---|---|
| `ulang-1` | pagi 08.00–10.00 | 301 | RGRGGRGRGRGRR | 7 : 6 |
| `ulang-2` | siang 13.00–15.00 | 302 | GRGRRGRGRGGRR | 7 : 6 |
| `ulang-3` | malam 20.00–22.00 | 303 | GRGRRGGRRGGRR | 7 : 6 |

Seed 301–303 dipilih sebelum urutannya dilihat dan tidak diganti untuk memperoleh keseimbangan total yang lebih baik. Jika ada pasangan yang dikeluarkan, blok pengganti melanjutkan pola yang sama.

Opsi bawaan `--order koin` mempertahankan cara lama, sehingga urutan `main-1..3` tetap dapat direproduksi.

### Kondisi perangkat uji

Sebelum setiap sesi:

1. PC dinyalakan ulang.
2. Pembaruan Windows dijeda melalui Settings > Windows Update > Pause updates.
3. Chrome, Steam, Discord, WhatsApp, klien Riot/League, dan aplikasi lain yang tidak diperlukan ditutup atau tidak dibuka. Proses yang tidak dapat dihentikan dicatat.
4. Keadaan perangkat dicatat dengan `scripts/cek-lingkungan.ps1 -Sesi <sesi> -Tahap sebelum`, dan setelah sesi dengan `-Tahap sesudah`. Catatan ini memuat waktu boot, rencana daya, status Windows Update, beban CPU, proses latar, dan peristiwa pembaruan pada log sistem.

Terminal yang menjalankan Claude Code tetap terbuka selama sesi, sama seperti pada pengumpulan pertama.

## Perintah

```bash
node experiment/run-audits.mjs --base-url https://skripsi-ssr-ssrg.vercel.app --mode main --pairs 13 --session ulang-1 --seed 301 --order seimbang
node experiment/run-audits.mjs --base-url https://skripsi-ssr-ssrg.vercel.app --mode main --pairs 13 --session ulang-2 --seed 302 --order seimbang
node experiment/run-audits.mjs --base-url https://skripsi-ssr-ssrg.vercel.app --mode main --pairs 13 --session ulang-3 --seed 303 --order seimbang

python analysis/analyze.py results/ulang-1/runs.csv results/ulang-2/runs.csv results/ulang-3/runs.csv \
       --mode main --expected-lcp "main.halaman > article > header.kepala > img.gambar-utama" \
       --out results/analisis-ulang
```
