/* Dokumen laporan harian: Laporan internal (A3), Laporan Menteri (16:9), PNG, PPTX, cetak.
 *
 * Satu sumber untuk dua tempat:
 *   - portal publik   monev/assets/js/laporan-dokumen.js   (#laporan, membaca laporan terbit)
 *   - halaman kerja   monev-gas/gas/LaporanDokumen.html     (salinan PERSIS berkas ini di dalam <script>)
 * Ubah di sini, lalu salin ke LaporanDokumen.html (uji: bandingkan isi kedua berkas).
 *
 * Masukan = objek laporan (bentuk data/<ta>/laporan/terbit/YYYY-MM-DD.json):
 *   tanggal_laporan, ta, sumber {myintress_unduh, sisbun_per, sisbun_ditarik},
 *   unit_kerja [{unit, pagu, blokir, sp2d, outstanding}],
 *   komoditas [{nama, target_btg, target_ha, kontrak_btg, kontrak_ha, cpcl_ha, tanam_btg, tanam_ha, keterangan}],
 *   catatan_kaki.
 *
 * Format angka dokumen mengikuti laporan V7 (keputusan 14 Nov 2026, DESIGN.md §7):
 *   kartu = miliar 2 desimal DIPOTONG (pagu: miliar tanpa desimal, dipotong); tabel unit = rupiah utuh;
 *   persen 2 desimal; luas dan benih tanpa desimal. % sisa = 100% − % (SP2D + OS) (Keputusan 4).
 * Warna dokumen = token terang DESIGN.md §2.1 (dokumen cetak selalu terang, juga di tema gelap).
 */
