/* Istilah baku — DESIGN.md §6: nama unit kerja, urutan unit, urutan komoditas. */
(function () {
  "use strict";

  /* Nama dari Apps Script (UNIT KERJA di DB_KONTRAK) → nama baku portal. */
  var UNIT = {
    "Sekretariat Direktorat Jenderal Perkebunan": "Sekretariat",
    "Direktorat Tanaman Kelapa Sawit dan Aneka Palma": "Dit. Sawit dan Aneka Palma",
    "Direktorat Pelindungan Perkebunan": "Dit. Pelindungan",
    "Direktorat Tanaman Semusim dan Tahunan": "Dit. Semusim dan Tahunan",
    "Direktorat Hilirisasi Hasil Perkebunan": "Dit. Hilirisasi",
    "Direktorat Perbenihan Perkebunan": "Dit. Perbenihan",
    "Ditjenbun Pusat (kode kegiatan belum diisi)": "Pusat, belum terpetakan",
    "Balai Besar Perbenihan dan Pelindungan Tanaman Perkebunan (BBP2TP) Medan": "BBPPTP Medan",
    "Balai Besar Perbenihan dan Pelindungan Tanaman Perkebunan (BBP2TP) Surabaya": "BBPPTP Surabaya",
    "Balai Besar Perbenihan dan Pelindungan Tanaman Perkebunan (BBP2TP) Ambon": "BBPPTP Ambon",
    "Balai Pelindungan Tanaman Perkebunan (BPTP) Pontianak": "BPTP Pontianak"
  };

  var URUTAN_UNIT = ["Sekretariat", "Dit. Sawit dan Aneka Palma", "Dit. Pelindungan", "Dit. Semusim dan Tahunan",
    "Dit. Hilirisasi", "Dit. Perbenihan", "Pusat, belum terpetakan",
    "BBPPTP Medan", "BBPPTP Surabaya", "BBPPTP Ambon", "BPTP Pontianak"];

  var URUTAN_KOMODITAS = ["Kelapa", "Kopi", "Kakao", "Pala", "Lada", "Jambu mete", "Tebu"];

  /* Aturan integrasi: kelapa dalam/genjah/genjah khusus → Kelapa; arabika/robusta/liberika → Kopi. */
  function komoditas(nama) {
    var s = String(nama || "").trim();
    if (!s || s === "-") return "";
    var k = s.toLowerCase();
    if (/^kelapa (dalam|genjah)/.test(k) || k === "kelapa") return "Kelapa";
    if (/^kopi( |$)/.test(k)) return "Kopi";
    if (k === "jambu mete") return "Jambu mete";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function urutIndeks(daftar, v) { var i = daftar.indexOf(v); return i < 0 ? 999 : i; }

  /* Kegiatan Ditjenbun: nama lengkap (REAL.NAMA_KEGIATAN di Realisasiserver.gs) dan nama singkat (mockup Anggaran). */
  var KEGIATAN = {
    "1777": ["Pengembangan Kawasan Tanaman Kelapa Sawit dan Aneka Palma", "Sawit dan aneka palma"],
    "1779": ["Pelindungan Perkebunan", "Pelindungan"],
    "1780": ["Dukungan Manajemen dan Dukungan Teknis Lainnya Ditjen Perkebunan", "Dukungan manajemen"],
    "5888": ["Pengembangan Kawasan Tanaman Semusim dan Tahunan", "Semusim dan tahunan"],
    "5889": ["Hilirisasi Hasil Perkebunan", "Hilirisasi"],
    "5890": ["Penguatan Perbenihan Tanaman Perkebunan", "Perbenihan"]
  };

  /* Satker 238830 dipecah per kode kegiatan (CFG.UNIT_KERJA_PUSAT di DatabaseKontrak.gs). */
  var SATKER_PUSAT = "238830";
  var PUSAT_PER_KEGIATAN = { "1777": "Dit. Sawit dan Aneka Palma", "1779": "Dit. Pelindungan", "1780": "Sekretariat",
    "5888": "Dit. Semusim dan Tahunan", "5889": "Dit. Hilirisasi", "5890": "Dit. Perbenihan" };
  var SATKER = { "238830": "Ditjenbun Pusat", "567338": "BBPPTP Surabaya", "567408": "BBPPTP Medan",
    "567521": "BPTP Pontianak", "567717": "BBPPTP Ambon" };
  var URUTAN_SATKER = ["238830", "567408", "567338", "567717", "567521"];

  Monev.istilah = {
    SATKER_PUSAT: SATKER_PUSAT,
    /** Nama lengkap kegiatan; kode tak dikenal → nama cadangan atau kode. */
    kegiatan: function (kode, cadangan) { return KEGIATAN[kode] ? KEGIATAN[kode][0] : (cadangan || kode || "–"); },
    kegiatanSingkat: function (kode, cadangan) { return KEGIATAN[kode] ? KEGIATAN[kode][1] : (cadangan || kode || "–"); },
    /** Unit kerja baku untuk satker + kode kegiatan (Pusat dipecah per kegiatan). */
    unitDari: function (satker, kdkeg) {
      if (satker === SATKER_PUSAT) return PUSAT_PER_KEGIATAN[kdkeg] || "Pusat, belum terpetakan";
      return SATKER[satker] || satker;
    },
    satker: function (kode, cadangan) { return SATKER[kode] || cadangan || kode; },
    urutSatker: function (a, b) { return urutIndeks(URUTAN_SATKER, a) - urutIndeks(URUTAN_SATKER, b) || (a < b ? -1 : a > b ? 1 : 0); },
    unit: function (nama) { return UNIT[nama] || nama || "(tanpa unit kerja)"; },
    urutUnit: function (a, b) { return urutIndeks(URUTAN_UNIT, a) - urutIndeks(URUTAN_UNIT, b) || (a < b ? -1 : a > b ? 1 : 0); },
    komoditas: komoditas,
    urutKomoditas: function (a, b) { return urutIndeks(URUTAN_KOMODITAS, a) - urutIndeks(URUTAN_KOMODITAS, b) || (a < b ? -1 : a > b ? 1 : 0); }
  };
})();
