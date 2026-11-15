/* Grafik garis SVG ringan — DESIGN.md §5.6. Tanpa pustaka; lebar mengikuti wadah, digambar ulang saat ukuran berubah.
   Monev.grafik.garis(el, {
     label: ["2026-11-12", …],            // sumbu x (teks)
     seri: [{ nama, data:[angka|null], warna:"--brand", tebal:3, putus:false }],
     yMaks: 100, satuanY: "%",             // sumbu y 0..yMaks
     penanda: { indeks: 5, teks: "data terakhir" },   // garis tegak putus-putus (opsional)
     tinggi: 260, ringkasan: "kalimat untuk aria-label"
   }) */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var daftar = [];   // {el, opsi}
  var tunda = null;

  function warna(v) {
    if (!v) return "currentColor";
    if (v.indexOf("--") === 0) return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "currentColor";
    return v;
  }

  function teksAngka(n, satuan) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n) + (satuan || "");
  }

  function gambar(el, o) {
    var lebar = Math.max(260, Math.floor(el.clientWidth || 600));
    var tinggi = o.tinggi || 260;
    var kiri = 44, kanan = 12, atas = 12, bawah = 28;
    var w = lebar - kiri - kanan, h = tinggi - atas - bawah;
    var n = o.label.length;
    var yMaks = o.yMaks || 100;
    var x = function (i) { return kiri + (n <= 1 ? w / 2 : (i * w) / (n - 1)); };
    var y = function (v) { return atas + h - (Math.max(0, Math.min(v, yMaks)) / yMaks) * h; };
    var garisKisi = getComputedStyle(document.documentElement).getPropertyValue("--line-soft").trim();
    var garisSumbu = getComputedStyle(document.documentElement).getPropertyValue("--line").trim();
    var tinta = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim();

    var s = '<svg xmlns="' + NS + '" width="' + lebar + '" height="' + tinggi + '" viewBox="0 0 ' + lebar + " " + tinggi + '" role="img" aria-label="' +
      Monev.esc(o.ringkasan || "Grafik") + '" style="display:block;max-width:100%">';
    /* kisi dan label y */
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var v = yMaks * t, yy = y(v);
      s += '<line x1="' + kiri + '" x2="' + (kiri + w) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + (t === 0 ? garisSumbu : garisKisi) + '" stroke-width="1"/>';
      s += '<text x="' + (kiri - 6) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="' + tinta + '">' + teksAngka(v, o.satuanY) + "</text>";
    });
    /* label x: awal, tengah, akhir (hindari tumpuk) */
    var idx = n <= 1 ? [0] : n <= 3 ? o.label.map(function (_, i) { return i; }) : [0, Math.floor((n - 1) / 2), n - 1];
    if (lebar < 420 && idx.length > 2) idx = [0, n - 1];
    idx.forEach(function (i, k) {
      var anchor = k === 0 && idx.length > 1 ? "start" : k === idx.length - 1 && idx.length > 1 ? "end" : "middle";
      s += '<text x="' + x(i) + '" y="' + (tinggi - 8) + '" text-anchor="' + anchor + '" font-size="11" fill="' + tinta + '">' + Monev.esc(o.label[i]) + "</text>";
    });
    /* penanda */
    if (o.penanda && o.penanda.indeks != null && o.penanda.indeks >= 0 && o.penanda.indeks < n) {
      var px = x(o.penanda.indeks);
      s += '<line x1="' + px + '" x2="' + px + '" y1="' + atas + '" y2="' + (atas + h) + '" stroke="' + garisSumbu + '" stroke-dasharray="3 4"/>';
      if (o.penanda.teks) {
        var kananRuang = px + 6 + 80 < kiri + w;
        s += '<text x="' + (kananRuang ? px + 6 : px - 6) + '" y="' + (atas + h - 6) + '" text-anchor="' + (kananRuang ? "start" : "end") +
          '" font-size="11" fill="' + tinta + '">' + Monev.esc(o.penanda.teks) + "</text>";
      }
    }
    /* seri */
    o.seri.forEach(function (sr) {
      var d = "", buka = false;
      sr.data.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { buka = false; return; }
        d += (buka ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
        buka = true;
      });
      if (!d) return;
      s += '<path d="' + d + '" fill="none" stroke="' + warna(sr.warna) + '" stroke-width="' + (sr.tebal || 2) +
        '" stroke-linejoin="round" stroke-linecap="round"' + (sr.putus ? ' stroke-dasharray="6 5"' : "") + "/>";
      /* titik tunggal agar seri satu titik tetap terlihat */
      var ada = sr.data.filter(function (v) { return v != null && isFinite(v); });
      if (ada.length === 1) {
        var i1 = sr.data.indexOf(ada[0]);
        s += '<circle cx="' + x(i1) + '" cy="' + y(ada[0]) + '" r="3" fill="' + warna(sr.warna) + '"/>';
      }
    });
    s += "</svg>";
    el.innerHTML = s;
  }

  function legenda(seri) {
    return '<div class="legenda" aria-hidden="true">' + seri.map(function (sr) {
      return '<span><i class="legenda-garis' + (sr.putus ? " putus" : "") + '" style="--warna:var(' + sr.warna + ')"></i>' + Monev.esc(sr.nama) + "</span>";
    }).join("") + "</div>";
  }

  function garis(el, opsi) {
    daftar = daftar.filter(function (x) { return x.el.isConnected && x.el !== el; });
    daftar.push({ el: el, opsi: opsi });
    gambar(el, opsi);
  }

  window.addEventListener("resize", function () {
    clearTimeout(tunda);
    tunda = setTimeout(function () {
      daftar = daftar.filter(function (x) { return x.el.isConnected; });
      daftar.forEach(function (x) { gambar(x.el, x.opsi); });
    }, 150);
  });

  window.Monev = window.Monev || {};
  Monev.grafik = { garis: garis, legenda: legenda };
})();
