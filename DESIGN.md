# DESIGN.md — Portal Monev Ditjenbun

Acuan tampilan untuk membangun portal di `evaluasibun-dev.github.io/monev` dan halaman kerja Apps Script.
Semua halaman, publik maupun yang butuh login, harus terlihat sebagai satu situs.

- Mockup acuan: https://claude.ai/artifact/VmQEve7UkMxkYoVCznAvtY (28 layar)
- Rencana pembangunan: https://claude.ai/artifact/JJFjziak42McHoctA2GpKW
- Versi: 13 November 2026

---

## 1. Prinsip

1. **Angka dulu, hiasan tidak ada.** Pengguna utama adalah pimpinan dan tim monev yang membuka portal untuk satu angka. Setiap layar dibuka dengan angka yang paling sering ditanyakan.
2. **Satu sumber, satu angka.** Angka yang sama tampil identik di semua halaman, PPT, PDF, dan Excel. Rumus ada di halaman Tentang data, bukan tersebar di kode tampilan.
3. **Asal data selalu terlihat.** Setiap halaman menulis sumber dan waktu datanya (contoh: "MyIntress diunduh 13 Nov 2026, 15.30 WIB").
4. **Warna punya arti.** Hijau tua = identitas dan aksi utama. Warna status hanya dipakai untuk status. Biru dan ungu hanya untuk asal kontrak (MyIntress dan manual).
5. **Bahasa Indonesia baku dan lugas.** Huruf kapital di awal kalimat saja. Tombol menyebut hasilnya ("Simpan dan terbitkan", bukan "Submit").
6. **Ponsel diperlakukan serius.** Pimpinan membuka Beranda dan Laporan harian dari ponsel; tabel lebar menggulir di dalam wadahnya sendiri.

---

## 2. Token

Tulis sebagai variabel CSS di `:root`. Komponen hanya memakai variabel, tidak menulis kode warna langsung.

### 2.1 Warna

```css
:root {
  color-scheme: light;

  /* dasar */
  --bg:            #F4F5F1;  /* latar halaman */
  --surface:       #FFFFFF;  /* kartu, tabel, header */
  --surface-muted: #F4F5F1;  /* kotak di dalam kartu, kepala tabel */
  --surface-sunk:  #E7EAE3;  /* wadah sub-tab, latar pratinjau dokumen */
  --line:          #DDE2D8;  /* garis kartu dan input */
  --line-soft:     #EDEFE9;  /* garis antarbaris tabel */

  /* teks */
  --ink:           #1B2A20;  /* teks utama */
  --ink-2:         #3D4A42;  /* teks isi sekunder */
  --ink-3:         #55625A;  /* keterangan, label kecil */

  /* identitas */
  --brand:         #1F6B45;  /* aksi utama, tautan, bar realisasi */
  --brand-strong:  #14492F;  /* teks di atas brand-soft, tautan saat hover */
  --brand-soft:    #E6F0E9;  /* menu aktif, chip LOLOS */
  --brand-mid:     #A8C9B4;  /* bar outstanding, CPCL */
  --report:        #1F3A68;  /* khusus laporan harian dan dokumen cetak */

  /* status */
  --ok-bg: #E6F0E9;    --ok-fg: #14492F;     /* LOLOS, sesuai jadwal, terverifikasi */
  --warn-bg: #FBE8D3;  --warn-fg: #8A3B07;   /* PERINGATAN, perlu dipercepat */
  --bad-bg: #F7DEDA;   --bad-fg: #8E1F12;    /* GAGAL, tertinggal jauh, lewat batas */
  --info-bg: #E3ECF7;  --info-fg: #1D4E89;   /* INFO, sedang diperiksa */
  --neutral-bg: #EDEFE9; --neutral-fg: #3D4A42; /* belum, tetap, data belum ada */

  /* asal kontrak */
  --src-myintress-bg: #E3ECF7; --src-myintress: #1D4E89;
  --src-manual-bg:    #EDE9FE; --src-manual:    #5B21B6;

  /* sumber dana */
  --abt-bg: #F3E8D5; --abt-fg: #7A4A12;      /* ABT; Reguler memakai --ok-* */

  /* ekspor */
  --export-ppt: #C2410C;   /* tombol unduh PPT */
  --export-pdf: #8E1F12;   /* tombol unduh PDF */
  /* Excel memakai --brand */

  --focus: #1D4E89;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #111814; --surface: #18211B; --surface-muted: #1F2A23; --surface-sunk: #0D130F;
    --line: #2E3B33; --line-soft: #253029;
    --ink: #E6ECE7; --ink-2: #C3CDC6; --ink-3: #9AA69F;
    --brand: #4FB07E; --brand-strong: #9ED8B6; --brand-soft: #1E3A2B; --brand-mid: #2F6B4A;
    --report: #8FB0E3;
    --ok-bg: #1E3A2B;   --ok-fg: #9ED8B6;
    --warn-bg: #3D2A16; --warn-fg: #F2B77A;
    --bad-bg: #3F1E1A;  --bad-fg: #F1A69B;
    --info-bg: #1B2C42; --info-fg: #9EC2F0;
    --neutral-bg: #253029; --neutral-fg: #C3CDC6;
    --src-myintress-bg: #1B2C42; --src-myintress: #9EC2F0;
    --src-manual-bg: #2B2140;    --src-manual: #C9B5F5;
    --abt-bg: #3A2C18; --abt-fg: #E8C48E;
    --focus: #9EC2F0;
  }
}
:root[data-theme="dark"] { /* salin isi blok gelap di atas */ }
```

