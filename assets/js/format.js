/* Format angka, tanggal, dan jam — DESIGN.md §6. Semua rupiah masuk sebagai angka utuh (rupiah). */
(function () {
  "use strict";

  var BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var MINUS = "−";

  function angka(n, desimal) {
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: desimal || 0,
      maximumFractionDigits: desimal || 0
    }).format(Math.abs(n));
  }

  function tanda(n) { return n < 0 ? MINUS : ""; }

  function sah(n) { return typeof n === "number" && isFinite(n); }

  var f = {
    /** 812400000000 → "Rp 812,4 M" */
    rupiahM: function (n) {
      if (!sah(n)) return "–";
      return tanda(n) + "Rp " + angka(n / 1e9, 1) + " M";
    },
    /** 420000000 → "Rp 420 Jt" */
    rupiahJt: function (n) {
      if (!sah(n)) return "–";
      return tanda(n) + "Rp " + angka(n / 1e6, 0) + " Jt";
    },
    /** Rupiah ringkas otomatis: di bawah 1 M memakai Jt. */
    rupiah: function (n) {
      if (!sah(n)) return "–";
      return Math.abs(n) >= 1e9 ? f.rupiahM(n) : f.rupiahJt(n);
    },
    /** 3977315566857 → "Rp 3.977.315.566.857" */
    rupiahLengkap: function (n) {
      if (!sah(n)) return "–";
      return tanda(n) + "Rp " + angka(Math.round(n), 0);
    },
    /** 48.7 → "48,7%" (masukan sudah dalam persen) */
    persen: function (p) {
      if (!sah(p)) return "–";
      return tanda(p) + angka(p, 1) + "%";
    },
    /** Rasio a/b dalam persen; b nol → "–" */
    rasio: function (a, b) {
      if (!sah(a) || !sah(b) || b === 0) return "–";
      return f.persen((a / b) * 100);
    },
    /** Selisih rupiah bertanda: "+Rp 12 Jt", "−Rp 1,2 M" */
    selisihRupiah: function (n) {
      if (!sah(n)) return "–";
      return (n > 0 ? "+" : "") + f.rupiah(n);
    },
    /** Selisih poin persen: "−0,3 poin" */
    selisihPoin: function (n) {
      if (!sah(n)) return "–";
      return (n > 0 ? "+" : tanda(n)) + angka(n, 1) + " poin";
    },
    /** 1250 → "1.250 ha" */
    hektar: function (n) {
      if (!sah(n)) return "–";
      return tanda(n) + angka(n, 0) + " ha";
    },
    /** 137500, "batang" → "137.500 batang" */
    satuan: function (n, nama) {
      if (!sah(n)) return "–";
      return tanda(n) + angka(n, 0) + " " + nama;
    },
    /** Bagian tanggal dan jam di zona WIB dari ISO atau Date. */
    bagianWIB: function (nilai) {
      var d = nilai instanceof Date ? nilai : new Date(nilai);
      if (isNaN(d)) return null;
      var p = {};
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta", year: "numeric", month: "numeric", day: "numeric",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { th: +p.year, bl: +p.month, tg: +p.day, jam: p.hour, mnt: p.minute };
    },
    /** "2026-11-13" atau ISO → "13 Nov 2026" */
    tanggal: function (nilai) {
      if (typeof nilai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nilai)) {
        var s = nilai.split("-");
        return +s[2] + " " + BULAN[+s[1] - 1] + " " + s[0];
      }
      var b = f.bagianWIB(nilai);
      return b ? b.tg + " " + BULAN[b.bl - 1] + " " + b.th : "–";
    },
    /** ISO → "15.30 WIB" */
    jam: function (nilai) {
      var b = f.bagianWIB(nilai);
      return b ? b.jam + "." + b.mnt + " WIB" : "–";
    },
    /** ISO → "13 Nov 2026, 15.30 WIB" */
    waktu: function (nilai) {
      var t = f.tanggal(nilai);
      return t === "–" ? t : t + ", " + f.jam(nilai);
    },
    /** Selisih hari kalender (WIB) antara ISO dan sekarang. */
    umurHari: function (nilai) {
      var a = f.bagianWIB(nilai), b = f.bagianWIB(new Date());
      if (!a || !b) return Infinity;
      return Math.round((Date.UTC(b.th, b.bl - 1, b.tg) - Date.UTC(a.th, a.bl - 1, a.tg)) / 864e5);
    }
  };

  window.Monev = window.Monev || {};
  Monev.format = f;
})();
