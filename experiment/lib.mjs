// Fungsi bantu bersama untuk skrip eksperimen.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Request verifikasi: mengambil header cache dan atribut probe render dari HTML.
export async function ambilProbe(url) {
  try {
    const respons = await fetch(url, { cache: 'no-store' });
    const html = await respons.text();
    return {
      status: respons.status,
      cacheControl: respons.headers.get('cache-control') ?? '',
      xVercelCache: respons.headers.get('x-vercel-cache') ?? '',
      // Format "edge::region-fungsi::id" untuk route dinamis; membuktikan region eksekusi.
      xVercelId: respons.headers.get('x-vercel-id') ?? '',
      waktuRender: html.match(/data-rendered-at="([^"]+)"/)?.[1] ?? '',
      instans: html.match(/data-instance="([^"]+)"/)?.[1] ?? '',
    };
  } catch {
    return { status: 0, cacheControl: '', xVercelCache: '', xVercelId: '', waktuRender: '', instans: '' };
  }
}

// Mencari simpul DOM pertama (type: 'node') di dalam detail audit, untuk elemen LCP.
function cariSimpul(objek) {
  if (!objek || typeof objek !== 'object') return null;
  if (objek.type === 'node' && (objek.selector || objek.snippet)) return objek;
  for (const nilai of Object.values(objek)) {
    const hasil = cariSimpul(nilai);
    if (hasil) return hasil;
  }
  return null;
}

export function ekstrakMetrik(lhr) {
  const m = lhr.audits?.metrics?.details?.items?.[0] ?? {};
  const permintaan = lhr.audits?.['network-requests']?.details?.items ?? [];
  const dokumen = permintaan.find((r) => r.resourceType === 'Document');
  const simpulLcp = cariSimpul(lhr.audits?.['lcp-breakdown-insight']?.details);
  const throttling = lhr.configSettings?.throttling ?? {};
  return {
    ttfb: m.timeToFirstByte,
    fcp: m.firstContentfulPaint,
    lcp: m.largestContentfulPaint,
    fcpTeramati: m.observedFirstContentfulPaint,
    lcpTeramati: m.observedLargestContentfulPaint,
    lcpLoadDelay: m.lcpLoadDelay,
    lcpLoadDuration: m.lcpLoadDuration,
    lcpRenderDelay: m.lcpRenderDelay,
    statusDokumen: dokumen?.statusCode,
    protokolDokumen: dokumen?.protocol ?? '',
    jumlahRequest: permintaan.length,
    totalByte: lhr.audits?.['total-byte-weight']?.numericValue,
    elemenLcp: simpulLcp?.selector ?? simpulLcp?.snippet ?? '',
    benchmarkIndex: lhr.environment?.benchmarkIndex,
    versiLighthouse: lhr.lighthouseVersion,
    versiChrome: (lhr.environment?.hostUserAgent ?? '').match(/Chrome\/([\d.]+)/)?.[1] ?? '',
    waktuAudit: lhr.fetchTime,
    metodeThrottling: lhr.configSettings?.throttlingMethod,
    cpuSlowdown: throttling.cpuSlowdownMultiplier,
    requestLatencyMs: throttling.requestLatencyMs,
    downloadKbps: throttling.downloadThroughputKbps,
    uploadKbps: throttling.uploadThroughputKbps,
    runtimeError: lhr.runtimeError?.code ?? '',
  };
}

export const KOLOM_CSV = [
  'sesi', 'mode', 'blok', 'urutan', 'posisi', 'kondisi', 'url',
  'ttfb', 'fcp', 'lcp', 'fcpTeramati', 'lcpTeramati',
  'lcpLoadDelay', 'lcpLoadDuration', 'lcpRenderDelay',
  'statusDokumen', 'protokolDokumen', 'jumlahRequest', 'totalByte', 'elemenLcp',
  'benchmarkIndex', 'versiLighthouse', 'versiChrome', 'waktuAudit',
  'metodeThrottling', 'cpuSlowdown', 'requestLatencyMs', 'downloadKbps', 'uploadKbps', 'runtimeError',
  'cacheControl', 'xVercelCache', 'xVercelId', 'probeSebelum', 'probeSesudah', 'instansSebelum', 'instansSesudah',
  'seed', 'alasanEksklusi', 'pasanganValid', 'berkasLhr',
];

function selCsv(nilai) {
  if (nilai === undefined || nilai === null) return '';
  const teks = String(nilai);
  return /[",\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

export function keBarisCsv(objek) {
  return KOLOM_CSV.map((k) => selCsv(objek[k])).join(',');
}
