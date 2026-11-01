"""Analisis data eksperimen SSR vs SSG sesuai Bab 3 (Subbab Analisis Data).

Pemakaian:
  python analysis/analyze.py results/<sesi>/runs.csv [results/<sesi2>/runs.csv ...]
      [--mode main] [--delta 100] [--plan] [--expected-lcp SELECTOR] [--out results/analisis]

--plan     : mode perencanaan dari data pilot (Persamaan 3.4, batas atas simpangan baku,
             penyesuaian efisiensi Wilcoxon 0,864, dan verifikasi simulasi daya).
Tanpa --plan: analisis konfirmatori (uji berpasangan, ukuran efek, koreksi Bonferroni,
             interval 95% dan simultan, klasifikasi relevansi praktis, sensitivitas, diagnostik).
"""
import argparse
import json
import math
import os

import numpy as np
import pandas as pd
from scipy import stats

METRIK = ["ttfb", "fcp", "lcp"]
ALPHA = 0.05
M_UJI = 3
ALPHA_BINTANG = ALPHA / M_UJI
DAYA = 0.80
ARE_MIN_WILCOXON = 0.864  # Hodges dan Lehmann (1956)


def muat(berkas, mode):
    df = pd.concat([pd.read_csv(b) for b in berkas], ignore_index=True)
    if mode:
        df = df[df["mode"] == mode]
    df["pasanganValid"] = df["pasanganValid"].astype(str).str.lower() == "true"
    return df


def pasangkan(df, expected_lcp=None):
    sah = df[df["pasanganValid"]].copy()
    if expected_lcp:
        lcp_salah = sah.loc[sah["elemenLcp"] != expected_lcp, ["sesi", "blok"]].drop_duplicates()
        kunci = set(map(tuple, lcp_salah.values))
        sah = sah[~sah[["sesi", "blok"]].apply(tuple, axis=1).isin(kunci)]
    lebar = sah.pivot_table(
        index=["sesi", "blok", "urutan"],
        columns="kondisi",
        values=METRIK + ["fcpTeramati", "lcpTeramati", "lcpLoadDelay", "lcpLoadDuration",
                         "lcpRenderDelay", "benchmarkIndex"],
    )
    lebar.columns = [f"{m}_{k}" for m, k in lebar.columns]
    return lebar.reset_index().dropna(subset=[f"{m}_{k}" for m in METRIK for k in ("SSR", "SSG")])


def deskriptif(x):
    x = np.asarray(x, dtype=float)
    q1, q3 = np.percentile(x, [25, 75])
    rerata = x.mean()
    sd = x.std(ddof=1) if len(x) > 1 else float("nan")
    return {
        "n": int(len(x)),
        "median": float(np.median(x)),
        "q1": float(q1),
        "q3": float(q3),
        "iqr": float(q3 - q1),
        "rerata": float(rerata),
        "sd": float(sd),
        "cv_persen": float(sd / rerata * 100) if rerata > 0 else float("nan"),
    }


def selang_t(d, tingkat):
    n = len(d)
    se = d.std(ddof=1) / math.sqrt(n)
    t = stats.t.ppf(1 - (1 - tingkat) / 2, n - 1)
    return float(d.mean() - t * se), float(d.mean() + t * se)


def walsh(d):
    d = np.asarray(d, dtype=float)
    i, j = np.triu_indices(len(d))
    return np.sort((d[i] + d[j]) / 2)


def selang_hodges_lehmann(d, tingkat):
    """Interval untuk pergeseran lokasi dari rata-rata Walsh (pendekatan normal)."""
    n = len(d)
    w = walsh(d)
    z = stats.norm.ppf(1 - (1 - tingkat) / 2)
    k = int(math.floor(n * (n + 1) / 4 - z * math.sqrt(n * (n + 1) * (2 * n + 1) / 24)))
    if k < 1:
        # Pasangan terlalu sedikit untuk mencapai tingkat kepercayaan nominal.
        return float("nan"), float("nan")
    return float(w[k]), float(w[len(w) - 1 - k])


