// Verifikasi kesetaraan konten SSR vs SSG (Bab 3, Verifikasi Kesetaraan Konten).
//
//   node experiment/check-equivalence.mjs --base-url <url> [--slug produk-001]
//        [--lhr-ssr <berkas.json.gz> --lhr-ssg <berkas.json.gz>] [--out results/equivalence]
//
// Lapis 1 (DOM): HTML kedua route dinormalisasi lalu dibandingkan.
// Lapis 3 (jaringan dan elemen LCP): dibandingkan dari sepasang laporan Lighthouse.
// Lapis 2 (tampilan): screenshot diekspor, lalu dibandingkan per piksel dengan
//   python analysis/compare_screenshots.py <folder-out>.
import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { ambilProbe, ekstrakMetrik } from './lib.mjs';

const { values: argumen } = parseArgs({
  options: {
    'base-url': { type: 'string' },
    slug: { type: 'string', default: 'produk-001' },
    'lhr-ssr': { type: 'string' },
    'lhr-ssg': { type: 'string' },
    out: { type: 'string', default: 'results/equivalence' },
  },
});
if (!argumen['base-url']) {
  console.error('Wajib: --base-url <url>');
  process.exit(1);
}
const BASE = argumen['base-url'].replace(/\/$/, '');
await mkdir(argumen.out, { recursive: true });

// Menyamakan bagian yang memang berbeda menurut desain: nilai probe dan awalan route.
function normalisasi(html) {
  return html
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<WAKTU>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<INSTANS>')
    .replace(/\bss[rg]\b/g, 'ssX');
}

function bandingkanToken(a, b) {
  const ta = a.split(/(?=<)|(?<=>)/);
  const tb = b.split(/(?=<)|(?<=>)/);
  const beda = [];
  const n = Math.max(ta.length, tb.length);
  for (let i = 0; i < n && beda.length < 10; i += 1) {
    if (ta[i] !== tb[i]) beda.push({ indeks: i, ssr: (ta[i] ?? '').slice(0, 160), ssg: (tb[i] ?? '').slice(0, 160) });
  }
  return { tokenSsr: ta.length, tokenSsg: tb.length, beda };
}

const laporan = { waktu: new Date().toISOString(), baseUrl: BASE, slug: argumen.slug };

// Lapis 1: DOM.
const html = {};
for (const kondisi of ['ssr', 'ssg']) {
  const respons = await fetch(`${BASE}/${kondisi}/${argumen.slug}`, { cache: 'no-store' });
  html[kondisi] = await respons.text();
  await writeFile(path.join(argumen.out, `${kondisi}.html`), html[kondisi], 'utf8');
}
// DOM yang tampil: tag <script> dibuang dan atribut setiap tag diurutkan, karena
// Next.js memecah payload RSC ke jumlah <script> yang berbeda untuk keluaran
// prerender dan keluaran dinamis, serta urutan atribut tidak memengaruhi DOM.
function domTampil(teks) {
  return normalisasi(teks)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_, tag, atribut, tutup) => {
      const daftar = (atribut.match(/[\w:-]+(?:="[^"]*")?/g) ?? []).sort();
      return `<${tag}${daftar.length ? ' ' + daftar.join(' ') : ''}${tutup}>`;
    });
}
function ukuranSkrip(teks) {
  return (teks.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? []).reduce((n, s) => n + Buffer.byteLength(s), 0);
}

const dSsr = domTampil(html.ssr);
const dSsg = domTampil(html.ssg);
laporan.dom = {
  ukuranAsliByte: { ssr: Buffer.byteLength(html.ssr), ssg: Buffer.byteLength(html.ssg) },
  byteSkrip: { ssr: ukuranSkrip(html.ssr), ssg: ukuranSkrip(html.ssg) },
  jumlahSkrip: {
    ssr: (html.ssr.match(/<script\b/g) ?? []).length,
    ssg: (html.ssg.match(/<script\b/g) ?? []).length,
  },
  domTampilIdentik: dSsr === dSsg,
  ...bandingkanToken(dSsr, dSsg),
};

// Probe dan header (bukti kondisi rendering).
laporan.probe = { ssr: await ambilProbe(`${BASE}/ssr/${argumen.slug}`), ssg: await ambilProbe(`${BASE}/ssg/${argumen.slug}`) };

// Lapis 2 dan 3: dari sepasang laporan Lighthouse.
async function bacaLhr(berkas) {
  const isi = await readFile(berkas);
  return JSON.parse((berkas.endsWith('.gz') ? gunzipSync(isi) : isi).toString('utf8'));
}
function daftarRequest(lhr) {
  return (lhr.audits?.['network-requests']?.details?.items ?? [])
    .map((r) => `${r.resourceType} ${r.url.replace(/\/ss[rg]\//, '/ssX/')} ${r.transferSize}`)
    .sort();
}
if (argumen['lhr-ssr'] && argumen['lhr-ssg']) {
  const lhr = { ssr: await bacaLhr(argumen['lhr-ssr']), ssg: await bacaLhr(argumen['lhr-ssg']) };
  const m = { ssr: ekstrakMetrik(lhr.ssr), ssg: ekstrakMetrik(lhr.ssg) };
  const req = { ssr: daftarRequest(lhr.ssr), ssg: daftarRequest(lhr.ssg) };
  laporan.jaringan = {
    jumlahRequest: { ssr: m.ssr.jumlahRequest, ssg: m.ssg.jumlahRequest },
    totalByte: { ssr: m.ssr.totalByte, ssg: m.ssg.totalByte },
    elemenLcp: { ssr: m.ssr.elemenLcp, ssg: m.ssg.elemenLcp, sama: m.ssr.elemenLcp === m.ssg.elemenLcp },
    requestHanyaSsr: req.ssr.filter((r) => !req.ssg.includes(r)),
    requestHanyaSsg: req.ssg.filter((r) => !req.ssr.includes(r)),
  };
  for (const kondisi of ['ssr', 'ssg']) {
    const data = lhr[kondisi].fullPageScreenshot?.screenshot?.data;
    if (data) {
      const [, base64] = data.split(',');
      await writeFile(path.join(argumen.out, `screenshot-${kondisi}.jpg`), Buffer.from(base64, 'base64'));
    }
  }
}

await writeFile(path.join(argumen.out, 'laporan-kesetaraan.json'), JSON.stringify(laporan, null, 2), 'utf8');
console.log(JSON.stringify(laporan, null, 2));
