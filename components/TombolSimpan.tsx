'use client';

import { useState } from 'react';

// Client Component kecil agar kedua kondisi memiliki kerja hydration yang sama.
export default function TombolSimpan() {
  const [tersimpan, setTersimpan] = useState(false);
  return (
    <button
      type="button"
      className="tombol"
      aria-pressed={tersimpan}
      onClick={() => setTersimpan((v) => !v)}
    >
      {tersimpan ? 'Tersimpan di daftar' : 'Simpan ke daftar'}
    </button>
  );
}