def rank_biserial(d):
    d = np.asarray(d, dtype=float)
    d = d[d != 0]
    r = stats.rankdata(np.abs(d))
    t_pos, t_neg = r[d > 0].sum(), r[d < 0].sum()
    return float((t_pos - t_neg) / (t_pos + t_neg)) if (t_pos + t_neg) > 0 else float("nan")


def pilih_uji(d):
    if len(d) < 3:
        return "tidak-cukup-data", float("nan")
    p_sw = float(stats.shapiro(d).pvalue)
    return ("t" if p_sw > ALPHA else "wilcoxon"), p_sw


def relevansi(bawah, atas, delta):
    if math.isnan(bawah) or math.isnan(atas):
        return "interval tidak tersedia (pasangan terlalu sedikit)"
    if bawah > delta or atas < -delta:
        return "relevan secara praktis"
    if bawah > -delta and atas < delta:
        return "dapat diabaikan secara praktis"
    return "belum dapat disimpulkan"


def uji_metrik(d, delta):
    d = np.asarray(d, dtype=float)
    uji, p_sw = pilih_uji(d)
    hasil = {"n_pasangan": int(len(d)), "shapiro_p": p_sw, "skewness": float(stats.skew(d)) if len(d) > 2 else None,
             "uji": uji, "selisih_deskriptif": deskriptif(d)}
    if uji == "t":
        p = float(stats.ttest_rel(d, np.zeros_like(d)).pvalue) if d.std(ddof=1) > 0 else float("nan")
        estimasi = float(d.mean())
        ukuran_efek = {"d_z": float(d.mean() / d.std(ddof=1))}
        ci95, cisim = selang_t(d, 0.95), selang_t(d, 1 - ALPHA_BINTANG)
    elif uji == "wilcoxon":
        p = float(stats.wilcoxon(d).pvalue)
        estimasi = float(np.median(walsh(d)))
        ukuran_efek = {"rank_biserial": rank_biserial(d)}
        ci95, cisim = selang_hodges_lehmann(d, 0.95), selang_hodges_lehmann(d, 1 - ALPHA_BINTANG)
    else:
        return hasil
    hasil.update({
        "p": p,
        "p_bonferroni": min(1.0, p * M_UJI),
        "signifikan": min(1.0, p * M_UJI) < ALPHA,
        "estimasi_selisih_ms": estimasi,
        "ukuran_efek": ukuran_efek,
        "ci95": ci95,
        f"ci_simultan_{(1 - ALPHA_BINTANG) * 100:.2f}": cisim,
        "relevansi_praktis": relevansi(cisim[0], cisim[1], delta),
    })
    return hasil


def gambar(lebar, folder):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, sumbu = plt.subplots(2, 3, figsize=(12, 7))
    for j, m in enumerate(METRIK):
        d = lebar[f"{m}_SSR"] - lebar[f"{m}_SSG"]
        stats.probplot(d, dist="norm", plot=sumbu[0, j])
        sumbu[0, j].set_title(f"Q-Q selisih {m.upper()}")
        sumbu[1, j].plot(range(1, len(d) + 1), d.values, marker="o")
        sumbu[1, j].axhline(0, color="gray", lw=0.8)
        sumbu[1, j].set_title(f"Selisih {m.upper()} menurut urutan pasangan")
        sumbu[1, j].set_xlabel("pasangan ke-")
        sumbu[1, j].set_ylabel("SSR - SSG (ms)")
    fig.tight_layout()
    fig.savefig(os.path.join(folder, "diagnostik-selisih.png"), dpi=150)


