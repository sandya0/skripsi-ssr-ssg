import { randomUUID } from 'node:crypto';

// Dibangkitkan sekali ketika modul server dimuat. Nilai yang berganti di antara
// request SSR menandakan instans server baru (indikasi cold start).
export const PENGENAL_INSTANS = randomUUID();
