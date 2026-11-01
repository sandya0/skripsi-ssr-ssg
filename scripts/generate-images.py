"""Membangkitkan 12 gambar produk 1200x675 secara deterministik (seed tetap).

Gambar disimpan di public/img sebagai JPEG berkualitas tetap agar ukuran berkas
identik setiap kali dibangkitkan ulang.
"""
import os
import random

from PIL import Image, ImageDraw

LEBAR, TINGGI = 1200, 675
JUMLAH = 12
PALET = [
    ((32, 64, 120), (210, 120, 60)),
    ((20, 110, 90), (240, 200, 90)),
    ((90, 40, 110), (60, 170, 200)),
    ((150, 50, 50), (250, 220, 170)),
    ((40, 40, 40), (120, 200, 120)),
    ((10, 90, 150), (245, 245, 245)),
]


def gradien(warna_a, warna_b):
    gambar = Image.new("RGB", (LEBAR, TINGGI))
    piksel = gambar.load()
    for x in range(LEBAR):
        t = x / (LEBAR - 1)
        warna = tuple(int(a + (b - a) * t) for a, b in zip(warna_a, warna_b))
        for y in range(TINGGI):
            piksel[x, y] = warna
    return gambar


def main():
    tujuan = os.path.join(os.path.dirname(__file__), "..", "public", "img")
    os.makedirs(tujuan, exist_ok=True)
    for i in range(1, JUMLAH + 1):
        acak = random.Random(1000 + i)
        warna_a, warna_b = PALET[(i - 1) % len(PALET)]
        gambar = gradien(warna_a, warna_b)
        gambar_bentuk = ImageDraw.Draw(gambar, "RGBA")
        for _ in range(18):
            r = acak.randint(30, 160)
            x, y = acak.randint(0, LEBAR), acak.randint(0, TINGGI)
            warna = (acak.randint(0, 255), acak.randint(0, 255), acak.randint(0, 255), 110)
            gambar_bentuk.ellipse((x - r, y - r, x + r, y + r), fill=warna)
        berkas = os.path.join(tujuan, f"produk-{i:02d}.jpg")
        gambar.save(berkas, "JPEG", quality=82, optimize=True, progressive=False)
        print(f"{berkas}: {os.path.getsize(berkas)} byte")


if __name__ == "__main__":
    main()
