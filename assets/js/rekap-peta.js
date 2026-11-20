/* Peta sebaran per provinsi di Bantuan › Rekap nasional (mockup monev-gas/docs/mockup/RekapNasionalPeta.html, disetujui pemilik portal 20 Nov 2026).
   hitung() = fungsi murni dari baris rekap yang sudah disaring (RekapInti.saring) → nilai per provinsi, kelas warna, urutan, catatan data.
   html()  = seksi peta (SVG peta-provinsi.js, kelas .peta-0…5) + panel 10 provinsi, non-wilayah, sebaran, dan Catatan data.
   Angka per provinsi = RekapInti.daftarProvinsi, sama dengan tabel Rekap per provinsi. */
(function (akar) {
  "use strict";

  var METRIK = ["pagu", "bayar", "pbayar", "fisik"];
  var NAMA = {
    banper: { pagu: "Pagu bantuan", bayar: "Anggaran terbayar", pbayar: "% terbayar", fisik: "Capaian fisik" },
    semua: { pagu: "Pagu", bayar: "Realisasi SP2D", pbayar: "% SP2D", fisik: "Capaian fisik" }
  };
  var PAGU_MIN_PERSEN = 1e9;   /* metrik % terbayar: provinsi berpagu < Rp 1 M tidak diurutkan */
  var BATAS_PERSEN = [20, 40, 60, 80];

  function persen(m) { return m === "pbayar" || m === "fisik"; }
  function nilai(p, m) {
    if (m === "pagu") return p.pagu;
    if (m === "bayar") return p.terbayar;
    if (m === "pbayar") return p.pagu > 0 ? p.terbayar / p.pagu * 100 : null;
    return p.target_reg > 0 ? p.realisasi_fisik / p.target_reg * 100 : null;
  }
  /* ikut diurutkan dan masuk sebaran: rupiah > 0; % terbayar pagu ≥ Rp 1 M; capaian fisik target reguler > 0 */
  function layak(p, m, v) {
    if (v == null) return false;
    if (m === "pbayar") return p.pagu >= PAGU_MIN_PERSEN;
    if (m === "fisik") return true;
    return v > 0;
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  /* rupiah: kuantil 5 kelas, batas dibulatkan ke Rp 0,1 M; persen: tetap 20/40/60/80 */
  function batasKelas(vals, m) {
    if (persen(m)) return BATAS_PERSEN.slice();
    var s = vals.filter(function (v) { return v > 0; }).sort(function (x, y) { return x - y; }), n = s.length, b = [];
    if (!n) return [];
    /* dibulatkan ke 2 angka penting (mis. Rp 3,1 M; Rp 48 Jt) supaya legenda mudah dibaca; batas yang sama digabung */
    for (var i = 1; i <= 4; i++) {
      var v = s[Math.max(0, Math.ceil(n * i / 5) - 1)], q = Math.pow(10, Math.floor(Math.log10(v)) - 1);
      b.push(Math.max(Math.round(v / q) * q, b.length ? b[b.length - 1] : 0));
    }
    return b;
  }
  function kelas(v, b, m) {
    if (v == null || (!persen(m) && !(v > 0))) return 0;
    for (var i = 0; i < b.length; i++) if (persen(m) ? v < b[i] : v <= b[i]) return i + 1;
    return 5;
  }

  /**
   * rows: baris rekap tersaring (RekapInti.baca + saring); R: RekapInti; prov: [[kode, NAMA]] dari PetaProvinsi.PROV
   * o: { jenis: "banper"|"semua", metrik, urut: "atas"|"bawah"|null, sumber }
   */
  function hitung(rows, R, prov, o) {
    var m = METRIK.indexOf(o.metrik) >= 0 ? o.metrik : "pagu", sm = o.jenis === "semua";
    var urut = o.urut || (persen(m) ? "bawah" : "atas");
    var k = R.kartu(rows), daftar = R.daftarProvinsi(rows), per = {};
    daftar.forEach(function (p) { p.v = nilai(p, m); p.ok = layak(p, m, p.v); per[p.nama] = p; });
    var vals = daftar.filter(function (p) { return p.ok; }).map(function (p) { return p.v; });
    var b = batasKelas(vals, m);
    var peta = prov.map(function (x) {
      var p = per[x[1]];
      return { kode: x[0], nama: x[1], ada: !!p, p: p || null, kelas: p ? kelas(p.v, b, m) : 0 };
    });
    var urutan = daftar.filter(function (p) { return p.ok; }).sort(function (a, c) { return urut === "atas" ? c.v - a.v : a.v - c.v; });
    var maks = vals.length ? Math.max.apply(null, vals) : 0;
    var nonwil = { pagu: k.pagu_tl, terbayar: k.terbayar_tl,
      v: m === "pagu" ? k.pagu_tl : m === "bayar" ? k.terbayar_tl : m === "pbayar" ? (k.pagu_tl > 0 ? k.terbayar_tl / k.pagu_tl * 100 : null) : null };
    return { metrik: m, nama: NAMA[sm ? "semua" : "banper"][m], persen: persen(m), urut: urut, batas: b, peta: peta,
      top: urutan.slice(0, 10), maks: maks, median: median(vals), sebaran: vals, kartu: k, nonwil: nonwil, daftar: daftar,
      tanpaData: peta.filter(function (x) { return !x.ada; }).map(function (x) { return x.nama; }),
      catatan: catatan(k, daftar, m, sm, o.sumber, peta, R) };
  }

  /** Catatan data otomatis (aturan di mockup), paling banyak 6 butir: [jenis "info"|"warn", teks-bagian] */
  function catatan(k, daftar, m, sm, sumber, peta, R) {
    var F = fmt(), nm = function (n) { return R.namaProvinsi(n); };
    var daftarNama = function (a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " dan " + a[a.length - 1]; };
    var sebut = function (a, n) { return a.length <= n ? daftarNama(a) : a.slice(0, n).join(", ") + ", dan " + (a.length - n) + " lainnya"; };
    var bayar = sm ? "Realisasi SP2D" : "Terbayar", pg = sm ? "pagu" : "pagu bantuan", out = [];
    out.push(["info", bayar + " " + F.rasio(k.terbayar, k.pagu) + " (" + F.rupiahM(k.terbayar) + " dari " + F.rupiahM(k.pagu) + "); sisa " + F.rupiahM(k.pagu - k.terbayar) + "."]);
    var tl = k.pagu_tl > 0 ? ["info", F.rupiahM(k.pagu_tl) + " (" + F.rasio(k.pagu_tl, k.pagu) + " " + pg + ") tanpa lokus: tidak tergambar di peta dan tidak masuk urutan provinsi."] : null;
    if (sm && tl) out.push(tl);
    if (sumber === "ABT" && m === "fisik") out.push(["info", "ABT belum punya realisasi fisik; peta capaian fisik kosong."]);
    else {
      var ok = daftar.filter(function (p) { return p.ok; }).sort(function (a, b) { return a.v - b.v; });
      var tulis = function (v) { return persen(m) ? F.persen(v) : F.rupiah(v); }, nmM = NAMA[sm ? "semua" : "banper"][m];
      if (ok.length > 1) out.push(["info", nmM + " per provinsi " + tulis(ok[0].v) + " (" + nm(ok[0].nama) + ") – " + tulis(ok[ok.length - 1].v) + " (" + nm(ok[ok.length - 1].nama) + "), median " + tulis(median(ok.map(function (p) { return p.v; }))) + "."]);
      if (!persen(m) && ok.length > 5) {
        var tot = ok.reduce(function (a, p) { return a + p.v; }, 0), lima = ok.slice(-5).reduce(function (a, p) { return a + p.v; }, 0);
        out.push(["info", "5 provinsi teratas memegang " + F.rasio(lima, tot) + " " + nmM.toLowerCase() + " berlokus."]);
      }
      var nas = k.pagu > 0 ? k.terbayar / k.pagu * 100 : 0, medPagu = median(daftar.filter(function (p) { return p.pagu > 0; }).map(function (p) { return p.pagu; }));
      var tert = daftar.filter(function (p) { return p.pagu > 0 && p.pagu >= medPagu && p.terbayar / p.pagu * 100 < nas - 20; })
        .sort(function (a, b) { return a.terbayar / a.pagu - b.terbayar / b.pagu; });
      if (tert.length) out.push(["warn", tert.length + " provinsi berpagu besar " + (sm ? "realisasi SP2D-nya" : "terbayar") + " jauh di bawah nasional (" + F.persen(nas) + "): " +
        sebut(tert.map(function (p) { return nm(p.nama) + " (" + F.rasio(p.terbayar, p.pagu) + ")"; }), 3) + "."]);
      if (sumber !== "ABT") {
        var nol = daftar.filter(function (p) { return p.target_reg > 0 && !(p.realisasi_fisik > 0); }).sort(function (a, b) { return b.target_reg - a.target_reg; });
        if (nol.length) out.push(["warn", nol.length + " provinsi punya target fisik reguler tetapi belum ada tanam: " + sebut(nol.map(function (p) { return nm(p.nama); }), 3) + "."]);
      }
    }
    if (!sm && tl) out.push(tl);
    var kosong = peta.filter(function (x) { return !x.ada; }).map(function (x) { return nm(x.nama); });
    if (kosong.length) out.push(["info", sebut(kosong, 4) + " tidak punya data di rekap ini (abu-abu)."]);
    return out.slice(0, 6);
  }

  function fmt() { return (akar.Monev && akar.Monev.format) || akar.__formatUji; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /** HTML dua seksi berdampingan. H = hasil hitung(); o.saringTeks = teks saringan halaman; o.R = RekapInti */
  function html(H, o) {
    var F = fmt(), P = akar.PetaProvinsi, R = o.R, sm = o.jenis === "semua", e = esc;
    var nmP = function (n) { return R.namaProvinsi(n); };
    var tulis = function (v) { return v == null ? "–" : H.persen ? F.persen(v) : F.rupiah(v); };
    var tulisPanel = function (v) { return v == null ? "–" : H.persen ? F.persen(v) : F.ribuan(v); };
    var opsi = METRIK.map(function (m) { return '<option value="' + m + '"' + (m === H.metrik ? " selected" : "") + ">Metrik: " + e(NAMA[sm ? "semua" : "banper"][m]) + "</option>"; }).join("");
    var svg = '<svg class="peta" viewBox="' + P.VIEWBOX + '" role="img" aria-label="' + e("Peta " + H.nama.toLowerCase() + " per provinsi; makin gelap makin besar") + '">' + H.peta.map(function (x) {
      var p = x.p, lab = nmP(x.nama) + ": " + (!p ? "tidak ada data" : H.metrik === "fisik" && p.v == null ? "tidak ada target fisik reguler" :
        H.nama + " " + tulis(p.v) + " · pagu " + F.rupiahM(p.pagu) + " · " + (sm ? "SP2D " : "terbayar ") + F.rupiahM(p.terbayar));
      return '<path class="peta-prov peta-' + x.kelas + (p ? "" : " peta-kosong") + '" d="' + P.GEO[x.kode] + '"' +
        (p ? ' data-bantuan-buka-prov="' + e(x.nama) + '" tabindex="0" role="button"' : "") + ' aria-label="' + e(lab) + '"><title>' + e(lab) + "</title></path>";
    }).join("") + "</svg>";
    var b = H.batas, lab = H.persen ? ["< 20%", "20–40%", "40–60%", "60–80%", "≥ 80%"]
      : b.length ? ["≤ " + F.rupiah(b[0]), F.rupiah(b[0]) + " – " + F.rupiah(b[1]), F.rupiah(b[1]) + " – " + F.rupiah(b[2]), F.rupiah(b[2]) + " – " + F.rupiah(b[3]), "> " + F.rupiah(b[3])] : [];
    var legenda = '<div class="legenda">' + lab.map(function (t, i) { return '<span><i class="peta-' + (i + 1) + '"></i>' + e(t) + "</span>"; }).join("") +
      '<span><i class="peta-0"></i>' + (H.metrik === "fisik" ? "Tidak ada data / target fisik" : H.metrik === "pbayar" ? "Tidak ada data / pagu" : "Rp 0 / tidak ada data") + "</span></div>";
    var pilih = '<label class="sr-only" for="b-peta-buka">Buka provinsi</label><select id="b-peta-buka" data-bantuan-buka-pilih><option value="">Buka provinsi… (termasuk DKI, DIY, Bali)</option>' +
      H.daftar.slice().sort(function (a, c) { return a.nama < c.nama ? -1 : 1; }).map(function (p) { return '<option value="' + e(p.nama) + '">' + e(nmP(p.nama)) + "</option>"; }).join("") + "</select>";
    var cat = '<ul class="rp-catatan-daftar">' + H.catatan.map(function (c) {
      return '<li><span class="chip chip-' + c[0] + '">' + (c[0] === "warn" ? "Perlu dicek" : "Info") + "</span><span>" + e(c[1]) + "</span></li>";
    }).join("") + "</ul>";
    var kiri = '<section class="seksi rp-seksi" id="bantuan-peta-rekap"><div class="seksi-kepala"><h2>Sebaran per provinsi</h2><div class="rp-kepala-kanan">' +
      '<label class="sr-only" for="b-nas-metrik">Metrik peta</label><select id="b-nas-metrik" data-bantuan-filter="nas.metrik">' + opsi + "</select>" +
      '<a class="tautan-kecil" href="#bantuan-provinsi">Rekap per provinsi</a></div></div>' +
      '<span class="rp-saring">Mengikuti saringan di atas: ' + o.saringTeks + "</span>" +
      '<div class="wadah-peta">' + svg + "</div>" +
      '<div class="rp-bawah-peta">' + legenda + "<span>" + pilih + "</span></div>" +
      '<div class="rp-catatan"><h3 class="subjudul">Catatan data</h3>' + cat + "</div></section>";

    var syarat = H.metrik === "pbayar" ? " (hanya provinsi berpagu ≥ Rp 1 M)" : H.metrik === "fisik" ? " (hanya provinsi bertarget fisik reguler)" : " (Rp)";
    var top = H.top.length ? '<ol class="rp-top">' + H.top.map(function (p, i) {
      var w = H.maks > 0 ? Math.max(0, Math.min(100, p.v / H.maks * 100)) : 0;
      return '<li><button type="button" class="rp-baris" data-bantuan-buka-prov="' + e(p.nama) + '"><span class="rp-no">' + (i < 9 ? "0" : "") + (i + 1) + '</span><span class="rp-nm">' + e(nmP(p.nama)) +
        '</span><span class="rp-nl">' + e(tulisPanel(p.v)) + '</span><span class="rp-br" aria-hidden="true"><i style="width:' + (w > 0 && w < 1 ? 1 : w).toFixed(1) + '%"></i></span></button></li>';
    }).join("") + "</ol>" : '<p class="paragraf-kecil rp-top">Tidak ada provinsi untuk metrik dan saringan ini.</p>';
    var nw = H.nonwil, nonwil = nw.pagu > 0
      ? '<div class="rp-nonwil-baris"><span>Tanpa lokus (tidak punya provinsi/kabupaten)</span><span>' + e(H.metrik === "fisik" ? "–" : tulisPanel(nw.v)) + "</span></div>" +
        '<span class="catatan">' + e(H.metrik === "fisik" ? "Tidak membawa fisik." : F.rasio(nw.pagu, H.kartu.pagu) + " dari " + (sm ? "pagu" : "pagu bantuan") + " nasional; tidak tergambar di peta dan tidak diurutkan.") + "</span>"
      : '<span class="catatan">Tidak ada anggaran tanpa lokus untuk pilihan ini.</span>';
    var dots = "", sb = H.sebaran;
    if (sb.length) {
      var lo, hi, pos;
      if (H.persen) { lo = 0; hi = Math.max(100, Math.max.apply(null, sb)); pos = function (v) { return 8 + (v - lo) / (hi - lo || 1) * 284; }; }
      else { lo = Math.log10(Math.min.apply(null, sb)); hi = Math.log10(Math.max.apply(null, sb)); pos = function (v) { return 8 + (Math.log10(v) - lo) / (hi - lo || 1) * 284; }; }
      dots = '<line class="rp-sumbu" x1="4" y1="58" x2="296" y2="58"/>' + sb.map(function (v, i) { return '<circle class="rp-titik" cx="' + pos(v).toFixed(1) + '" cy="' + (16 + (i % 5) * 8) + '" r="4.2"/>'; }).join("") +
        '<line class="rp-median" x1="' + pos(H.median).toFixed(1) + '" y1="6" x2="' + pos(H.median).toFixed(1) + '" y2="58"/>';
    }
    var sumbu = sb.length ? (H.persen ? "<span>0%</span><span>" + e(F.persen(hi)) + "</span>" : "<span>" + e(F.rupiah(Math.min.apply(null, sb))) + "</span><span>" + e(F.rupiah(Math.max.apply(null, sb))) + "</span>") : "";
    var kanan = '<section class="seksi rp-seksi"><div class="seksi-kepala"><h2>10 provinsi ' + (H.urut === "atas" ? "teratas" : "terbawah") + "</h2>" +
      '<div class="segmen segmen-kecil" role="group" aria-label="Urutan provinsi">' + [["atas", "Tertinggi"], ["bawah", "Terendah"]].map(function (d) {
        return '<button type="button" data-bseg="petaUrut" data-nilai="' + d[0] + '" aria-pressed="' + (d[0] === H.urut ? "true" : "false") + '">' + d[1] + "</button>";
      }).join("") + "</div></div>" +
      '<span class="rp-saring">' + e(H.nama + " per provinsi" + syarat + ". Klik untuk membuka Rekap per provinsi.") + "</span>" + top +
      '<h3 class="rp-subjudul">Non-wilayah</h3><div class="rp-nonwil">' + nonwil + "</div>" +
      '<h3 class="rp-subjudul">Sebaran antarprovinsi <span class="catatan">' + (sb.length ? e("· " + sb.length + " provinsi · garis putus = median " + tulis(H.median) + (H.persen ? "" : " · skala log")) : "") + "</span></h3>" +
      '<div class="rp-sebaran"><svg viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="' + e("Sebaran " + H.nama.toLowerCase() + " " + sb.length + " provinsi, median " + tulis(H.median)) + '">' + dots + "</svg>" +
      '<div class="rp-sumbu-label">' + sumbu + "</div></div>" +
      '<div class="baris-alat"><button type="button" class="tombol tombol-sekunder tombol-kecil" data-bantuan-csv="peta">Unduh CSV</button><span class="catatan">semua provinsi + tanpa lokus</span></div></section>';
    return '<div class="rp-grid">' + kiri + kanan + "</div>";
  }

  /** Baris CSV: semua provinsi berdata + Tanpa lokus */
  function csv(H, sm) {
    var kepala = ["Kode provinsi", "Provinsi", sm ? "Pagu (Rp)" : "Pagu bantuan (Rp)", sm ? "Realisasi SP2D (Rp)" : "Terbayar (Rp)", sm ? "% SP2D" : "% terbayar",
      "Target fisik reguler (ha)", "Realisasi tanam (ha)", "Capaian fisik (%)"];
    var r1 = function (x) { return x == null ? "" : Math.round(x * 10) / 10; };
    var baris = H.daftar.map(function (p) {
      return [p.kode || "", p.nama, p.pagu, p.terbayar, r1(p.pagu > 0 ? p.terbayar / p.pagu * 100 : null), p.target_reg, p.realisasi_fisik, r1(p.target_reg > 0 ? p.realisasi_fisik / p.target_reg * 100 : null)];
    });
    if (H.nonwil.pagu > 0) baris.push(["", "Tanpa lokus", H.nonwil.pagu, H.nonwil.terbayar, r1(H.nonwil.terbayar / H.nonwil.pagu * 100), "", "", ""]);
    return { kepala: kepala, baris: baris };
  }

  var api = { METRIK: METRIK, NAMA: NAMA, hitung: hitung, html: html, csv: csv, _batasKelas: batasKelas, _kelas: kelas };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else akar.RekapPeta = api;
})(typeof window !== "undefined" ? window : this);