Kontras teks utama terhadap latar di kedua tema minimal 4,5 : 1. Teks di atas chip status memakai pasangan `-fg` dengan `-bg` yang sama.

### 2.2 Tipografi

| Peran | Huruf | Ukuran | Tebal | Dipakai untuk |
|---|---|---|---|---|
| Judul halaman | Space Grotesk | 30 px (ponsel 24) | 700 | "Anggaran", "Kontrak" |
| Judul bagian | Space Grotesk | 18–20 px | 700 | Judul kartu dan seksi |
| Angka utama | Space Grotesk | 26–34 px | 700 | Kartu angka (KPI) |
| Isi | Inter | 14–15 px | 400 | Paragraf, tabel, form |
| Label | Inter | 12–13 px | 500–600 | Label kartu, keterangan sumber |
| Chip | Inter | 11–12 px | 600–700 | Status, sumber, peran |
| Kode dan nomor kontrak | ui-monospace | 12 px | 400 | `EP-01…`, KRO |
| Dokumen cetak (PDF, laporan A3/16:9) | Arial | min. 10 pt | 400/700 | Semua keluaran resmi |

```css
--font-display: "Space Grotesk", Inter, system-ui, sans-serif;
--font-body: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
--font-print: Arial, Helvetica, sans-serif;
```

Angka di tabel memakai `font-variant-numeric: tabular-nums` dan rata kanan.

### 2.3 Ruang, sudut, garis

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--space-1…6` | 4, 8, 12, 16, 20, 28 px | Jarak antarelemen |
| `--radius-sm` | 8 px | Tombol kecil, input tabel, sel |
| `--radius-md` | 10–12 px | Tombol, input, filter bar |
| `--radius-lg` | 14–16 px | Kartu dan seksi |
| `--radius-pill` | 999 px | Chip, tombol tahun |
| Garis | 1 px `--line` | Semua batas; tidak ada bayangan |
| Penanda pilihan | 2 px | Kartu atau langkah yang sedang dipilih |

Tidak ada bayangan, gradien, atau efek kaca.

---

## 3. Tata letak

```
┌──────────────────────────────────────────────────────────────┐
│ Monev Ditjenbun [TA 2026 ▾]  Beranda Anggaran …  [Halaman kerja]│ header putih, 1 baris
├──────────────────────────────────────────────────────────────┤
│  Judul halaman                       [aksi] [aksi] [unduh]   │
│  [Sub-tab | Sub-tab | Sub-tab]                               │
│  ┌ filter bar ─────────────────────── sumber & waktu data ┐  │
│  ┌ kartu angka ┐┌──────┐┌──────┐┌──────┐                    │
│  ┌ seksi: grafik ───────────┐┌ seksi: daftar ─────────────┐ │
│  ┌ seksi: tabel lebar (gulir horizontal di dalam seksi) ───┐ │
└──────────────────────────────────────────────────────────────┘
```

- Lebar isi maksimum 1320 px, padding 24–28 px, rata kiri.
- Grid kartu angka: `repeat(auto-fit, minmax(190px, 1fr))`, jarak 12 px.
- Dua seksi berdampingan: `repeat(auto-fit, minmax(460px, 1fr))`, turun jadi satu kolom di layar sempit.
- Tabel lebar dibungkus `overflow-x: auto`; badan halaman tidak boleh menggulir ke samping.
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`, dengan padding `env(safe-area-inset-*)`.

