/* Tahun anggaran: data/tahun.json + pilihan pengguna di localStorage. */
(function () {
  "use strict";

  var daftar = null;   // isi tahun.json
  var aktif = null;    // angka tahun
  var pendengar = [];

  function bacaSimpanan() {
    try { return parseInt(localStorage.getItem(Monev.config.KUNCI_TAHUN), 10) || null; }
    catch (e) { return null; }
  }

  function simpan(ta) {
    try { localStorage.setItem(Monev.config.KUNCI_TAHUN, String(ta)); } catch (e) { /* mode privat: abaikan */ }
  }

  function cari(ta) {
    if (!daftar) return null;
    for (var i = 0; i < daftar.tahun.length; i++) if (daftar.tahun[i].ta === ta) return daftar.tahun[i];
    return null;
  }

  function perbaruiTombol() {
    var label = document.getElementById("label-tahun");
    var tombol = document.getElementById("tombol-tahun");
    if (!label) return;
    label.textContent = aktif ? "Setditjenbun · TA " + aktif : "Setditjenbun · TA –";
    if (tombol) tombol.setAttribute("aria-label", "Tahun anggaran " + (aktif || "belum terbaca") + ", ganti tahun");
  }

  Monev.tahun = {
    /** Memuat tahun.json sekali. Mengembalikan Promise. */
    siapkan: function () {
      return Monev.data.muatJSON("data/tahun.json").then(function (j) {
        daftar = j;
        var pilihan = bacaSimpanan();
        aktif = cari(pilihan) ? pilihan : j.bawaan;
        perbaruiTombol();
        return j;
      });
    },
    aktif: function () { return aktif; },
    info: function (ta) { return cari(ta || aktif); },
    daftar: function () { return daftar ? daftar.tahun.slice() : []; },
    bawaan: function () { return daftar ? daftar.bawaan : null; },
    /** Tahun yang belum dibuka: belum ada data, halaman menampilkan keadaan "Tahun belum dibuka". */
    belumDibuka: function (ta) {
      var t = cari(ta || aktif);
      return !t || t.status === "belum_dimulai";
    },
    /** Tahun berjalan: satu-satunya tahun yang memakai Sisbun (API Sisbun tidak punya pilihan tahun). */
    berjalan: function (ta) {
      var t = cari(ta || aktif);
      return !!t && t.status === "berjalan";
    },
    /** Tahun ditutup: data tetap dibuka sebagai arsip angka akhir tahun. */
    ditutup: function (ta) {
      var t = cari(ta || aktif);
      return !!t && t.status === "ditutup";
    },
    pilih: function (ta) {
      if (!cari(ta) || ta === aktif) return;
      aktif = ta;
      simpan(ta);
      perbaruiTombol();
      pendengar.forEach(function (fn) { fn(ta); });
    },
    saatBerubah: function (fn) { pendengar.push(fn); }
  };
})();
