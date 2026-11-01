// Menjalankan audit Lighthouse berpasangan SSR vs SSG sesuai prosedur Bab 3.
//
// Contoh:
//   node experiment/run-audits.mjs --base-url https://contoh.vercel.app --mode pilot \
//        --pairs 12 --session pilot-1 --seed 101
//
// Setiap blok: pemanasan (request yang tidak dicatat) -> verifikasi probe "sebelum"
// -> dua audit (urutan SSR/SSG diacak dengan seed) -> verifikasi probe "sesudah".
import { parseArgs } from 'node:util';
import { mkdir, writeFile, appendFile, access } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as tidur } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import * as ChromeLauncher from 'chrome-launcher';
import { ambilProbe, ekstrakMetrik, KOLOM_CSV, keBarisCsv, mulberry32 } from './lib.mjs';

const { values: argumen } = parseArgs({
  options: {
    'base-url': { type: 'string' },
    slug: { type: 'string', default: 'produk-001' },
    mode: { type: 'string', default: 'pilot' }, // pilot | main | smoke
    pairs: { type: 'string', default: '12' }, // jumlah pasangan VALID yang ditargetkan
    seed: { type: 'string', default: '20261102' },
    session: { type: 'string' },
    throttling: { type: 'string', default: 'devtools' }, // devtools | simulate
    warmup: { type: 'string', default: '3' },
    'pause-ms': { type: 'string', default: '10000' },
    'max-exclusion': { type: 'string', default: '0.10' },
    out: { type: 'string', default: 'results' },
  },
});

if (!argumen['base-url'] || !argumen.session) {
  console.error('Wajib: --base-url <url> --session <nama-sesi>');
  process.exit(1);
}

const BASE = argumen['base-url'].replace(/\/$/, '');
const TARGET_PASANGAN = Number(argumen.pairs);
const SEED = Number(argumen.seed);
const PEMANASAN = Number(argumen.warmup);
const JEDA_MS = Number(argumen['pause-ms']);
const MAKS_EKSKLUSI = Number(argumen['max-exclusion']);
const MAKS_BLOK = Math.ceil(TARGET_PASANGAN * 1.5) + 2;
const URL_KONDISI = {
  SSR: `${BASE}/ssr/${argumen.slug}`,
  SSG: `${BASE}/ssg/${argumen.slug}`,
};

const folderSesi = path.join(argumen.out, argumen.session);
const folderMentah = path.join(folderSesi, 'raw');
const berkasCsv = path.join(folderSesi, 'runs.csv');
await mkdir(folderMentah, { recursive: true });

async function adaBerkas(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await adaBerkas(berkasCsv))) await writeFile(berkasCsv, KOLOM_CSV.join(',') + '\n', 'utf8');

await writeFile(
  path.join(folderSesi, `session-${Date.now()}.json`),
  JSON.stringify(
    {
      argumen,
      dimulai: new Date().toISOString(),
      node: process.version,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model,
      jumlahCpu: os.cpus().length,
      memoriGB: Math.round(os.totalmem() / 1024 ** 3),
      url: URL_KONDISI,
    },
    null,
    2,
  ),
  'utf8',
);

async function audit(url) {
  const chrome = await ChromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-first-run'] });
  try {
    const hasil = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      throttlingMethod: argumen.throttling,
    });
    return hasil.lhr;
  } finally {
    await chrome.kill();
  }
}

async function pemanasan() {
  for (let i = 0; i < PEMANASAN; i += 1) {
    for (const url of Object.values(URL_KONDISI)) {
      await fetch(url, { cache: 'no-store' }).then((r) => r.arrayBuffer()).catch(() => null);
    }
  }
}

let pasanganValid = 0;
let pasanganKeluar = 0;
let blok = 0;