**Ponsel (< 640 px):** menu atas diganti bilah bawah lima ikon-teks (Beranda, Anggaran, Kontrak, Bantuan, Laporan). Unggah data dan Panel admin hanya lewat tombol Halaman kerja. Kartu angka dua kolom.

---

## 4. Navigasi dan alamat

### 4.1 Menu atas (sama di semua halaman)

`Beranda · Anggaran · Kontrak · Bantuan · Laporan harian · Unggah data`

Menu aktif: latar `--brand-soft`, teks `--brand-strong`, tebal 600. Tinggi minimal 40 px.

### 4.2 Sub-tab

| Menu | Sub-tab |
|---|---|
| Anggaran | Realisasi anggaran · Rincian RO dan akun · Perbandingan harian · Target serapan |
| Kontrak | Ringkasan · Validasi data · Temuan · Peringatan · Database kontrak · Aktivitas |
| Bantuan | Jejak komoditas · Rekap nasional · Rekap per provinsi |
| Laporan harian | Laporan internal (A3) · Laporan Menteri (16:9) · Narasi PM |

Sub-tab berupa segmen di wadah `--surface-sunk`; yang aktif berlatar putih.

### 4.3 Alamat halaman

Pola `#<menu>` atau `#<menu>-<subtab>`, hanya huruf kecil, angka, dan tanda hubung.
Tahun dibaca dari `data/tahun.json`; tahun yang dipilih disimpan di `localStorage` (dengan `try/catch`) dan ditampilkan di tombol "TA 2026 ▾".

| Alamat | Halaman | Login |
|---|---|---|
| `#beranda` | Beranda | Tidak |
| `#anggaran`, `#anggaran-rincian`, `#anggaran-harian`, `#anggaran-target` | Anggaran | Tidak |
| `#kontrak`, `#kontrak-temuan`, `#kontrak-peringatan` | Kontrak (data ringkas) | Tidak |
| `#bantuan`, `#bantuan-nasional`, `#bantuan-provinsi` | Bantuan | Tidak |
| `#laporan` | Laporan terbit | Tidak |
| `#tentang` | Tentang data dan rumus | Tidak |
| `#tahun` | Pilih tahun anggaran | Tidak |
| Web app Apps Script | Unggah, validasi, verifikasi, database kontrak lengkap, laporan (susun dan terbitkan), panel admin | Ya |

---

## 5. Komponen

### 5.1 Tombol

| Jenis | Tampilan | Contoh |
|---|---|---|
| Utama | Latar `--brand`, teks putih | Simpan dan terbitkan, Unduh Excel |
| Sekunder | Latar putih, garis `--line`, teks `--ink` | Validasi ulang, Batal |
| Bahaya | Latar `--bad-fg`, teks putih | Keluarkan kontrak |
| Unduh PPT | Latar `--export-ppt` | Unduh PPT |
| Unduh PDF | Latar `--export-pdf` | Unduh PDF |
| Upload MyIntress | Latar `--src-myintress` | Upload MyIntress |
| Upload manual | Latar `--src-manual` | Upload manual (HIBAH) |

Tinggi 44 px (36–40 px di dalam tabel dan filter bar), sudut 10 px, teks 14 px tebal 600. Fokus keyboard: `outline: 2px solid var(--focus); outline-offset: 2px`.
Satu tombol utama per kelompok aksi.

### 5.2 Chip

Bentuk pil, teks 11–12 px tebal 600–700, padding 3–5 × 8–10 px.

| Kelompok | Nilai | Warna |
|---|---|---|
| Hasil validasi | LOLOS · PERINGATAN · GAGAL · INFO | ok · warn · bad · info |
| Status komoditas | Sesuai jadwal · Perlu dipercepat · Tertinggal jauh · Data belum ada | ok · warn · bad · neutral |
| Verifikasi kontrak | Terverifikasi · Perlu konfirmasi · Belum | ok · info · neutral |
| Peringatan kontrak | lewat N hari · N hari lagi (≤ 7) · N hari lagi (≤ 30) | bad · warn · neutral |
| Sumber kontrak | MyIntress · Manual | src-myintress · src-manual |
| Sumber dana | Reguler · ABT | ok · abt |
| Peran | OPERATOR · PANEL ADMIN | info · abt |

