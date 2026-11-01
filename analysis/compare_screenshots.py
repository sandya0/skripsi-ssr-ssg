"""Membandingkan screenshot SSR dan SSG per piksel (Bab 3, Verifikasi Kesetaraan Konten).

  python analysis/compare_screenshots.py results/equivalence
Membaca screenshot-ssr.jpg dan screenshot-ssg.jpg hasil experiment/check-equivalence.mjs.
"""
import sys

import numpy as np
from PIL import Image


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "results/equivalence"
    a = np.asarray(Image.open(f"{folder}/screenshot-ssr.jpg").convert("RGB"), dtype=np.int16)
    b = np.asarray(Image.open(f"{folder}/screenshot-ssg.jpg").convert("RGB"), dtype=np.int16)
    if a.shape != b.shape:
        print(f"Ukuran berbeda: SSR {a.shape} vs SSG {b.shape}")
        sys.exit(1)
    beda = np.abs(a - b).max(axis=2)
    # Ambang 16 dari 255 menoleransi artefak kompresi JPEG pada screenshot.
    piksel_beda = int((beda > 16).sum())
    print(f"Ukuran: {a.shape[1]}x{a.shape[0]} | piksel berbeda (>16): {piksel_beda} "
          f"({piksel_beda / beda.size * 100:.4f}%) | selisih maksimum: {int(beda.max())}")


if __name__ == "__main__":
    main()