def analisis(lebar, delta, folder):
    laporan = {"delta_ms": delta, "alpha_keluarga": ALPHA, "alpha_per_metrik": ALPHA_BINTANG,
               "jumlah_pasangan": int(len(lebar)), "deskriptif": {}, "uji": {}, "sensitivitas": {}}
    for m in METRIK:
        laporan["deskriptif"][m] = {k: deskriptif(lebar[f"{m}_{k}"]) for k in ("SSR", "SSG")}
        d = (lebar[f"{m}_SSR"] - lebar[f"{m}_SSG"]).to_numpy()
        hasil = uji_metrik(d, delta)
        median_ssg = laporan["deskriptif"][m]["SSG"]["median"]
        if "estimasi_selisih_ms" in hasil and median_ssg:
            hasil["selisih_relatif_persen"] = hasil["estimasi_selisih_ms"] / median_ssg * 100
        laporan["uji"][m] = hasil

        # Sensitivitas (a): tanpa selisih di luar pagar luar Tukey (3 x IQR).
        q1, q3 = np.percentile(d, [25, 75])
        iqr = q3 - q1
        dalam = d[(d >= q1 - 3 * iqr) & (d <= q3 + 3 * iqr)]
        laporan["sensitivitas"].setdefault("tanpa_far_out", {})[m] = {
            "dikeluarkan": int(len(d) - len(dalam)), **uji_metrik(dalam, delta)}
        # Sensitivitas (b): menurut urutan.
        for urutan, kelompok in lebar.groupby("urutan"):
            dk = (kelompok[f"{m}_SSR"] - kelompok[f"{m}_SSG"]).to_numpy()
            laporan["sensitivitas"].setdefault("menurut_urutan", {}).setdefault(urutan, {})[m] = {
                "n": int(len(dk)), "rerata_selisih": float(dk.mean()), "median_selisih": float(np.median(dk))}

    # Diagnostik: uraian LCP (deskriptif, bukan uji konfirmatori).
    laporan["diagnostik_uraian_lcp"] = {
        komponen: float((lebar[f"{komponen}_SSR"] - lebar[f"{komponen}_SSG"]).mean())
        for komponen in ("ttfb", "lcpLoadDelay", "lcpLoadDuration", "lcpRenderDelay", "lcp")
        if f"{komponen}_SSR" in lebar
    }
    laporan["benchmark_index"] = deskriptif(pd.concat([lebar["benchmarkIndex_SSR"], lebar["benchmarkIndex_SSG"]]))
    gambar(lebar, folder)
    return laporan