Huruf kapital penuh hanya untuk hasil validasi (mengikuti istilah V01–V14 dan M01–M12 yang sudah dipakai) dan penanda peran. Nilai lain memakai huruf kapital di awal kata saja.

### 5.3 Kartu angka

```
┌────────────────────────┐
│ Realisasi SP2D          │  label 12 px --ink-3
│ 48,7%                   │  angka 26–34 px Space Grotesk 700
│ Rp 812,4 M dari pagu …  │  keterangan 12 px --ink-3
│ Realisasi anggaran      │  tautan asal, 12 px --brand (opsional)
└────────────────────────┘
```

Kartu angka yang punya halaman asal dibuat sebagai tautan ke halaman itu.

### 5.4 Tabel

- Kepala tabel berlatar `--surface-muted`, teks 13 px tebal 600.
- Baris dipisah garis `--line-soft`; tidak ada garis vertikal dan tidak ada warna selang-seling.
- Angka rata kanan, teks rata kiri; satuan ditulis di kepala kolom ("Nilai (Rp M)").
- Baris jumlah: garis atas 2 px `--line`, latar `#F9FAF7`, tebal 700.
- Baris yang perlu perhatian: latar `--warn-bg` dengan opasitas rendah, bukan teks merah.
- Tabel bertingkat (kegiatan → sub-komponen): indentasi 18 px per tingkat dan penanda ▸/▾.
- Setiap tabel data punya tombol "Unduh CSV".

### 5.5 Bar progres

- Tinggi 8–12 px, sudut penuh, latar `--line-soft`.
- Realisasi SP2D `--brand`, outstanding `--brand-mid` disambung di belakangnya.
- Persentase ditulis di kanan bar; bar tidak pernah tampil tanpa angkanya.

### 5.6 Grafik

- Garis: realisasi SP2D `--brand` 3 px, SP2D + OS `--brand-mid`, rencana putus-putus (`--export-ppt` untuk RPATA, `--info-fg` untuk tanpa RPATA).
- Sumbu dan kisi `--line` / `--line-soft`, label 11–12 px `--ink-3`.
- Legenda di atas grafik; tidak ada judul di dalam grafik (judul ada di kepala seksi).

### 5.7 Filter bar

Satu baris putih bergaris di atas isi halaman: dropdown (tinggi 40 px), lalu ruang kosong, lalu teks sumber dan waktu data di kanan. Semua filter punya label tersembunyi untuk pembaca layar.

### 5.8 Status sumber data

Chip berisi titik 8 px + nama sumber + waktu. Titik `--brand` bila diperbarui hari ini, `--warn-fg` bila lebih dari 2 hari.

### 5.9 Banner pemberitahuan

Latar `#FFF7E8`, garis `#F1D9B8`, teks `--abt-fg`, satu kalimat dan satu tombol aksi ("Verifikasi sekarang").

### 5.10 Dialog

Lapisan gelap `rgba(27,42,32,.45)`, kotak putih sudut 16 px, judul 20 px, tombol tutup 40 × 40 di kanan atas. Tombol di kanan bawah: sekunder lalu utama. Aksi berbahaya di kiri bawah.

### 5.11 Form

- Label 12 px tebal 600 di atas input; input tinggi 40–42 px.
- Isian yang terisi otomatis diberi chip kecil "otomatis, cek" (warna warn).
- Field wajib alasan ditulis "Alasan (wajib)".
- Pesan error di bawah field, menyebut apa yang salah dan cara memperbaikinya.

### 5.12 Langkah (stepper)

Tiga kotak sejajar: nomor dalam lingkaran 30 px, judul, keterangan. Selesai = lingkaran `--brand`; sedang berjalan = garis 2 px warna sumbernya (`--brand`, atau `--src-manual` untuk HIBAH); belum = abu-abu.

### 5.13 Keadaan kosong, memuat, dan gagal

| Keadaan | Isi |
|---|---|
| Kosong | Satu kalimat apa yang belum ada dan tombol untuk mengisinya ("Belum ada data realisasi hari ini. Unggah data realisasi") |
| Memuat | Kerangka abu-abu setinggi isi; tidak ada pemutar yang menutupi seluruh halaman |
| Gagal | Apa yang gagal, kapan data terakhir berhasil, dan tombol "Coba lagi" |
| Tahun belum dibuka | "TA 2027 dibuka setelah DIPA terbit." dan tautan ke halaman Pilih tahun |

