# Repo monev (PUBLIK) — aturan khusus

Repo ini terbuka untuk umum dan disajikan lewat GitHub Pages di `evaluasibun-dev.github.io/monev`.
Aturan umum proyek ada di `../CLAUDE.md`. Acuan tampilan: `DESIGN.md`.

## Isi repo

```
index.html            satu halaman, navigasi dengan alamat #menu atau #menu-subtab
assets/               css, js, ikon, logo
data/tahun.json       daftar tahun anggaran dan statusnya
data/<tahun>/         anggaran/ · integrasi/ · kontrak/ · bantuan/ · laporan/terbit/
DESIGN.md             acuan tampilan
```

## Aturan teknis

- Halaman statis murni (HTML, CSS, JavaScript tanpa server). Boleh memakai pustaka dari CDN (cdnjs, jsdelivr); jangan menambah proses build kecuali disetujui.
- Semua warna lewat variabel CSS di DESIGN.md §2.1. Huruf: Space Grotesk + Inter; dokumen cetak Arial.
- Tahun aktif dibaca dari `data/tahun.json`; tahun pilihan pengguna disimpan di `localStorage` dengan `try/catch`.
- Data dibaca dari `data/<tahun>/…json` dan API publik Sisbun. Halaman yang butuh login (unggah, verifikasi, database kontrak lengkap, panel admin) **tidak** dibangun di sini; tombol Masuk mengarah ke web app Apps Script deployment kedua.
- Setiap halaman menampilkan sumber dan waktu data. Bila data gagal dimuat, tampilkan keadaan gagal sesuai DESIGN.md §5.13, jangan angka nol.
- PDF dan Excel dibuat di peramban dari JSON yang sama dengan yang tampil di layar (SheetJS untuk Excel; jsPDF atau cetak peramban untuk PDF).
- Uji di lebar 390 px (ponsel) dan 1360 px (laptop). Tidak boleh ada gulir horizontal di badan halaman.

## Yang tidak boleh masuk repo ini

- Nama supplier, NRK, nomor rekening, email pribadi, atau data perorangan lain.
- File mentah MyIntress, SAKTI, SAT 3, Hilirisasi (`.xlsx`, `.csv`).
- Token GitHub, PIN, ID Spreadsheet, kunci API apa pun.
- Kode Apps Script (tempatnya di repo privat `monev-gas`).

Sebelum setiap commit, periksa `git diff --cached` untuk hal-hal di atas.