def rencana(lebar, delta, folder, tingkat_ucl=0.80, simulasi=4000, seed=20261102):
    """Perencanaan jumlah pasangan dari pilot (Bab 3, Perhitungan Jumlah Pasangan)."""
    z = stats.norm.ppf(1 - ALPHA_BINTANG / 2) + stats.norm.ppf(DAYA)
    acak = np.random.default_rng(seed)
    hasil = {"delta_ms": delta, "tingkat_ucl_sd": tingkat_ucl, "metrik": {}}
    n_terbesar = 0
    for m in METRIK:
        d = (lebar[f"{m}_SSR"] - lebar[f"{m}_SSG"]).to_numpy()
        n_pilot = len(d)
        sd = d.std(ddof=1)
        # Batas atas satu sisi simpangan baku: sqrt((n-1) s^2 / chi2_{1-tingkat, n-1}).
        ucl = math.sqrt((n_pilot - 1) * sd ** 2 / stats.chi2.ppf(1 - tingkat_ucl, n_pilot - 1))
        n_m = math.ceil((z * ucl / delta) ** 2)
        hasil["metrik"][m] = {"n_pilot": n_pilot, "sd_selisih": float(sd), "ucl_sd": ucl, "n_m": n_m}
        n_terbesar = max(n_terbesar, n_m)
    n_rencana = max(math.ceil(n_terbesar / ARE_MIN_WILCOXON), 6)

    # Verifikasi simulasi: residu pilot (dipusatkan, diskalakan ke UCL) digeser sebesar delta,
    # lalu aturan pemilihan uji yang sama diterapkan pada tingkat alpha*.
    def daya_simulasi(n):
        terendah = 1.0
        for m in METRIK:
            d = (lebar[f"{m}_SSR"] - lebar[f"{m}_SSG"]).to_numpy()
            residu = (d - d.mean()) / (d.std(ddof=1) or 1) * hasil["metrik"][m]["ucl_sd"]
            tolak = 0
            for _ in range(simulasi // 4):
                sampel = acak.choice(residu, size=n, replace=True) + delta
                uji, _ = pilih_uji(sampel)
                p = stats.ttest_1samp(sampel, 0).pvalue if uji == "t" else stats.wilcoxon(sampel).pvalue
                tolak += p < ALPHA_BINTANG
            terendah = min(terendah, tolak / (simulasi // 4))
        return terendah

    n = n_rencana
    daya = daya_simulasi(n)
    while daya < DAYA and n < 500:
        n += 2
        daya = daya_simulasi(n)
    hasil.update({"n_dari_rumus_dan_are": n_rencana, "n_akhir_setelah_simulasi": n, "daya_simulasi_terendah": daya})

    # Presisi untuk kesimpulan "dapat diabaikan": interval simultan harus berada di dalam
    # (-delta, delta). Selisih sebenarnya diasumsikan delta/2 (bukan estimasi pilot),
    # sehingga hanya varians pilot yang dipakai.
    delta_asumsi = delta / 2
    n_ekuiv = 0
    for m in METRIK:
        n_m_ekuiv = math.ceil((z * hasil["metrik"][m]["ucl_sd"] / (delta - delta_asumsi)) ** 2)
        hasil["metrik"][m]["n_m_ekuivalensi"] = n_m_ekuiv
        n_ekuiv = max(n_ekuiv, n_m_ekuiv)
    n_ekuiv = math.ceil(n_ekuiv / ARE_MIN_WILCOXON)

    def peluang_ekuivalensi(n):
        terendah = 1.0
        for m in METRIK:
            d = (lebar[f"{m}_SSR"] - lebar[f"{m}_SSG"]).to_numpy()
            residu = (d - d.mean()) / (d.std(ddof=1) or 1) * hasil["metrik"][m]["ucl_sd"]
            berhasil = 0
            for _ in range(simulasi // 4):
                sampel = acak.choice(residu, size=n, replace=True) + delta_asumsi
                uji, _ = pilih_uji(sampel)
                if uji == "t":
                    bawah, atas = selang_t(sampel, 1 - ALPHA_BINTANG)
                else:
                    bawah, atas = selang_hodges_lehmann(sampel, 1 - ALPHA_BINTANG)
                berhasil += (not math.isnan(bawah)) and bawah > -delta and atas < delta
            terendah = min(terendah, berhasil / (simulasi // 4))
        return terendah

    n_e = n_ekuiv
    peluang = peluang_ekuivalensi(n_e)
    while peluang < DAYA and n_e < 500:
        n_e += 2
        peluang = peluang_ekuivalensi(n_e)

    jumlah_sesi = 3
    n_final = max(n, n_e)
    n_final = math.ceil(n_final / jumlah_sesi) * jumlah_sesi
    hasil.update({
        "selisih_asumsi_ekuivalensi_ms": delta_asumsi,
        "n_ekuivalensi_rumus_dan_are": n_ekuiv,
        "n_ekuivalensi_setelah_simulasi": n_e,
        "peluang_ekuivalensi_simulasi_terendah": peluang,
        "n_final": n_final,
        "pasangan_per_sesi": n_final // jumlah_sesi,
    })
    return hasil


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", nargs="+")
    parser.add_argument("--mode", default=None)
    parser.add_argument("--delta", type=float, default=100.0)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--expected-lcp", default=None)
    parser.add_argument("--out", default="results/analisis")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    df = muat(args.csv, args.mode)
    lebar = pasangkan(df, args.expected_lcp)
    if len(lebar) < 3:
        raise SystemExit(f"Hanya {len(lebar)} pasangan valid; minimal 3 diperlukan.")
    hasil = rencana(lebar, args.delta, args.out) if args.plan else analisis(lebar, args.delta, args.out)
    hasil["jumlah_pasangan_dianalisis"] = int(len(lebar))
    berkas = os.path.join(args.out, "rencana-jumlah-pasangan.json" if args.plan else "hasil-analisis.json")
    with open(berkas, "w", encoding="utf-8") as f:
        json.dump(hasil, f, indent=2, ensure_ascii=False)
    lebar.to_csv(os.path.join(args.out, "pasangan.csv"), index=False)
    print(json.dumps(hasil, indent=2, ensure_ascii=False))
    print(f"\nTersimpan: {berkas}")


if __name__ == "__main__":
    main()