---

## 6. Format angka dan istilah

| Hal | Format | Contoh |
|---|---|---|
| Rupiah ringkas | Rp + miliar 1 desimal | Rp 812,4 M |
| Rupiah juta | Rp + juta tanpa desimal | Rp 420 Jt |
| Rupiah lengkap (rekonsiliasi) | titik ribuan | Rp 3.977.315.566.857 |
| Persen | 1 desimal | 48,7% |
| Selisih | tanda + atau − (minus sejati) | +Rp 12 Jt · −0,3 poin |
| Luas | ha, titik ribuan | 1.250 ha |
| Benih | batang atau mata, titik ribuan | 137.500 batang |
| Tanggal | tanggal bulan-singkat tahun | 13 Nov 2026 |
| Jam | 24 jam dengan titik + WIB | 15.30 WIB |

Istilah baku: SP2D, outstanding (OS), SP2D + OS, pagu, blokir, CPCL, SK penetapan, HOK, RPATA, KRO, RO, unit kerja, satker, Reguler, ABT.
Nama unit kerja: Sekretariat, Dit. Sawit dan Aneka Palma, Dit. Pelindungan, Dit. Semusim dan Tahunan, Dit. Hilirisasi, Dit. Perbenihan, BBPPTP Medan, BBPPTP Surabaya, BBPPTP Ambon, BPTP Pontianak.
Urutan komoditas: Kelapa, Kopi, Kakao, Pala, Lada, Jambu mete, Tebu.

---

## 7. Keluaran cetak dan unduhan

| Keluaran | Ukuran | Aturan |
|---|---|---|
| Laporan harian internal | A3 potret | Kop dan logo, warna `--report`, Arial, sumber dan jam di kaki |
| Laporan Menteri | 16:9 | Kop, satu tabel komoditas + baris jumlah, keterangan satuan |
| Rekap nasional dan provinsi | A4 lanskap PDF | Kop "Kementerian Pertanian RI — Direktorat Jenderal Perkebunan", nomor halaman "Halaman X dari Y", catatan sumber |
| Paparan realisasi | PPTX 6 slide | Susunan slide dan gambar latar mengikuti `RealisasiAssets` Apps Script yang sudah ada |
| Paparan laporan kontrak BUN | PPTX | Memakai `TEMPLATE PAPARAN BUN.pptx` |
| Excel | XLSX | Satu sheet per tabel, persentase dan jumlah sebagai rumus, baris judul dibekukan |

Isi angka di semua keluaran diambil dari data yang sama dengan yang tampil di layar.

**Pengecualian format angka laporan harian** (disetujui 14 Nov 2026, supaya sama dengan laporan V7): di lembar A3, lembar 16:9, dan PPTX-nya, kartu memakai miliar 2 desimal yang dipotong (pagu: miliar tanpa desimal), tabel unit kerja memakai rupiah utuh, persen 2 desimal, nama unit kerja lengkap. Panel di layar tetap memakai §6. % sisa = 100% − % (SP2D + OS). Warna lembar = token terang §2.1 (`--report`, `--brand`, `--warn-fg`, `--bad-fg`), juga di tema gelap. Sumber: `assets/js/laporan-dokumen.js`.

---

## 8. Aksesibilitas

- Semua kontrol bisa dipakai dengan keyboard; urutan fokus mengikuti urutan baca.
- Target sentuh minimal 44 × 44 px.
- Grafik punya `role="img"` dan `aria-label` berisi kesimpulannya; angkanya juga tersedia di tabel atau CSV.
- Warna tidak pernah menjadi satu-satunya pembeda: chip status selalu berisi teks.
- Hormati `prefers-reduced-motion`; tidak ada animasi otomatis selain kerangka memuat.

---

## 9. Jangan

- Membuat warna, ukuran huruf, atau jarak baru di luar token ini.
- Memakai bayangan, gradien, atau ikon dekoratif.
- Menampilkan nama supplier atau NRK di halaman publik.
- Menulis angka contoh yang terlihat seperti data asli; pakai keadaan kosong atau memuat.
- Mengganti istilah baku dengan sinonim di satu halaman saja.
- Membuat jalur unggah kedua untuk jenis file yang sama; semua unggahan lewat menu Unggah data.
