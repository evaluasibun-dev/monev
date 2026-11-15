/* Tentang data dan rumus — mockup TentangData. Isi mengikuti keputusan final di CLAUDE.md induk.
   Tabel "Sumber data": baris di mockup kosong; isi di bawah adalah DRAF yang disusun dari
   tabel "Lokasi data" CLAUDE.md dan menunggu persetujuan pemilik portal. */
(function () {
  "use strict";

  var SUMBER = [
    ["MyIntress — realisasi", "Realisasi per kegiatan, per kegiatan satker pusat, per satker; FA16 segmen", "Unggah data (operator) → Apps Script → data/<tahun>/anggaran/", "Setiap hari kerja", "Beranda, Anggaran, Laporan harian"],
    ["MyIntress — kontrak", "Data kontrak, divalidasi V01–V14", "Unggah data (operator) → database kontrak → ringkasan tanpa nama supplier dan NRK", "Setiap hari kerja", "Beranda, Kontrak, Anggaran (OS)"],
    ["Kontrak manual HIBAH", "Kontrak di luar MyIntress, divalidasi M01–M12", "Unggah data (operator) → database kontrak", "Bila ada kontrak baru", "Kontrak, Anggaran (OS)"],
    ["Spreadsheet anggaran", "Blokir, tambahan realisasi hibah (PAGU_BLOKIR), target serapan (TARGET_SERAPAN)", "Diisi admin di halaman kerja Apps Script", "Bila berubah", "Beranda, Anggaran"],
    ["RAW SAKTI", "Pagu dan struktur anggaran: kegiatan, KRO, RO, komponen, lokus, akun", "Aplikasi integrasi → Unggah data (admin) → data/<tahun>/integrasi/", "Mingguan", "Anggaran, Bantuan"],
    ["RAW SAT 3", "Target fisik (kolom volume)", "Aplikasi integrasi → data/<tahun>/integrasi/", "Mingguan", "Bantuan"],
    ["Hilirisasi", "Luas tanam desa, diagregasi ke kabupaten", "Aplikasi integrasi → data/<tahun>/integrasi/", "Mingguan", "Bantuan, Beranda"],
    ["Sisbun (API publik)", "CPCL, kontrak benih, penyaluran, luas tanam", "Dibaca langsung dari peramban", "Langsung", "Beranda, Bantuan, Laporan harian"],
    ["Master Lokus", "Kode dan nama provinsi, kabupaten/kota", "Apps Script dan aplikasi integrasi", "Bila berubah", "Semua menu"],
    ["Laporan harian terbit", "Angka laporan yang sudah dikunci", "Diterbitkan operator → data/<tahun>/laporan/terbit/", "Setiap hari kerja", "Laporan harian, Narasi PM"]
  ];

  var RUMUS = [
    ["Anggaran terbayar (bantuan)", "SP2D akun 526 + realisasi Produksi Benih + KBD Tebu", "Outstanding kontrak tidak termasuk."],
    ["Realisasi SP2D", "Realisasi MyIntress + tambahan realisasi hibah", "Tambahan hibah hanya pembayaran yang belum tercatat di MyIntress."],
    ["Outstanding (OS)", "Nilai kontrak − pembayaran, semua kontrak aktif", "Termasuk kontrak selesai yang belum lunas; kontrak dikeluarkan tidak dihitung."],
    ["Sisa anggaran", "Pagu − Blokir − (Realisasi SP2D + OS)", "% sisa = 100% − % (SP2D + OS)."],
    ["Capaian fisik", "Luas tanam desa (Hilirisasi) ÷ target fisik (SAT 3)", "Luas HOK tidak dihitung; persen nasional di luar tebu selama data tebu belum ada."],
    ["Konversi ke hektar", "kelapa, jambu mete 110 · kopi, kakao 1.000 · pala 120 · lada 1.600 batang/ha · tebu 60.000 mata/ha", "Dipakai di laporan harian dan Narasi PM."],
    ["Status komoditas", "Luas tanam ÷ jadwal salur s.d. akhir bulan lalu", "≥ 75% sesuai jadwal · 30–75% perlu dipercepat · < 30% tertinggal jauh."]
  ];

  var ATURAN = [
    "Anggaran di semua tingkat (kegiatan, KRO, RO, komponen, lokus, akun) mengikuti RAW SAKTI, bukan SAT 3.",
    "Kode RO mengikuti SAKTI bila berbeda dengan SAT 3.",
    "Kode provinsi dan kabupaten/kota mengikuti Master Lokus; lokus tingkat provinsi tampil sebagai provinsi.",
    "Kelapa dalam, genjah, dan genjah khusus digabung menjadi Kelapa; arabika, robusta, dan liberika menjadi Kopi.",
    "Sub-komponen tebu (bongkar ratoon, perluasan, pembangunan KBD) tidak digabung.",
    "Sumber dana Reguler dan ABT selalu dipisah; ABT belum punya realisasi fisik.",
    "Target dan realisasi fisik mengikuti akun 526115.",
    "Baris SAT 3 yang lokusnya nama satker balai adalah lokasi DIPA satker tersebut."
  ];

  var POSISI = [
    ["GITHUB EVALUASIBUN-DEV · PUBLIK", "monev", "Portal ini dan JSON ringkas per tahun dan tanggal, misalnya data/2026/ dan data/2027/."],
    ["GITHUB EVALUASIBUN-DEV · PRIVAT", "monev-integrasi dan monev-gas", "Kode aplikasi integrasi, Master Lokus, dan cadangan kode Apps Script."],
    ["GOOGLE SHARED DRIVE · AKUN TIM", "File mentah", "Ekspor MyIntress, RAW SAKTI, SAT 3, dan Hilirisasi per tanggal."],
    ["GOOGLE SHARED DRIVE · AKUN TIM", "Spreadsheet dan Apps Script", "Satu Spreadsheet database kontrak per tahun anggaran; sheet Pengguna dan Master Lokus dipakai bersama semua tahun."]
  ];

  var DRIVE =
    "00_REFERENSI/            Master Lokus · Pengguna dan peran · daftar kegiatan dan unit kerja\n" +
    "2026/\n" +
    "  01_MYINTRESS/          realisasi/, fa16/, kontrak/ · satu subfolder per tanggal unggah\n" +
    "  02_INTEGRASI/          RAW SAKTI · RAW SAT 3 · Hilirisasi · hasil integrasi (Excel)\n" +
    "  03_DATABASE/           DB Kontrak TA 2026 (Spreadsheet + Apps Script)\n" +
    "                         Anggaran TA 2026: PAGU_BLOKIR, TARGET_SERAPAN, REALISASI_HARIAN\n" +
    "  04_OUTPUT/             PPT dan Excel realisasi · PDF laporan harian · rekap provinsi\n" +
    "2027/ · 2028/ · 2029/    susunan sama, dibuat saat tahun dibuka";

  var GITHUB =
    "monev/  (publik, GitHub Pages)\n" +
    "  index.html, assets/\n" +
    "  data/tahun.json                     daftar tahun dan statusnya\n" +
    "  data/2026/anggaran/latest.json      + arsip/YYYYMMDD.json\n" +
    "  data/2026/integrasi/                rekap nasional, provinsi, kabupaten\n" +
    "  data/2026/kontrak/ringkasan.json    tanpa nama supplier dan NRK\n" +
    "  data/2026/laporan/terbit/           laporan harian yang sudah dikunci\n" +
    "monev-integrasi/  (privat)            aplikasi integrasi Python, .bat\n" +
    "monev-gas/  (privat)                  cadangan kode Apps Script";

  var PERAN = [
    ["Viewer", "Melihat semua menu tanpa login; kolom kontrak ringkas tanpa nama supplier dan NRK."],
    ["Operator", "Login akun kantor; mengunggah data sesuai jenis yang diizinkan dan memverifikasi kontrak."],
    ["Admin", "Memutuskan unggahan GAGAL, mengelola pengguna, mengubah blokir dan target, mengeluarkan kontrak, memulihkan arsip."],
    ["Aturan unggah", "LOLOS langsung terbit · PERINGATAN terbit dengan catatan wajib · GAGAL menunggu admin."],
    ["Laporan harian", "Setelah terbit, angkanya dikunci sebagai pembanding Narasi PM esok hari."]
  ];

  var BATAS = [
    "Realisasi fisik Hilirisasi baru mencakup sumber dana Reguler.",
    "Data tanam tebu dan sebagian data satker Pusat belum dilaporkan di Sisbun.",
    "Target pada API publik Sisbun bisa sedikit berbeda dengan menu admin Sisbun; target resmi mengikuti SAT 3.",
    "Narasi otomatis hanya membaca angka; penyebab lapangan perlu ditambahkan saat verifikasi.",
    "Kontrak dengan KRO atau kode kegiatan kosong tampil sebagai \"Belum terpetakan\" sampai diverifikasi."
  ];

  Monev.halaman = Monev.halaman || {};

  Monev.halaman.tentang = function () {
    var e = Monev.esc;

    var tabel = SUMBER.map(function (b) {
      return "<tr><td>" + e(b[0]) + "</td><td>" + e(b[1]) + "</td><td>" + e(b[2]) + "</td><td>" + e(b[3]) + "</td><td>" + e(b[4]) + "</td></tr>";
    }).join("");

    var rumus = RUMUS.map(function (r) {
      return '<div class="rumus"><span class="rumus-nama">' + e(r[0]) + '</span><span class="rumus-isi">' + e(r[1]) +
        '</span><span class="rumus-ket">' + e(r[2]) + "</span></div>";
    }).join("");

    var aturan = ATURAN.map(function (a) { return "<li>" + e(a) + "</li>"; }).join("");

    var posisi = POSISI.map(function (p) {
      return '<div class="kotak-posisi"><span class="tempat">' + e(p[0]) + '</span><span class="nama">' + e(p[1]) +
        '</span><span class="ket">' + e(p[2]) + "</span></div>";
    }).join("");

    var peran = PERAN.map(function (p) {
      return '<div class="butir"><strong>' + e(p[0]) + "</strong><span>" + e(p[1]) + "</span></div>";
    }).join("");

    var batas = BATAS.map(function (b) { return '<p class="paragraf-kecil">' + e(b) + "</p>"; }).join("");

    return '<div class="judul-halaman"><div class="judul-halaman-teks">' +
        "<h1>Tentang data dan rumus</h1>" +
        "<p>Dari mana setiap angka di portal berasal, bagaimana dihitung, dan di mana datanya disimpan. Halaman ini terbuka untuk semua pengunjung.</p>" +
      "</div></div>" +

      '<section class="seksi" aria-labelledby="h-sumber"><h2 id="h-sumber">Sumber data</h2>' +
        '<div class="wadah-tabel"><table class="tabel tabel-lebar">' +
        "<thead><tr><th scope=\"col\">Sumber</th><th scope=\"col\">Isi</th><th scope=\"col\">Masuk ke portal</th><th scope=\"col\">Frekuensi</th><th scope=\"col\">Dipakai di</th></tr></thead>" +
        "<tbody>" + tabel + "</tbody></table></div></section>" +

      '<div class="grid-dua">' +
        '<section class="seksi" aria-labelledby="h-rumus"><h2 id="h-rumus">Rumus</h2>' + rumus + "</section>" +
        '<section class="seksi" aria-labelledby="h-aturan"><h2 id="h-aturan">Aturan integrasi</h2><ul class="daftar-titik">' + aturan + "</ul></section>" +
      "</div>" +

      '<section class="seksi" aria-labelledby="h-posisi"><h2 id="h-posisi">Posisi data</h2>' +
        '<div class="grid-posisi">' + posisi + "</div>" +
        '<p class="catatan">Data kontrak lengkap (nama supplier, NRK) dan file mentah tidak pernah masuk repo publik. Laptop tim hanya dipakai untuk login MyIntress (OTP) dan menjalankan aplikasi integrasi; tidak ada data yang hanya tersimpan di satu laptop.</p>' +
      "</section>" +

      '<section class="seksi" aria-labelledby="h-struktur"><h2 id="h-struktur">Struktur penyimpanan</h2>' +
        '<div class="grid-dua">' +
          '<div class="kolom-blok"><span class="label-blok">Google Shared Drive "Monev Ditjenbun" (akun tim)</span><pre class="blok-kode">' + e(DRIVE) + "</pre></div>" +
          '<div class="kolom-blok"><span class="label-blok">GitHub evaluasibun-dev</span><pre class="blok-kode">' + e(GITHUB) + "</pre></div>" +
        "</div>" +
      "</section>" +

      '<div class="grid-dua">' +
        '<section class="seksi" aria-labelledby="h-peran"><h2 id="h-peran">Peran dan aturan unggah</h2>' + peran + "</section>" +
        '<section class="seksi" aria-labelledby="h-batas"><h2 id="h-batas">Keterbatasan data</h2>' + batas + "</section>" +
      "</div>";
  };
})();