(function (akar) {
  "use strict";

  /* Token terang DESIGN.md §2.1 yang dipakai dokumen (salinan, bukan warna baru). */
  var W = {
    report: "#1F3A68", report2: "#1D4E89", brand: "#1F6B45", warn: "#8A3B07", bad: "#8E1F12",
    ink: "#1B2A20", ink3: "#55625A", line: "#DDE2D8", lineSoft: "#EDEFE9", muted: "#F4F5F1",
    total: "#F9FAF7", putih: "#FFFFFF", infoBg: "#E3ECF7"
  };

  var KONVERSI = {
    "Kelapa": { per: 110, satuan: "batang" }, "Kopi": { per: 1000, satuan: "batang" },
    "Kakao": { per: 1000, satuan: "batang" }, "Pala": { per: 120, satuan: "batang" },
    "Lada": { per: 1600, satuan: "batang" }, "Jambu mete": { per: 110, satuan: "batang" },
    "Tebu": { per: 60000, satuan: "mata" }
  };
  var KET_SATUAN = "satuan komoditas kelapa (110 batang/ha), kopi (1.000 batang/ha), kakao (1.000 batang/ha), " +
    "jambu mete (110 batang/ha), pala (120 batang/ha), dan lada (1.600 batang/ha)";
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  /* ---------- angka (rumus V7) ---------- */
  function angka(n) { return typeof n === "number" && isFinite(n) ? n : 0; }
  function nf(n, d) {
    d = d || 0;
    var v = angka(n), neg = v < 0, s = Math.abs(v).toFixed(d), p = s.split(".");
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg && +s !== 0 ? "−" : "") + p[0] + (d ? "," + p[1] : "");
  }
  function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
  function potong(n, d) { var f = Math.pow(10, d); return Math.floor(angka(n) * f + 1e-9) / f; }
  function miliar(n) { return nf(potong(angka(n) / 1e9, 2), 2); }
  function miliarBulat(n) { return nf(Math.floor(angka(n) / 1e9), 0); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /** "2026-11-13" → "13 November 2026" */
  function tanggalPanjang(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? +m[3] + " " + BULAN[+m[2] - 1] + " " + m[1] : "–";
  }
  /** ISO dengan zona → "15.30" (WIB) */
  function jamWIB(iso) {
    var m = String(iso || "").match(/T(\d{2}):(\d{2})/);
    if (!m) return "";
    var d = new Date(iso);
    if (isNaN(d)) return m[1] + "." + m[2];
    var u = new Date(d.getTime() + 7 * 3600e3);
    var j = u.getUTCHours(), n = u.getUTCMinutes();
    return (j < 10 ? "0" : "") + j + "." + (n < 10 ? "0" : "") + n;
  }

  /* ---------- hitung (sama dengan hitung() V7) ---------- */
  function hitungAnggaran(lap) {
    var T = { pagu: 0, blokir: 0, real: 0, os: 0 };
    (lap.unit_kerja || []).forEach(function (u) {
      T.pagu += angka(u.pagu); T.blokir += angka(u.blokir); T.real += angka(u.sp2d); T.os += angka(u.outstanding);
    });
    var ro = T.real + T.os, sisa = T.pagu - T.blokir - ro;
    return { T: T, totalRO: ro, sisa: sisa, pctReal: pct(T.real, T.pagu), pctOs: pct(T.os, T.pagu),
      pctRO: pct(ro, T.pagu), pctSisa: T.pagu > 0 ? 100 - pct(ro, T.pagu) : 0 };
  }
  function unitUrut(lap) {
    return (lap.unit_kerja || []).slice().sort(function (a, b) { return pct(angka(b.sp2d), angka(b.pagu)) - pct(angka(a.sp2d), angka(a.pagu)); });
  }
  function jumlahKomoditas(kom) {
    return (kom || []).reduce(function (a, k) {
      return { tHa: a.tHa + angka(k.target_ha), kHa: a.kHa + angka(k.kontrak_ha), cHa: a.cHa + angka(k.cpcl_ha), rHa: a.rHa + angka(k.tanam_ha) };
    }, { tHa: 0, kHa: 0, cHa: 0, rHa: 0 });
  }
  /** Baris tabel komoditas sebagai teks (dipakai HTML dan PPTX). */
  function barisKomoditas(lap) {
    var d = function (v) { return angka(v) > 0 ? nf(v) : "-"; };
    var rows = (lap.komoditas || []).map(function (k, i) {
      return [String(i + 1), k.nama, nf(k.target_btg), nf(k.target_ha), nf(k.kontrak_btg), nf(k.kontrak_ha), nf(pct(angka(k.kontrak_ha), angka(k.target_ha)), 2),
        nf(k.cpcl_ha), nf(pct(angka(k.cpcl_ha), angka(k.target_ha)), 2), d(k.tanam_btg), d(k.tanam_ha),
        angka(k.tanam_ha) > 0 ? nf(pct(angka(k.tanam_ha), angka(k.target_ha)), 2) : "-", k.keterangan || ""];
    });
    var K = jumlahKomoditas(lap.komoditas);
    var total = ["Jumlah", "", "–", nf(K.tHa), "–", nf(K.kHa), nf(pct(K.kHa, K.tHa), 2), nf(K.cHa), nf(pct(K.cHa, K.tHa), 2),
      "–", nf(K.rHa), nf(pct(K.rHa, K.tHa), 2), ""];
    return { rows: rows, total: total };
  }
  function barisUnit(lap) {
    var A = hitungAnggaran(lap);
    var rows = unitUrut(lap).map(function (u, i) {
      var ro = angka(u.sp2d) + angka(u.outstanding);
      return [String(i + 1), u.unit, nf(u.pagu), nf(u.blokir), nf(u.sp2d), nf(pct(angka(u.sp2d), angka(u.pagu)), 2),
        nf(u.outstanding), nf(ro), nf(pct(ro, angka(u.pagu)), 2), nf(angka(u.pagu) - angka(u.blokir) - ro)];
    });
    var T = A.T;
    var total = ["Jumlah", "", nf(T.pagu), nf(T.blokir), nf(T.real), nf(A.pctReal, 2), nf(T.os), nf(A.totalRO), nf(A.pctRO, 2), nf(A.sisa)];
    return { rows: rows, total: total };
  }
  function kartu(lap) {
    var A = hitungAnggaran(lap), ta = lap.ta || String(lap.tanggal_laporan || "").slice(0, 4);
    return [
      { warna: W.report, label: "Pagu Total", nilai: "Rp " + miliarBulat(A.T.pagu) + " M", ket: ["Total Anggaran TA " + ta] },
      { warna: W.brand, label: "Realisasi SP2D", nilai: "Rp " + miliar(A.T.real) + " M", ket: ["(" + nf(A.pctReal, 2) + "%)", "Outstanding Kontrak Rp " + miliar(A.T.os) + " M (" + nf(A.pctOs, 2) + "%)"] },
      { warna: W.warn, label: "Realisasi SP2D + OS", nilai: "Rp " + miliar(A.totalRO) + " M", ket: ["(" + nf(A.pctRO, 2) + "%)"] },
      { warna: W.bad, label: "Sisa Anggaran", nilai: "Rp " + miliar(A.sisa) + " M", ket: [nf(A.pctSisa, 2) + "% belum terealisasi"] }
    ];
  }
  function teksSumber(lap) {
    var s = lap.sumber || {}, b = [];
    if (s.myintress_unduh) b.push("Sumber: https://myintress.kemenkeu.go.id/ per " + tanggalPanjang(s.myintress_unduh) +
      (jamWIB(s.myintress_unduh) ? " pukul " + jamWIB(s.myintress_unduh) + " WIB" : ""));
    if (s.sisbun_per) b.push("Sisbun per " + tanggalPanjang(s.sisbun_per) + (s.sisbun_ditarik ? ", ditarik pukul " + jamWIB(s.sisbun_ditarik) + " WIB" : ""));
    return b.join(" · ");
  }

  /* ---------- HTML ---------- */
  var CSS =
    ".lap-lembar{box-sizing:border-box;background:" + W.putih + ";color:" + W.ink + ";font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;position:relative}" +
    ".lap-lembar *{box-sizing:border-box}" +
    ".lap-a3{width:1123px;min-height:1587px;padding:48px 46px 36px;gap:14px}" +
    ".lap-169{width:1280px;height:720px;padding:34px 40px 26px;gap:14px;overflow:hidden}" +
    ".lap-kop{display:flex;align-items:center;gap:18px;border-bottom:3px solid " + W.report + ";padding-bottom:14px}" +
    ".lap-kop img{width:62px;height:auto;flex:none}" +
    ".lap-kop h1{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;color:" + W.report + ";line-height:1.15}" +
    ".lap-169 .lap-kop h1{font-size:24px}" +
    ".lap-kop p{margin:4px 0 0;font-size:17px;font-weight:700}" +
    ".lap-judul{font-size:16px;font-weight:700;color:" + W.report + ";margin-top:4px}" +
    ".lap-judul-besar{font-size:21px;font-weight:700;color:" + W.report + ";text-align:center;margin-top:10px}" +
    ".lap-kartu{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}" +
    ".lap-k{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:8px;color:" + W.putih + "}" +
    ".lap-k b{font-size:13px;letter-spacing:.04em;text-transform:uppercase}" +
    ".lap-k strong{font-size:27px;line-height:1.15}" +
    ".lap-k span{font-size:13px;font-weight:700}" +
    ".lap-tabel{width:100%;border-collapse:collapse;font-size:12.5px}" +
    ".lap-169 .lap-tabel{font-size:14px}" +
    ".lap-tabel th{background:" + W.report + ";color:" + W.putih + ";font-weight:700;padding:6px 5px;border:1px solid " + W.line + ";text-align:center;vertical-align:middle}" +
    ".lap-tabel thead tr+tr th{background:" + W.report2 + "}" +
    ".lap-tabel td{padding:5px 6px;border:1px solid " + W.line + ";vertical-align:middle;line-height:1.3}" +
    ".lap-tabel tbody tr:nth-child(even) td{background:" + W.muted + "}" +
    ".lap-tabel tr.lap-total td{background:" + W.infoBg + ";font-weight:700}" +
    ".lap-tabel .ka{text-align:right;white-space:nowrap}.lap-tabel .te{text-align:center;white-space:nowrap}" +
    ".lap-tabel .ket{font-size:11.5px;line-height:1.3;min-width:220px}" +
    ".lap-169 .lap-tabel .ket{font-size:12.5px;min-width:300px}" +
    ".lap-catatan{font-size:12px;line-height:1.5;white-space:pre-line}" +
    ".lap-169 .lap-catatan{font-size:13px}" +
    ".lap-kaki{margin-top:auto;display:flex;align-items:center;gap:10px;padding-top:10px}" +
    ".lap-kaki i{flex:1;height:6px;background:" + W.report + ";border-radius:3px}" +
    ".lap-kaki span{font-size:12px;color:" + W.ink3 + "}";

  function pasangGaya(doc) {
    doc = doc || document;
    if (doc.getElementById("lap-gaya")) return;
    var st = doc.createElement("style");
    st.id = "lap-gaya";
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function kop(judul, sub, logo) {
    return '<div class="lap-kop">' + (logo ? '<img src="' + esc(logo) + '" alt="Logo Kementerian Pertanian">' : "") +
      "<div><h1>" + esc(judul) + "</h1><p>" + esc(sub) + "</p></div></div>";
  }
  function tabelKomoditas(lap) {
    var B = barisKomoditas(lap);
    var h = '<table class="lap-tabel"><thead><tr><th rowspan="2">No</th><th rowspan="2">Komoditas</th><th colspan="2">Target</th>' +
      '<th colspan="3">Perkembangan Kontrak Benih</th><th colspan="2">Perkembangan CPCL</th><th colspan="3">Realisasi Tanam</th><th rowspan="2">Keterangan</th></tr>' +
      "<tr><th>btg/mata</th><th>Ha</th><th>btg/mata</th><th>Ha</th><th>%</th><th>Ha</th><th>%</th><th>btg/mata</th><th>Ha</th><th>%</th></tr></thead><tbody>";
    var kls = ["te", "", "ka", "ka", "ka", "ka", "te", "ka", "te", "ka", "ka", "te", "ket"];
    B.rows.forEach(function (r) {
      h += "<tr>" + r.map(function (v, i) { return "<td" + (kls[i] ? ' class="' + kls[i] + '"' : "") + ">" + esc(v) + "</td>"; }).join("") + "</tr>";
    });
    if (!B.rows.length) h += '<tr><td colspan="13">Belum ada data komoditas.</td></tr>';
    var t = B.total;
    h += '<tr class="lap-total"><td colspan="2" class="te">' + esc(t[0]) + "</td>" +
      t.slice(2).map(function (v, i) { return '<td class="' + kls[i + 2] + '">' + esc(v) + "</td>"; }).join("") + "</tr></tbody></table>";
    return h;
  }
  function tabelUnit(lap) {
    var B = barisUnit(lap);
    var h = '<table class="lap-tabel"><thead><tr><th>No</th><th>Unit Kerja</th><th>Pagu</th><th>Blokir</th><th>Realisasi SP2D</th><th>%</th>' +
      "<th>Outstanding Kontrak</th><th>Realisasi SP2D + OS</th><th>%</th><th>Sisa Anggaran</th></tr></thead><tbody>";
    var kls = ["te", "", "ka", "ka", "ka", "te", "ka", "ka", "te", "ka"];
    B.rows.forEach(function (r) {
      h += "<tr>" + r.map(function (v, i) { return "<td" + (kls[i] ? ' class="' + kls[i] + '"' : "") + ">" + esc(v) + "</td>"; }).join("") + "</tr>";
    });
    if (!B.rows.length) h += '<tr><td colspan="10">Belum ada data realisasi.</td></tr>';
    var t = B.total;
    h += '<tr class="lap-total"><td colspan="2" class="te">' + esc(t[0]) + "</td>" +
      t.slice(2).map(function (v, i) { return '<td class="' + kls[i + 2] + '">' + esc(v) + "</td>"; }).join("") + "</tr></tbody></table>";
    return h;
  }
  function ketSatuan() {
    return '<div class="lap-catatan"><b>Keterangan:</b> <b>Batang:</b> ' + esc(KET_SATUAN) + "; <b>Mata:</b> satuan komoditas tebu (60.000 mata/ha).</div>";
  }

  /** Laporan internal A3 potret (1123 × 1587 px pada 96 dpi). opsi.logo = URL/data URL logo. */
  function htmlA3(lap, opsi) {
    opsi = opsi || {};
    var K = kartu(lap);
    return '<div class="lap-lembar lap-a3" data-lembar="a3">' +
      kop("LAPORAN HARIAN DIREKTORAT JENDERAL PERKEBUNAN", "Per " + tanggalPanjang(lap.tanggal_laporan), opsi.logo) +
      '<div class="lap-judul">Progres Realisasi Anggaran</div>' +
      '<div class="lap-kartu">' + K.map(function (k) {
        return '<div class="lap-k" style="background:' + k.warna + '"><b>' + esc(k.label) + "</b><strong>" + esc(k.nilai) + "</strong>" +
          k.ket.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>";
      }).join("") + "</div>" +
      '<div class="lap-judul">Perbenihan dan Realisasi Tanam</div>' + tabelKomoditas(lap) + ketSatuan() +
      '<div class="lap-judul-besar">REALISASI KEGIATAN PER UNIT KERJA</div>' + tabelUnit(lap) +
      '<div class="lap-catatan">' + esc([lap.catatan_kaki || "", teksSumber(lap)].filter(Boolean).join("\n")) + "</div>" +
      '<div class="lap-kaki"><i></i><span>1</span></div></div>';
  }
  /** Laporan Menteri 16:9 (1280 × 720 px). */
  function htmlMenteri(lap, opsi) {
    opsi = opsi || {};
    return '<div class="lap-lembar lap-169" data-lembar="menteri">' +
      kop("Laporan Realisasi Perbenihan dan Tanam Komoditas Perkebunan", "per " + tanggalPanjang(lap.tanggal_laporan), opsi.logo) +
      tabelKomoditas(lap) + ketSatuan() +
      '<div class="lap-kaki"><i></i><span>1</span></div></div>';
  }

  /* ---------- pustaka dari CDN (dimuat saat diminta) ---------- */
  var CDN = {
    html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    pptx: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"
  };
  var janji = {};
  function muatSkrip(kunci, cek) {
    if (cek()) return Promise.resolve();
    if (!janji[kunci]) {
      janji[kunci] = new Promise(function (ok, gagal) {
        var s = document.createElement("script");
        s.src = CDN[kunci];
        s.onload = function () { ok(); };
        s.onerror = function () { delete janji[kunci]; gagal(new Error("Pustaka " + kunci + " gagal dimuat. Periksa koneksi internet.")); };
        document.head.appendChild(s);
      });
    }
    return janji[kunci];
  }
  function unduhBlob(href, nama) {
    var a = document.createElement("a");
    a.href = href; a.download = nama;
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 0);
  }

  /** PNG dari lembar ukuran asli (bukan pratinjau yang diperkecil). */
  function unduhPNG(jenis, lap, opsi) {
    return muatSkrip("html2canvas", function () { return typeof akar.html2canvas === "function"; }).then(function () {
      pasangGaya();
      var wadah = document.createElement("div");
      wadah.style.cssText = "position:fixed;left:-20000px;top:0;";
      wadah.innerHTML = jenis === "menteri" ? htmlMenteri(lap, opsi) : htmlA3(lap, opsi);
      document.body.appendChild(wadah);
      return akar.html2canvas(wadah.firstChild, { scale: 2, backgroundColor: W.putih, useCORS: true }).then(function (kanvas) {
        wadah.remove();
        unduhBlob(kanvas.toDataURL("image/png"), namaFile(jenis, lap) + ".png");
      }, function (e) { wadah.remove(); throw e; });
    });
  }
  function namaFile(jenis, lap) {
    return (jenis === "menteri" ? "laporan-menteri-16x9-" : "laporan-internal-A3-") + (lap.tanggal_laporan || "tanpa-tanggal");
  }

  /* ---------- PPTX (susunan dari modul PPTX V7, warna --report) ---------- */
  function hx(c) { return c.replace("#", ""); }
  function pptKomoditas(lap, pt, ptKet) {
    var h = { fill: { color: hx(W.report) }, color: "FFFFFF", bold: true, fontSize: pt, align: "center", valign: "middle" };
    var h2 = Object.assign({}, h, { fill: { color: hx(W.report2) } });
    var baris = [[
      { text: "No", options: Object.assign({ rowspan: 2 }, h) }, { text: "Komoditas", options: Object.assign({ rowspan: 2 }, h) },
      { text: "Target", options: Object.assign({ colspan: 2 }, h) }, { text: "Perkembangan Kontrak Benih", options: Object.assign({ colspan: 3 }, h) },
      { text: "Perkembangan CPCL", options: Object.assign({ colspan: 2 }, h) }, { text: "Realisasi Tanam", options: Object.assign({ colspan: 3 }, h) },
      { text: "Keterangan", options: Object.assign({ rowspan: 2 }, h) }
    ], ["btg/mata", "Ha", "btg/mata", "Ha", "%", "Ha", "%", "btg/mata", "Ha", "%"].map(function (t) { return { text: t, options: h2 }; })];
    var al = ["center", "left", "right", "right", "right", "right", "center", "right", "center", "right", "right", "center", "left"];
    var B = barisKomoditas(lap);
    B.rows.forEach(function (r, i) {
      var bg = i % 2 ? hx(W.muted) : "FFFFFF";
      baris.push(r.map(function (v, j) { return { text: v, options: { fill: { color: bg }, color: hx(W.ink), fontSize: j === 12 ? ptKet : pt, align: al[j], valign: "middle" } }; }));
    });
    var tot = function (t, a) { return { text: t, options: { fill: { color: hx(W.infoBg) }, color: hx(W.ink), bold: true, fontSize: pt, align: a, valign: "middle" } }; };
    var t = B.total;
    var akhir = [{ text: t[0], options: { fill: { color: hx(W.infoBg) }, color: hx(W.ink), bold: true, fontSize: pt, align: "center", valign: "middle", colspan: 2 } }];
    t.slice(2).forEach(function (v, j) { akhir.push(tot(v, al[j + 2])); });
    baris.push(akhir);
    return baris;
  }
  function pptUnit(lap, pt) {
    var h = { fill: { color: hx(W.report) }, color: "FFFFFF", bold: true, fontSize: pt, align: "center", valign: "middle" };
    var baris = [["No", "Unit Kerja", "Pagu", "Blokir", "Realisasi SP2D", "%", "Outstanding Kontrak", "Realisasi SP2D + OS", "%", "Sisa Anggaran"]
      .map(function (x) { return { text: x, options: h }; })];
    var al = ["center", "left", "right", "right", "right", "center", "right", "right", "center", "right"];
    var B = barisUnit(lap);
    B.rows.forEach(function (r, i) {
      var bg = i % 2 ? hx(W.muted) : "FFFFFF";
      baris.push(r.map(function (v, j) { return { text: v, options: { fill: { color: bg }, color: hx(W.ink), fontSize: pt, align: al[j], valign: "middle" } }; }));
    });
    var t = B.total;
    var akhir = [{ text: t[0], options: { fill: { color: hx(W.infoBg) }, color: hx(W.ink), bold: true, fontSize: pt, align: "center", valign: "middle", colspan: 2 } }];
    t.slice(2).forEach(function (v, j) { akhir.push({ text: v, options: { fill: { color: hx(W.infoBg) }, color: hx(W.ink), bold: true, fontSize: pt, align: al[j + 2], valign: "middle" } }); });
    baris.push(akhir);
    return baris;
  }
  function pptKetSatuan() {
    return [{ text: "Keterangan: ", options: { bold: true } }, { text: "Batang: ", options: { bold: true } }, { text: KET_SATUAN + "; " },
      { text: "Mata: ", options: { bold: true } }, { text: "satuan komoditas tebu (60.000 mata/ha)." }];
  }
  function buatPresentasi(PptxGen, jenis, lap, logo) {
    var pres = new PptxGen();
    pres.author = "Direktorat Jenderal Perkebunan";
    var s, M = 0.5, LW, nK = (lap.komoditas || []).length || 1;
    if (jenis === "menteri") {
      pres.title = "Laporan Realisasi Perbenihan dan Tanam";
      pres.layout = "LAYOUT_WIDE";   // 16:9, 13,33 × 7,5 inci
      LW = 13.333;
      s = pres.addSlide();
      var Wm = LW - M * 2;
      if (logo) s.addImage({ data: logo, x: M, y: 0.3, w: 0.62, h: 0.68 });
      s.addText([{ text: "Laporan Realisasi Perbenihan dan Tanam Komoditas Perkebunan", options: { breakLine: true, fontSize: 20, bold: true, color: hx(W.report) } },
        { text: "per " + tanggalPanjang(lap.tanggal_laporan), options: { fontSize: 13, bold: true, color: hx(W.ink) } }],
        { x: M + 0.8, y: 0.28, w: Wm - 0.8, h: 0.75, margin: 0, valign: "middle" });
      s.addShape("rect", { x: M, y: 1.1, w: Wm, h: 0.03, fill: { color: hx(W.report) }, line: { color: hx(W.report) } });
      s.addTable(pptKomoditas(lap, 10, 8.5), { x: M, y: 1.25, w: Wm,
        colW: [0.35, 1.0, 1.15, 0.75, 1.15, 0.75, 0.6, 0.75, 0.6, 1.0, 0.65, 0.6, 2.98],
        rowH: [0.3, 0.3].concat(Array(nK).fill(4.3 / nK), [0.34]), border: { pt: 0.5, color: hx(W.line) }, autoPage: false, valign: "middle" });
      s.addText(pptKetSatuan(), { x: M, y: 6.55, w: Wm, h: 0.5, fontSize: 10, color: hx(W.ink), margin: 0 });
      s.addShape("rect", { x: M, y: 7.18, w: Wm - 0.45, h: 0.06, fill: { color: hx(W.report) }, line: { color: hx(W.report) } });
      s.addText("1", { x: LW - M - 0.3, y: 7.08, w: 0.3, h: 0.26, fontSize: 10, color: hx(W.ink3), align: "center", valign: "middle", margin: 0 });
    } else {
      pres.title = "Laporan Harian Ditjenbun";
      pres.defineLayout({ name: "A3P", width: 11.69, height: 16.54 });
      pres.layout = "A3P";
      LW = 11.69;
      s = pres.addSlide();
      var Wa = LW - M * 2, nU = (lap.unit_kerja || []).length || 1;
      if (logo) s.addImage({ data: logo, x: M, y: 0.42, w: 0.78, h: 0.86 });
      s.addText([{ text: "LAPORAN HARIAN DIREKTORAT JENDERAL PERKEBUNAN", options: { breakLine: true, fontSize: 22, bold: true, color: hx(W.report) } },
        { text: "Per " + tanggalPanjang(lap.tanggal_laporan), options: { fontSize: 14, bold: true, color: hx(W.ink) } }],
        { x: M + 0.95, y: 0.4, w: Wa - 0.95, h: 0.9, margin: 0, valign: "middle" });
      s.addShape("rect", { x: M, y: 1.4, w: Wa, h: 0.04, fill: { color: hx(W.report) }, line: { color: hx(W.report) } });
      s.addText("Progres Realisasi Anggaran", { x: M, y: 1.52, w: Wa, h: 0.3, fontSize: 13, bold: true, color: hx(W.report), margin: 0 });
      var gap = 0.16, kw = (Wa - gap * 3) / 4;
      kartu(lap).forEach(function (k, i) {
        var kx = M + i * (kw + gap);
        s.addShape("roundRect", { x: kx, y: 1.88, w: kw, h: 1.45, fill: { color: hx(k.warna) }, rectRadius: 0.06, line: { color: hx(k.warna) } });
        var teks = [{ text: k.label.toUpperCase(), options: { fontSize: 10, bold: true, color: "FFFFFF", breakLine: true } },
          { text: k.nilai, options: { fontSize: 20, bold: true, color: "FFFFFF", breakLine: true } }];
        k.ket.forEach(function (x) { teks.push({ text: x, options: { fontSize: 9, bold: true, color: "FFFFFF", breakLine: true } }); });
        s.addText(teks, { x: kx + 0.12, y: 1.96, w: kw - 0.24, h: 1.29, valign: "middle", align: "left", margin: 0 });
      });
      s.addText("Perbenihan dan Realisasi Tanam", { x: M, y: 3.5, w: Wa, h: 0.3, fontSize: 13, bold: true, color: hx(W.report), margin: 0 });
      s.addTable(pptKomoditas(lap, 8, 7), { x: M, y: 3.85, w: Wa,
        colW: [0.3, 0.8, 0.95, 0.6, 0.95, 0.6, 0.45, 0.6, 0.45, 0.8, 0.5, 0.45, 3.24],
        rowH: [0.26, 0.26].concat(Array(nK).fill(4.1 / nK), [0.3]), border: { pt: 0.5, color: hx(W.line) }, autoPage: false, valign: "middle" });
      s.addText(pptKetSatuan(), { x: M, y: 8.9, w: Wa, h: 0.5, fontSize: 9.5, color: hx(W.ink), margin: 0 });
      s.addText("REALISASI KEGIATAN PER UNIT KERJA", { x: M, y: 9.5, w: Wa, h: 0.5, fontSize: 20, bold: true, color: hx(W.report), align: "center", margin: 0 });
      s.addTable(pptUnit(lap, 8), { x: M, y: 10.1, w: Wa,
        colW: [0.35, 2.3, 1.15, 0.95, 1.15, 0.5, 1.25, 1.25, 0.5, 1.29],
        rowH: [0.4].concat(Array(nU).fill(4.1 / nU), [0.34]), border: { pt: 0.5, color: hx(W.line) }, autoPage: false, valign: "middle" });
      s.addText([lap.catatan_kaki || "", teksSumber(lap)].filter(Boolean).join("\n"), { x: M, y: 15.05, w: Wa, h: 0.9, fontSize: 9.5, color: hx(W.ink), margin: 0, valign: "top" });
      s.addShape("rect", { x: M, y: 16.14, w: Wa - 0.45, h: 0.06, fill: { color: hx(W.report) }, line: { color: hx(W.report) } });
      s.addText("1", { x: LW - M - 0.32, y: 16.03, w: 0.32, h: 0.28, fontSize: 10, color: hx(W.ink3), align: "center", valign: "middle", margin: 0 });
    }
    return pres;
  }
  /** logo = data URL (data:image/png;base64,...) atau null. */
  function unduhPPTX(jenis, lap, logo) {
    return muatSkrip("pptx", function () { return typeof akar.PptxGenJS === "function"; }).then(function () {
      var pres = buatPresentasi(akar.PptxGenJS, jenis, lap, logo ? String(logo).replace(/^data:/, "") : null);
      return pres.writeFile({ fileName: namaFile(jenis, lap) + ".pptx" });
    });
  }

  /** Cetak satu lembar: salin lembar ukuran asli ke wadah cetak, atur @page, panggil print. */
  function cetak(jenis, lap, opsi) {
    pasangGaya();
    var wadah = document.getElementById("lap-wadah-cetak");
    if (!wadah) { wadah = document.createElement("div"); wadah.id = "lap-wadah-cetak"; document.body.appendChild(wadah); }
    wadah.innerHTML = jenis === "menteri" ? htmlMenteri(lap, opsi) : htmlA3(lap, opsi);
    var st = document.getElementById("lap-gaya-cetak");
    if (!st) { st = document.createElement("style"); st.id = "lap-gaya-cetak"; document.head.appendChild(st); }
    st.textContent = "#lap-wadah-cetak{display:none}" +
      "@media print{body>*:not(#lap-wadah-cetak){display:none !important}#lap-wadah-cetak{display:block}" +
      "#lap-wadah-cetak .lap-lembar{width:100%;min-height:0;height:auto;padding:10mm 11mm;overflow:visible}" +
      "html,body{background:#FFFFFF !important;margin:0;padding:0}" +
      "*{-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "@page{size:" + (jenis === "menteri" ? "13.333in 7.5in" : "A3 portrait") + ";margin:0}}";
    setTimeout(function () { akar.print(); }, 50);
  }

  /** Muat gambar jadi data URL (logo untuk PPTX). */
  function keDataURL(url) {
    if (!url || /^data:/.test(url)) return Promise.resolve(url || null);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); }).then(function (b) {
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { ok(null); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }

  akar.LaporanDokumen = {
    KONVERSI: KONVERSI, BULAN: BULAN,
    nf: nf, pct: pct, miliar: miliar, miliarBulat: miliarBulat, tanggalPanjang: tanggalPanjang, jamWIB: jamWIB, esc: esc,
    hitungAnggaran: hitungAnggaran, unitUrut: unitUrut, barisKomoditas: barisKomoditas, barisUnit: barisUnit, kartu: kartu, teksSumber: teksSumber,
    pasangGaya: pasangGaya, htmlA3: htmlA3, htmlMenteri: htmlMenteri,
    unduhPNG: unduhPNG, unduhPPTX: unduhPPTX, buatPresentasi: buatPresentasi, cetak: cetak, keDataURL: keDataURL
  };
})(typeof window !== "undefined" ? window : this);