while (pasanganValid < TARGET_PASANGAN && blok < MAKS_BLOK) {
  blok += 1;
  const acak = mulberry32(SEED + blok);
  const urutan = acak() < 0.5 ? ['SSR', 'SSG'] : ['SSG', 'SSR'];

  await pemanasan();
  const sebelum = { SSR: await ambilProbe(URL_KONDISI.SSR), SSG: await ambilProbe(URL_KONDISI.SSG) };
  await tidur(JEDA_MS);

  const hasilBlok = {};
  for (const [posisi, kondisi] of urutan.entries()) {
    let lhr = null;
    let galat = null;
    try {
      lhr = await audit(URL_KONDISI[kondisi]);
    } catch (e) {
      galat = e instanceof Error ? e.message : String(e);
    }
    const namaBerkas = `${argumen.session}-b${String(blok).padStart(3, '0')}-${kondisi}.json.gz`;
    if (lhr) await writeFile(path.join(folderMentah, namaBerkas), gzipSync(JSON.stringify(lhr)));
    hasilBlok[kondisi] = { lhr, galat, posisi: posisi + 1, namaBerkas };
    if (posisi === 0) await tidur(JEDA_MS);
  }

  const sesudah = { SSR: await ambilProbe(URL_KONDISI.SSR), SSG: await ambilProbe(URL_KONDISI.SSG) };

  // Kriteria eksklusi objektif (Bab 3, Kriteria Eksklusi); elemen LCP diperiksa saat analisis.
  const alasan = { SSR: [], SSG: [] };
  for (const kondisi of ['SSR', 'SSG']) {
    if (!sebelum[kondisi].waktuRender || !sesudah[kondisi].waktuRender) alasan[kondisi].push('probe-kosong');
  }
  if (sebelum.SSR.waktuRender && sebelum.SSR.waktuRender === sesudah.SSR.waktuRender) {
    alasan.SSR.push('probe-ssr-tidak-berubah');
  }
  if (sebelum.SSR.instans && sesudah.SSR.instans && sebelum.SSR.instans !== sesudah.SSR.instans) {
    alasan.SSR.push('instans-berganti');
  }
  if (sebelum.SSG.waktuRender !== sesudah.SSG.waktuRender) alasan.SSG.push('probe-ssg-berubah');

  const baris = [];
  for (const kondisi of ['SSR', 'SSG']) {
    const { lhr, galat, posisi, namaBerkas } = hasilBlok[kondisi];
    const metrik = lhr ? ekstrakMetrik(lhr) : {};
    if (galat) alasan[kondisi].push('audit-gagal');
    if (metrik.runtimeError) alasan[kondisi].push(`runtime-error:${metrik.runtimeError}`);
    if (lhr && metrik.statusDokumen !== 200) alasan[kondisi].push(`status-${metrik.statusDokumen}`);
    if (lhr && [metrik.ttfb, metrik.fcp, metrik.lcp].some((v) => typeof v !== 'number')) {
      alasan[kondisi].push('metrik-kosong');
    }
    baris.push({
      sesi: argumen.session,
      mode: argumen.mode,
      blok,
      urutan: urutan.join('>'),
      posisi,
      kondisi,
      url: URL_KONDISI[kondisi],
      ...metrik,
      cacheControl: sebelum[kondisi].cacheControl,
      xVercelCache: sebelum[kondisi].xVercelCache,
      probeSebelum: sebelum[kondisi].waktuRender,
      probeSesudah: sesudah[kondisi].waktuRender,
      instansSebelum: sebelum[kondisi].instans,
      instansSesudah: sesudah[kondisi].instans,
      seed: SEED,
      alasanEksklusi: alasan[kondisi].join('|'),
      berkasLhr: lhr ? namaBerkas : '',
    });
  }

  // Satu run tidak valid berarti seluruh pasangannya dikeluarkan.
  const pasanganSah = baris.every((b) => b.alasanEksklusi === '');
  for (const b of baris) await appendFile(berkasCsv, keBarisCsv({ ...b, pasanganValid: pasanganSah }) + '\n', 'utf8');
  if (pasanganSah) pasanganValid += 1;
  else pasanganKeluar += 1;

  const ringkas = baris
    .map((b) => `${b.kondisi} TTFB=${Math.round(b.ttfb ?? NaN)} FCP=${Math.round(b.fcp ?? NaN)} LCP=${Math.round(b.lcp ?? NaN)}`)
    .join(' | ');
  console.log(`[blok ${blok}] ${urutan.join('>')} ${pasanganSah ? 'valid' : 'KELUAR'} :: ${ringkas}`);

  if (blok >= 10 && pasanganKeluar / blok > MAKS_EKSKLUSI) {
    console.error(
      `Proporsi pasangan keluar ${(pasanganKeluar / blok).toFixed(2)} melebihi batas ${MAKS_EKSKLUSI}. ` +
        'Pengumpulan dihentikan; periksa penyebabnya sebelum melanjutkan.',
    );
    process.exit(2);
  }
  await tidur(JEDA_MS);
}

console.log(`Selesai: ${pasanganValid} pasangan valid, ${pasanganKeluar} keluar, ${blok} blok. Data: ${berkasCsv}`);
