/* Rekap bantuan — fungsi murni dari data/<ta>/integrasi/rekap.json (BANPER, sheet 7) dan rekap-semua.json (Semua akun,
   sheet 17), keduanya disusun RekapInti_ di monev-gas/gas/RekapInti.gs (Keputusan 1, diubah 19 Nov 2026).
   Satu sumber untuk layar Rekap nasional/provinsi, Jejak (anggaran per komoditas, BANPER), PDF, dan Excel.
   Baris Kegiatan/Bantuan diurut grup (kawasan, kawasan ABT, pendukung; Semua akun + perbenihan, lainnya) lalu pagu menurun.
   Semua akun: kolom sp2d dibaca sebagai "terbayar" supaya fungsi di bawah dipakai bersama. */
(function (akar) {
  "use strict";

  var TANPA_KAB = "Tingkat provinsi";
  var NAMA_GRUP = ["Kawasan (reguler)", "Kawasan (ABT)", "Kegiatan pendukung", "Perbenihan (5890)", "Dukungan manajemen dan layanan lain"];
  /* nama jenis belanja (akun 3 digit) dari kolom AKUN sheet 17 */
  var NAMA_AKUN = { "511": "Belanja gaji dan tunjangan", "512": "Belanja uang lembur", "521": "Belanja barang (bahan, honor output, persediaan)",
    "521822": "Barang persediaan (pengadaan benih produksi)", "522": "Belanja jasa (sewa, jasa profesi)", "523": "Belanja pemeliharaan",
    "524": "Belanja perjalanan dinas", "526": "Belanja barang fisik diserahkan kepada masyarakat/Pemda (BANPER)",
    "532": "Belanja modal peralatan dan mesin", "-": "Fisik tanpa anggaran di SAKTI" };

  /** rekap.json / rekap-semua.json → daftar objek baris */
  function baca(j) {
    var k = (j && j.kolom) || [];
    return ((j && j.baris) || []).map(function (r) {
      var o = {}; k.forEach(function (n, i) { o[n] = r[i]; });
      if (o.terbayar == null && o.sp2d != null) o.terbayar = o.sp2d;
      return o;
    });
  }
  function semuaAkun(j) { return !!(j && j.jenis === "semua"); }
  function namaGrup(j, g) { return ((j && j.nama_grup) || NAMA_GRUP)[g] || ""; }

  /** saring: {sumber: "" | "REGULER" | "ABT", komoditas: "", kegiatan: "" (kode, Semua akun), provinsi: ""} */
  function saring(rows, s) {
    s = s || {};
    return rows.filter(function (r) {
      if (s.sumber && r.sumber_dana !== s.sumber) return false;
      if (s.komoditas && r.komoditas !== s.komoditas) return false;
      if (s.kegiatan && r.kode_kegiatan !== s.kegiatan) return false;
      if (s.provinsi && r.provinsi !== s.provinsi) return false;
      return true;
    });
  }

  function nol() { return { target: 0, realisasi: 0, pagu: 0, terbayar: 0, target_b: 0, realisasi_b: 0, pagu_b: 0, terbayar_b: 0 }; }
  function tambah(a, r) {
    a.target += r.target; a.realisasi += r.realisasi_fisik; a.pagu += r.pagu; a.terbayar += r.terbayar;
    if (r.bencana) { a.target_b += r.target; a.realisasi_b += r.realisasi_fisik; a.pagu_b += r.pagu; a.terbayar_b += r.terbayar; }
  }
  function urutKegiatan(a, b) { return a.grup - b.grup || b.pagu - a.pagu || (a.kegiatan < b.kegiatan ? -1 : 1); }

  /** Rekap per Kegiatan/Bantuan (banper.per_kegiatan) + sub-komponen tebu + jumlah prov/kab. */
  function perKegiatan(rows) {
    var g = {}, d = [];
    rows.forEach(function (r) {
      var k = r.grup + "|" + r.kegiatan + "|" + r.satuan, x = g[k];
      if (!x) {
        x = g[k] = Object.assign(nol(), { kegiatan: r.kegiatan, grup: r.grup, satuan: r.satuan, komoditas: r.komoditas,
          sumber_dana: r.sumber_dana, _prov: {}, _kab: {}, _sub: {} });
        d.push(x);
      }
      if (x.sumber_dana !== r.sumber_dana) x.sumber_dana = null;
      tambah(x, r);
      if (r.provinsi && (r.pagu || r.target)) { x._prov[r.provinsi] = 1; if (r.kabupaten) x._kab[r.provinsi + "|" + r.kabupaten] = 1; }
      if (r.sub_komponen) { var s = x._sub[r.sub_komponen] || (x._sub[r.sub_komponen] = Object.assign(nol(), { nama: r.sub_komponen })); tambah(s, r); }
    });
    d.forEach(function (x) {
      x.jml_prov = Object.keys(x._prov).length; x.jml_kab = Object.keys(x._kab).length;
      x.sub = Object.keys(x._sub).map(function (n) { return x._sub[n]; }).sort(function (a, b) { return b.target - a.target || b.pagu - a.pagu; });
      /* Semua akun: satu bagian saja ("Akun lain", "Bantuan (akun 526)") tidak perlu sub-baris */
      if (x.sub.length === 1 && /akun/i.test(x.sub[0].nama)) x.sub = [];
      delete x._prov; delete x._kab; delete x._sub;
    });
    return d.sort(urutKegiatan);
  }

  /** Jumlah: anggaran semua baris; fisik hanya baris kawasan (grup 0 dan 1, satuan hektar). */
  function jumlah(keg, rows) {
    var t = nol(), prov = {}, kab = {};
    keg.forEach(function (x) {
      t.pagu += x.pagu; t.terbayar += x.terbayar; t.pagu_b += x.pagu_b; t.terbayar_b += x.terbayar_b;
      if (x.grup <= 1) { t.target += x.target; t.realisasi += x.realisasi; t.target_b += x.target_b; t.realisasi_b += x.realisasi_b; }
    });
    (rows || []).forEach(function (r) {
      if (!r.provinsi || !(r.pagu || r.target)) return;
      prov[r.provinsi] = 1; if (r.kabupaten) kab[r.provinsi + "|" + r.kabupaten] = 1;
    });
    t.jml_prov = Object.keys(prov).length; t.jml_kab = Object.keys(kab).length;
    return t;
  }

  /** Kartu nasional: target reguler + ABT, realisasi dan capaian dari reguler (ABT belum punya realisasi fisik).
      pagu_tl / terbayar_tl = baris tanpa lokus provinsi (Semua akun). */
  function kartu(rows) {
    var k = { target: 0, target_reg: 0, realisasi_reg: 0, pagu: 0, terbayar: 0, pagu_tl: 0, terbayar_tl: 0 };
    rows.forEach(function (r) {
      k.pagu += r.pagu; k.terbayar += r.terbayar;
      if (!r.provinsi) { k.pagu_tl += r.pagu; k.terbayar_tl += r.terbayar; }
      if (r.grup <= 1) { k.target += r.target; if (r.sumber_dana === "REGULER") { k.target_reg += r.target; k.realisasi_reg += r.realisasi_fisik; } }
    });
    var j = jumlah([], rows); k.jml_prov = j.jml_prov; k.jml_kab = j.jml_kab;
    return k;
  }

  /** Provinsi berurut kode (banper.susun): lewati provinsi tanpa pagu dan tanpa target. */
  function daftarProvinsi(rows) {
    var g = {}, d = [];
    rows.forEach(function (r) {
      if (!r.provinsi) return;
      var x = g[r.provinsi];
      if (!x) { x = g[r.provinsi] = Object.assign(nol(), { nama: r.provinsi, kode: r.kode_prov, target_fisik: 0, realisasi_fisik: 0, target_reg: 0 }); d.push(x); }
      tambah(x, r);
      if (r.grup <= 1) { x.target_fisik += r.target; if (r.sumber_dana === "REGULER") { x.target_reg += r.target; x.realisasi_fisik += r.realisasi_fisik; } }
    });
    return d.filter(function (x) { return x.pagu || x.target; })
      .sort(function (a, b) { return (parseInt(a.kode, 10) || 999) - (parseInt(b.kode, 10) || 999) || (a.nama < b.nama ? -1 : 1); });
  }

  /** Baris per kabupaten untuk satu provinsi: [{kabupaten, kegiatan, grup, satuan, ...angka}] (banper.per_kabupaten) */
  function perKabupaten(rows, provinsi) {
    var g = {}, d = [];
    rows.forEach(function (r) {
      if (r.provinsi !== provinsi) return;
      var kab = r.kabupaten || TANPA_KAB, k = r.grup + "|" + r.kegiatan + "|" + kab, x = g[k];
      if (!x) { x = g[k] = Object.assign(nol(), { kabupaten: kab, kegiatan: r.kegiatan, grup: r.grup, satuan: r.satuan, komoditas: r.komoditas, sumber_dana: r.sumber_dana }); d.push(x); }
      if (x.sumber_dana !== r.sumber_dana) x.sumber_dana = null;
      tambah(x, r);
    });
    return d.filter(function (x) { return x.target || x.pagu; });
  }

  /** Per jenis belanja (Semua akun): akun 3 digit, 521822 sebagai sub-baris 521; tl = tanpa lokus. */
  function perJenisBelanja(rows) {
    var g = {}, d = [];
    function ambil(k) {
      if (!g[k]) { g[k] = Object.assign(nol(), { akun: k, nama: NAMA_AKUN[k] || ("Akun " + k), pagu_tl: 0, terbayar_tl: 0, sub: [] }); if (k !== "521822") d.push(g[k]); }
      return g[k];
    }
    rows.forEach(function (r) {
      var a = String(r.akun || "-"), list = a === "521822" ? [ambil("521"), ambil("521822")] : [ambil(a)];
      list.forEach(function (x) { tambah(x, r); if (!r.provinsi) { x.pagu_tl += r.pagu; x.terbayar_tl += r.terbayar; } });
    });
    if (g["521822"]) g["521"].sub.push(g["521822"]);
    return d.filter(function (x) { return x.pagu || x.terbayar; })
      .sort(function (a, b) { return a.akun === "-" ? 1 : b.akun === "-" ? -1 : a.akun < b.akun ? -1 : 1; });
  }

  /** Daftar kode kegiatan yang ada (Semua akun), urut kode. */
  function daftarKegiatan(rows) {
    var s = {}; rows.forEach(function (r) { if (r.kode_kegiatan) s[r.kode_kegiatan] = 1; });
    return Object.keys(s).sort();
  }

  /** Anggaran per komoditas untuk Jejak (BANPER): baris kawasan reguler + ABT. */
  function perKomoditas(rows) {
    var g = {};
    rows.forEach(function (r) {
      if (!r.komoditas || r.grup === 2) return;
      var x = g[r.komoditas] || (g[r.komoditas] = { pagu: 0, terbayar: 0, pagu_kawasan: 0, terbayar_kawasan: 0, pagu_benih: 0, terbayar_benih: 0, target_abt: 0, pagu_abt: 0 });
      x.pagu += r.pagu; x.terbayar += r.terbayar;
      if (r.grup <= 1) { x.pagu_kawasan += r.pagu; x.terbayar_kawasan += r.terbayar; } else { x.pagu_benih += r.pagu; x.terbayar_benih += r.terbayar; }
      if (r.sumber_dana === "ABT") { x.target_abt += r.target; x.pagu_abt += r.pagu; }
    });
    return g;
  }

  function daftarKomoditas(rows) {
    var s = {}; rows.forEach(function (r) { if (r.komoditas) s[r.komoditas] = 1; });
    return Object.keys(s);
  }

  /** "DAERAH ISTIMEWA YOGYAKARTA" → "Daerah Istimewa Yogyakarta"; DKI tetap huruf besar. */
  function namaProvinsi(n) {
    return String(n || "").toLowerCase().replace(/(^|[\s(.\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\bDki\b/, "DKI");
  }

  var api = { TANPA_KAB: TANPA_KAB, NAMA_GRUP: NAMA_GRUP, NAMA_AKUN: NAMA_AKUN, baca: baca, semuaAkun: semuaAkun, namaGrup: namaGrup,
    saring: saring, perKegiatan: perKegiatan, jumlah: jumlah,
    kartu: kartu, daftarProvinsi: daftarProvinsi, perKabupaten: perKabupaten, perKomoditas: perKomoditas,
    perJenisBelanja: perJenisBelanja, daftarKegiatan: daftarKegiatan, daftarKomoditas: daftarKomoditas, namaProvinsi: namaProvinsi };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else akar.RekapInti = api;
})(typeof window !== "undefined" ? window : this);
