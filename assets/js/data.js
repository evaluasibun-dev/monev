/* Pemuat data dan keadaan memuat/kosong/gagal — DESIGN.md §5.13 */
(function () {
  "use strict";

  var cache = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Muat JSON dari path relatif terhadap akar situs. Galat membawa .status (404, dst). */
  function muatJSON(path, opsi) {
    opsi = opsi || {};
    if (!opsi.segar && cache[path]) return cache[path];
    var janji = fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) {
        var e = new Error("Gagal memuat " + path + " (HTTP " + r.status + ")");
        e.status = r.status;
        throw e;
      }
      return r.json();
    });
    cache[path] = janji;
    janji.catch(function () { delete cache[path]; });
    return janji;
  }

  /** Muat data/<tahun>/<path>. Tahun bawaan = tahun aktif. */
  function muatTahun(path, ta, opsi) {
    var tahun = ta || (Monev.tahun && Monev.tahun.aktif());
    return muatJSON("data/" + tahun + "/" + path, opsi);
  }

  var tampil = {
    memuat: function (baris) {
      var n = baris || 3, s = "";
      for (var i = 0; i < n; i++) s += "<span></span>";
      return '<div class="seksi" aria-busy="true"><span class="sr-only">Memuat data…</span>' +
             '<div class="kerangka-muat" aria-hidden="true">' + s + "</div></div>";
    },
    /** kalimat: apa yang belum ada. aksi: {label, href} opsional. */
    kosong: function (judul, kalimat, aksi, tambahan) {
      return '<section class="keadaan">' +
        (judul ? "<h2>" + esc(judul) + "</h2>" : "") +
        "<p>" + esc(kalimat) + "</p>" +
        (tambahan ? '<p class="tambahan">' + esc(tambahan) + "</p>" : "") +
        (aksi ? '<a class="tombol tombol-utama" href="' + esc(aksi.href) + '">' + esc(aksi.label) + "</a>" : "") +
        "</section>";
    },
    /** apa: apa yang gagal. terakhir: kapan terakhir berhasil (teks) atau kosong. */
    gagal: function (apa, terakhir) {
      return '<section class="keadaan keadaan-gagal" role="alert">' +
        "<h2>" + esc(apa) + "</h2>" +
        "<p>" + (terakhir ? "Data terakhir berhasil dimuat " + esc(terakhir) + "." : "Belum ada data yang berhasil dimuat di peramban ini.") + "</p>" +
        '<button type="button" class="tombol tombol-sekunder" data-coba-lagi>Coba lagi</button>' +
        "</section>";
    }
  };

  /** Unduh CSV (pemisah titik koma, UTF-8 BOM agar terbaca Excel Indonesia). baris: array of array. */
  function unduhCSV(namaFile, kepala, baris) {
    var sel = function (v) {
      if (v == null) return "";
      var s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var teks = [kepala].concat(baris).map(function (r) { return r.map(sel).join(";"); }).join("\r\n");
    var blob = new Blob(["﻿" + teks], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = namaFile;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  window.Monev = window.Monev || {};
  Monev.esc = esc;
  Monev.unduhCSV = unduhCSV;
  Monev.data = { muatJSON: muatJSON, muatTahun: muatTahun, tampil: tampil };
})();
