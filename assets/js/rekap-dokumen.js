/* Unduhan menu Bantuan — PDF A4 lanskap (jsPDF + autotable dari CDN) dan Excel (SheetJS dari CDN), DESIGN §7.
   Angka dari rekap.json yang sama dengan layar, diolah window.RekapInti. Pustaka dimuat saat tombol ditekan.
   PDF: kop Kementerian Pertanian RI, judul dan tanggal data, tabel; "Halaman X dari Y" dan sumber di kaki tiap halaman;
   catatan data di halaman terakhir. Format Bencana (pagu dan terbayar non bencana/bencana) hanya untuk nasional dan
   provinsi terdampak (rekap.json provinsi_bencana).
   Dua jenis rekap (19 Nov 2026): j.jenis "banper" (rekap.json, sheet 7) atau "semua" (rekap-semua.json, sheet 17);
   Semua akun memakai "Realisasi SP2D", baris kelompok, baris tanpa lokus, dan tabel per jenis belanja. */
(function () {
  "use strict";

  var CDN = {
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  };
  /* warna dokumen cetak = token terang DESIGN §2.1 (--report, --ink, --ink-3, --line, --surface-muted) */
  var W = { report: [31, 58, 104], ink: [27, 42, 32], ink3: [85, 98, 90], garis: [221, 226, 216], muted: [244, 245, 241] };
  var janji = {};

  function muatSkrip(src) {
    if (janji[src]) return janji[src];
    janji[src] = new Promise(function (ok, gagal) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ok;
      s.onerror = function () { delete janji[src]; gagal(new Error("Pustaka unduhan gagal dimuat")); };
      document.head.appendChild(s);
    });
    return janji[src];
  }
  function muatPDF() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return Promise.resolve(window.jspdf.jsPDF);
    return muatSkrip(CDN.jspdf).then(function () { return muatSkrip(CDN.autotable); }).then(function () { return window.jspdf.jsPDF; });
  }
  function muatXLSX() { return window.XLSX ? Promise.resolve(window.XLSX) : muatSkrip(CDN.xlsx).then(function () { return window.XLSX; }); }

  function nf(v, d) { return new Intl.NumberFormat("id-ID", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(v); }
  function angka(v) { return v ? nf(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) : "–"; }
  /* rupiah murni: rupiah utuh bertitik ribuan tanpa singkatan (keputusan pemilik portal 18 Nov 2026), satuan "(Rp)" di kepala kolom */
  function rupiah(v) { return v ? (v < 0 ? "−" : "") + nf(Math.abs(Math.round(v))) : "–"; }
  function persen(a, b) { return b > 0 ? nf(a / b * 100, 1) + "%" : "–"; }
  function sd(v) { return v === "REGULER" ? "Reguler" : v === "ABT" ? "ABT" : "–"; }
  function fisikPersen(x) { return x.satuan === "Hektar" && x.grup <= 1 ? persen(x.realisasi, x.target) : "–"; }
  function tglTeks(iso) { return iso ? Monev.format.tanggal(iso) : "–"; }

  var CATATAN = [
    "Sumber: sheet 7_Gabungan_Anggaran_Fisik hasil integrasi SAKTI (anggaran), FA16 Segmen (SP2D), RAW SAT 3 (target fisik), dan Hilirisasi (luas tanam desa); diolah Setditjenbun.",
    "BANPER = bantuan pemerintah kepada masyarakat, akun 526. Anggaran terbayar = SP2D akun 526; Produksi Benih dan KBD Tebu tidak dimasukkan. Outstanding kontrak tidak termasuk.",
    "Anggaran di semua tingkat mengikuti RAW SAKTI; kode provinsi dan kabupaten mengikuti Master Lokus.",
    "Reguler dan ABT selalu baris terpisah. ABT belum punya realisasi fisik di Hilirisasi.",
    "Realisasi fisik = luas tanam desa (Hilirisasi) diagregasi ke kabupaten; luas HOK tidak dihitung. Target dan realisasi fisik mengikuti akun 526115.",
    "Jumlah fisik hanya menjumlah baris kawasan (hektar).",
    "Bencana = sumber dana ABT, serta kegiatan reguler di kabupaten terdampak bencana (Aceh, Sumatera Utara, Sumatera Barat). Rincian bencana hanya untuk nasional dan provinsi terdampak.",
    "Baris yang lokusnya tingkat provinsi (tanpa kabupaten) tampil sebagai \"Tingkat provinsi\"."
  ];
  var CATATAN_SEMUA = [
    "Sumber: sheet 17_Gabungan_Semua_Akun hasil integrasi SAKTI (anggaran semua akun), FA16 Segmen (SP2D), RAW SAT 3 (target fisik), dan Hilirisasi (luas tanam desa); diolah Setditjenbun.",
    "Semua akun = seluruh pagu dan realisasi SP2D Ditjenbun per lokus, semua akun belanja (51 pegawai, 52 barang, 53 modal). Ukuran anggaran = realisasi SP2D; outstanding kontrak tidak termasuk.",
    "Pagu mengikuti RAW SAKTI dan SP2D mengikuti FA16 pada tanggal proses integrasi, sehingga bisa berbeda dengan menu Anggaran (FA16 dan MyIntress harian).",
    "Anggaran tanpa lokus provinsi/kabupaten (terutama pengadaan benih produksi kegiatan 5890 dan belanja pegawai/operasional) tetap dihitung di baris kegiatannya, tetapi tidak masuk tabel provinsi mana pun.",
    "Baris kawasan dan pendukung memakai label yang sama dengan BANPER, dipecah menjadi bagian akun 526 dan akun lain; kegiatan lain per RO.",
    "Reguler dan ABT selalu baris terpisah. Fisik hanya ada di baris pembawa fisik (akun 526115) dan sama dengan BANPER; jumlah fisik hanya menjumlah baris kawasan (hektar).",
    "Bencana = sumber dana ABT, serta kegiatan reguler di kabupaten terdampak bencana. Rincian bencana hanya untuk nasional dan provinsi terdampak.",
    "Baris yang lokusnya tingkat provinsi (tanpa kabupaten) tampil sebagai \"Tingkat provinsi\"."
  ];
  function sm(j) { return window.RekapInti.semuaAkun(j); }
  function catatanDari(j) { return sm(j) ? CATATAN_SEMUA : CATATAN; }
  function kataBayar(j) { return sm(j) ? "Realisasi SP2D" : "Terbayar"; }

  /* ================= PDF ================= */
  function kepalaTabel(lingkup, bencana, j) {
    var b = kataBayar(j);
    var h1 = ["No", sm(j) ? "Kegiatan / RO" : "Kegiatan / sub-komponen", "Sumber dana"].concat(lingkup === "nasional" ? ["Prov"] : []).concat(["Kab/kota", "Volume", "Satuan", "Realisasi fisik", "% fisik",
      "Pagu (Rp)", b + " (Rp)", "% " + b.toLowerCase()]);
    if (bencana) h1 = h1.concat(["Pagu non bencana (Rp)", "Pagu bencana (Rp)", b + " non bencana (Rp)", b + " bencana (Rp)"]);
    return [h1];
  }
  function selBaris(x, lingkup, bencana, no, label) {
    var r = [no, label || x.kegiatan, sd(x.sumber_dana)].concat(lingkup === "nasional" ? [x.jml_prov != null ? nf(x.jml_prov) : ""] : [])
      .concat([x.jml_kab != null ? nf(x.jml_kab) : "", angka(x.target), x.satuan === "Hektar" ? "ha" : String(x.satuan || "").toLowerCase(), angka(x.realisasi), fisikPersen(x),
        rupiah(x.pagu), rupiah(x.terbayar), persen(x.terbayar, x.pagu)]);
    if (bencana) r = r.concat([rupiah(x.pagu - x.pagu_b), rupiah(x.pagu_b), rupiah(x.terbayar - x.terbayar_b), rupiah(x.terbayar_b)]);
    return r;
  }
  function badanTabel(rows, lingkup, bencana, kabDari, j) {
    var R = window.RekapInti, keg = R.perKegiatan(rows), t = R.jumlah(keg, rows), body = [], semua = sm(j), grupLalu = null;
    keg.forEach(function (x, i) {
      if (semua && x.grup !== grupLalu) {   /* Semua akun: baris kelompok berisi subtotal */
        grupLalu = x.grup;
        var kg = keg.filter(function (y) { return y.grup === x.grup; }), tg = R.jumlah(kg, rows.filter(function (r) { return r.grup === x.grup; }));
        tg.satuan = "Hektar"; tg.grup = x.grup; tg.sumber_dana = null;
        var sg = selBaris(tg, lingkup, bencana, "", R.namaGrup(j, x.grup).toUpperCase()); sg[2] = "";
        body.push({ jenis: "induk", sel: sg });
      }
      body.push({ jenis: semua ? "item" : "induk", sel: selBaris(x, lingkup, bencana, String(i + 1)) });
      x.sub.forEach(function (s) {
        s.satuan = x.satuan; s.grup = x.grup; s.sumber_dana = x.sumber_dana;
        body.push({ jenis: "sub", sel: selBaris(s, lingkup, bencana, "", "   · " + s.nama) });
      });
      if (kabDari) kabDari.filter(function (k) { return k.kegiatan === x.kegiatan && k.grup === x.grup; })
        .sort(function (a, b) { return b.pagu - a.pagu || b.target - a.target || (a.kabupaten < b.kabupaten ? -1 : 1); })
        .forEach(function (k) { k.satuan = x.satuan; body.push({ jenis: "kab", sel: selBaris(k, lingkup, bencana, "", "      " + k.kabupaten) }); });
    });
    t.satuan = "Hektar"; t.grup = 0; t.kegiatan = lingkup === "nasional" ? "JUMLAH NASIONAL" : "JUMLAH PROVINSI"; t.sumber_dana = null;
    var tr = selBaris(t, lingkup, bencana, "");
    tr[lingkup === "nasional" ? 6 : 5] = "ha (kawasan)";
    body.push({ jenis: "jumlah", sel: tr });
    if (semua && lingkup === "nasional") {
      var k = R.kartu(rows);
      if (k.pagu_tl || k.terbayar_tl) {
        var tl = Object.assign({}, t, { kegiatan: "   di antaranya tanpa lokus (tidak masuk provinsi mana pun)", target: 0, realisasi: 0, pagu: k.pagu_tl, terbayar: k.terbayar_tl, pagu_b: 0, terbayar_b: 0, jml_prov: null, jml_kab: null });
        var sl = selBaris(tl, lingkup, bencana, ""); sl[2] = "";
        if (bencana) { var n = sl.length; sl[n - 4] = ""; sl[n - 3] = ""; sl[n - 2] = ""; sl[n - 1] = ""; }
        body.push({ jenis: "sub", sel: sl });
      }
    }
    return body;
  }
  /** Tabel per jenis belanja (Semua akun, PDF nasional). */
  function badanBelanja(rows) {
    var R = window.RekapInti, body = [], T = { pagu: 0, terbayar: 0, pagu_tl: 0 };
    R.perJenisBelanja(rows).forEach(function (x, i) {
      T.pagu += x.pagu; T.terbayar += x.terbayar; T.pagu_tl += x.pagu_tl;
      body.push({ jenis: "induk", sel: [String(i + 1), x.akun === "-" ? x.nama : x.akun + " " + x.nama, rupiah(x.pagu), rupiah(x.terbayar), persen(x.terbayar, x.pagu), rupiah(x.pagu_tl)] });
      x.sub.forEach(function (y) { body.push({ jenis: "sub", sel: ["", "   di antaranya " + y.akun + " " + y.nama, rupiah(y.pagu), rupiah(y.terbayar), persen(y.terbayar, y.pagu), rupiah(y.pagu_tl)] }); });
    });
    body.push({ jenis: "jumlah", sel: ["", "JUMLAH", rupiah(T.pagu), rupiah(T.terbayar), persen(T.terbayar, T.pagu), rupiah(T.pagu_tl)] });
    return body;
  }

  function buatDokumen(jsPDF, j) {
    var doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica");
    doc._monevDicetak = Monev.format.waktu(new Date());
    doc._monevHalamanAwal = true;
    return doc;
  }
  function kop(doc) {
    doc.setTextColor.apply(doc, W.report); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("KEMENTERIAN PERTANIAN RI", 12, 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Direktorat Jenderal Perkebunan", 12, 17);
    doc.setTextColor.apply(doc, W.ink3); doc.setFontSize(8.5);
    doc.text("Dicetak " + doc._monevDicetak + " dari Monev Ditjenbun", 285, 12, { align: "right" });
    doc.setDrawColor.apply(doc, W.report); doc.setLineWidth(0.5); doc.line(12, 20, 285, 20);
  }
  function judul(doc, a, b) {
    if (!doc._monevHalamanAwal) doc.addPage(); doc._monevHalamanAwal = false;
    kop(doc);
    doc.setTextColor.apply(doc, W.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(a, 148.5, 29, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor.apply(doc, W.ink3); doc.text(b, 148.5, 35, { align: "center" });
  }
  function tabel(doc, head, body, startY, angkaMulai) {
    angkaMulai = angkaMulai || 3;
    var awal = doc.internal.getCurrentPageInfo().pageNumber;
    /* Lebar kolom dihitung dari isinya: setiap kolom angka/teks pendek selebar isi terpanjang (tidak terpotong baris; kepala kolom
       boleh terpotong pada spasi), huruf sebesar mungkin (≤ 10 pt) selama tabel muat 273 mm, sisa lebar untuk kolom kegiatan
       (sampai muat satu baris), lalu dibagi rata ke semua kolom. */
    var LEBAR = 273, PAD = 1.3, MAKS = 10, MIN = 6, KEG_MIN = 45;
    function ukur(t, f) { return doc.getStringUnitWidth(String(t)) * f * 25.4 / 72; }
    function alami(f) {
      doc.setFont("helvetica", "bold");   /* ukur dengan huruf tebal (baris induk dan jumlah) supaya pasti muat */
      return head[0].map(function (h, c) {
        var w = 0;
        String(h).split(/\s+/).forEach(function (kata) { w = Math.max(w, ukur(kata, f)); });
        body.forEach(function (x) { w = Math.max(w, ukur(x.sel[c], f)); });
        return w + 2 * PAD + 0.4;
      });
    }
    var huruf = MAKS, w = alami(huruf);
    function sisaKeg(w) { return LEBAR - w.reduce(function (a, v, c) { return c === 1 ? a : a + v; }, 0); }
    while (huruf > MIN && sisaKeg(w) < Math.min(KEG_MIN, w[1])) { huruf = Math.round((huruf - 0.2) * 10) / 10; w = alami(huruf); }
    doc.setFont("helvetica", "normal");
    var kegLebar = Math.min(w[1], sisaKeg(w)), lebih = (sisaKeg(w) - kegLebar) / w.length, kol = {};
    w.forEach(function (v, c) { kol[c] = { cellWidth: (c === 1 ? kegLebar : v) + lebih }; });
    kol[0].halign = "center";
    doc.autoTable({
      head: head, body: body.map(function (b) { return b.sel; }), startY: startY || 40, margin: { top: 26, left: 12, right: 12, bottom: 16 },
      theme: "grid", styles: { font: "helvetica", fontSize: huruf, cellPadding: PAD, textColor: W.ink, lineColor: W.garis, lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: W.report, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: huruf },
      columnStyles: kol,
      didParseCell: function (d) {
        if (d.section !== "body") { return; }
        var b = body[d.row.index];
        if (d.column.index >= angkaMulai) d.cell.styles.halign = "right";
        if (d.column.index === 2 && angkaMulai === 3) d.cell.styles.halign = "center";
        if (b.jenis === "jumlah") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = W.muted; }
        if (b.jenis === "induk") d.cell.styles.fontStyle = "bold";
        if (b.jenis === "kab" || b.jenis === "sub") { d.cell.styles.textColor = W.ink3; d.cell.styles.fontSize = huruf - 0.5; }
      },
      didDrawPage: function () { if (doc.internal.getCurrentPageInfo().pageNumber > awal) kop(doc); }   /* halaman lanjutan tabel */
    });
  }
  function catatanAkhir(doc, j, tambahan) {
    var y = doc.lastAutoTable.finalY + 8;
    if (y > 160) { doc.addPage(); kop(doc); y = 30; }
    doc.setTextColor.apply(doc, W.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Catatan data", 12, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor.apply(doc, W.ink3);
    catatanDari(j).concat(tambahan || []).forEach(function (c) {
      var baris = doc.splitTextToSize("• " + c, 270);
      y += 4.6; if (y + baris.length * 3.8 > 196) { doc.addPage(); kop(doc); y = 30; }
      doc.text(baris, 12, y); y += (baris.length - 1) * 3.8;
    });
  }
  function kaki(doc) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor.apply(doc, W.ink3);
      doc.text("Sumber: hasil integrasi SAKTI, FA16 Segmen, SAT 3, dan Hilirisasi · diolah Setditjenbun", 12, 203);
      doc.text("Halaman " + i + " dari " + n, 285, 203, { align: "right" });
    }
  }
  function namaSumber(s) { return s.sumber === "REGULER" ? "reguler" : s.sumber === "ABT" ? "ABT" : "reguler dan ABT"; }
  function subjudul(j, s) {
    return "Data per " + tglTeks(j.data_per) + " · " + (sm(j) ? "semua akun · " : "BANPER (akun 526) · ") + namaSumber(s) + (s.komoditas ? " · komoditas " + s.komoditas.toLowerCase() : "") +
      (s.kegiatan ? " · kegiatan " + Monev.istilah.kegiatanSingkat(s.kegiatan).toLowerCase() + " (" + s.kegiatan + ")" : "");
  }
  function saringDok(j, s) { var R = window.RekapInti; return R.saring(R.baca(j), { sumber: s.sumber, komoditas: s.komoditas, kegiatan: s.kegiatan }); }

  /** jenis: "nasional" (nasional + satu tabel per provinsi), "provinsi" (satu provinsi + kabupaten), "semua" (semua provinsi + kabupaten) */
  function unduhPDF(jenis, j, s) {
    s = s || {};
    return muatPDF().then(function (jsPDF) {
      var R = window.RekapInti, semua = saringDok(j, s);
      var bencanaProv = j.provinsi_bencana || [], doc = buatDokumen(jsPDF, j), ta = j.ta || "";
      var JUDUL = sm(j) ? "REKAP ANGGARAN DAN FISIK SEMUA AKUN" : "REKAP BANTUAN PEMERINTAH (BANPER) PERKEBUNAN";
      var prov = R.daftarProvinsi(semua).map(function (p) { return p.nama; });
      function satuProvinsi(nama, denganKab) {
        var rows = R.saring(semua, { provinsi: nama }), ben = bencanaProv.indexOf(nama) >= 0;
        judul(doc, JUDUL + " DI PROVINSI " + nama + " TA " + ta, subjudul(j, s));
        tabel(doc, kepalaTabel("provinsi", ben, j), badanTabel(rows, "provinsi", ben, denganKab ? R.perKabupaten(rows, nama) : null, j));
      }
      if (jenis === "nasional") {
        judul(doc, JUDUL + " NASIONAL TA " + ta, subjudul(j, s));
        tabel(doc, kepalaTabel("nasional", true, j), badanTabel(semua, "nasional", true, null, j));
        if (sm(j)) {
          judul(doc, "REKAP NASIONAL PER JENIS BELANJA TA " + ta, subjudul(j, s));
          tabel(doc, [["No", "Jenis belanja (akun)", "Pagu (Rp)", "Realisasi SP2D (Rp)", "% SP2D", "Tanpa lokus (Rp)"]], badanBelanja(semua), null, 2);
        }
        prov.forEach(function (p) { satuProvinsi(p, false); });
      } else if (jenis === "provinsi") {
        satuProvinsi(s.provinsi, true);
      } else {
        prov.forEach(function (p) { satuProvinsi(p, true); });
      }
      catatanAkhir(doc, j);
      kaki(doc);
      var nama = jenis === "nasional" ? "Nasional" : jenis === "provinsi" ? R.namaProvinsi(s.provinsi) : "Semua provinsi";
      doc.save((sm(j) ? "Rekap Semua Akun Ditjenbun " : "Rekap Bantuan Ditjenbun ") + ta + " - " + nama + " - " + String(j.data_per || "").slice(0, 10) + ".pdf");
    });
  }

  /* ================= EXCEL ================= */
  function simpanXlsx(X, wb, nama) {
    var data = new Uint8Array(X.write(wb, { type: "array", bookType: "xlsx" }));
    try {   /* SheetJS komunitas tidak menulis panel beku; baris judul dibekukan lewat XML tiap sheet (DESIGN §7) */
      var zip = X.CFB.read(data, { type: "buffer" });
      var beku = '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>';
      zip.FullPaths.forEach(function (p, i) {
        if (!/\/xl\/worksheets\/sheet\d+\.xml$/.test(p)) return;
        var xml = new TextDecoder().decode(zip.FileIndex[i].content);
        zip.FileIndex[i].content = new TextEncoder().encode(xml.replace('<sheetView workbookViewId="0"/>', beku));
      });
      data = X.CFB.write(zip, { fileType: "zip", type: "array" });
    } catch (er) { /* simpan tanpa panel beku */ }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = nama; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function kolomHuruf(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  /**
   * Lembar dengan kolom teks lalu angka. spek: [{judul, nilai(x), jenis: "s"|"n"|"pct"|"f", rumus(b,K)}]
   * Baris jumlah: SUM untuk kolom "jumlah: true", SUMIF kawasan untuk "fisik: true", rumus persen diulang.
   */
  function lembar(X, spek, data, jumlahLabel) {
    var RP = "#,##0", HA = "#,##0.00", PC = "0.0%";
    var K = {}; spek.forEach(function (c, i) { K[c.kunci || ("k" + i)] = kolomHuruf(i); });
    var aoa = [spek.map(function (c) { return { t: "s", v: c.judul }; })];
    var akhir = data.length + 1, bj = data.length + 2;
    function sel(c, x, b) {
      if (c.rumus) { var v = c.nilai(x); return { t: "n", f: c.rumus(b, K), v: isFinite(v) ? v : 0, z: c.z || PC }; }
      var v2 = c.nilai(x);
      if (c.jenis === "n") return { t: "n", v: v2 || 0, z: c.z || RP };
      return { t: "s", v: v2 == null ? "" : String(v2) };
    }
    data.forEach(function (x, i) { aoa.push(spek.map(function (c) { return sel(c, x, i + 2); })); });
    if (jumlahLabel) {
      aoa.push(spek.map(function (c, i) {
        var h = kolomHuruf(i);
        if (i === 0) return { t: "s", v: jumlahLabel };
        if (c.jumlah) return { t: "n", f: "SUM(" + h + "2:" + h + akhir + ")", v: c.total || 0, z: c.z || RP };
        if (c.fisik) return { t: "n", f: 'SUMIF(' + K.grup + "2:" + K.grup + akhir + ',"Kawasan*",' + h + "2:" + h + akhir + ")", v: c.total || 0, z: HA };
        if (c.rumus && c.diJumlah) return { t: "n", f: c.rumus(bj, K), v: c.total || 0, z: c.z || PC };
        return { t: "s", v: "" };
      }));
    }
    var ws = X.utils.aoa_to_sheet(aoa);
    ws["!cols"] = spek.map(function (c) { return { wch: c.lebar || 14 }; });
    return ws;
  }

  /** satuProvinsi: hanya s.provinsi (sheet Provinsi, Per Kabupaten, Catatan Data), data sama dengan PDF provinsi ini */
  function unduhExcel(j, s, satuProvinsi) {
    s = s || {};
    return muatXLSX().then(function (X) {
      var R = window.RekapInti, semua = saringDok(j, s), B = kataBayar(j), KEG = sm(j) ? "Kegiatan/RO" : "Kegiatan/Bantuan";
      var HA = "#,##0.00", bagi = function (a, b) { return b ? a / b : 0; };
      var grupNama = function (x) { return R.namaGrup(j, x.grup); };
      var pctF = function (a, b) { return function (r, K) { return "IF(" + K[b] + r + "=0,0," + K[a] + r + "/" + K[b] + r + ")"; }; };
      function kolomAngka(T) {
        return [
          { judul: "Target", kunci: "tg", jenis: "n", z: HA, nilai: function (x) { return x.target; }, fisik: true, total: T.target, lebar: 14 },
          { judul: "Realisasi fisik", kunci: "rf", jenis: "n", z: HA, nilai: function (x) { return x.realisasi; }, fisik: true, total: T.realisasi, lebar: 14 },
          { judul: "% fisik", rumus: pctF("rf", "tg"), nilai: function (x) { return bagi(x.realisasi, x.target); }, diJumlah: true, total: bagi(T.realisasi, T.target), lebar: 9 },
          { judul: "Pagu (Rp)", kunci: "pg", jenis: "n", nilai: function (x) { return x.pagu; }, jumlah: true, total: T.pagu, lebar: 18 },
          { judul: B + " (Rp)", kunci: "tb", jenis: "n", nilai: function (x) { return x.terbayar; }, jumlah: true, total: T.terbayar, lebar: 18 },
          { judul: "% " + B.toLowerCase(), rumus: pctF("tb", "pg"), nilai: function (x) { return bagi(x.terbayar, x.pagu); }, diJumlah: true, total: bagi(T.terbayar, T.pagu), lebar: 10 },
          { judul: "Pagu bencana (Rp)", kunci: "pb", jenis: "n", nilai: function (x) { return x.pagu_b; }, jumlah: true, total: T.pagu_b, lebar: 18 },
          { judul: "Pagu non bencana (Rp)", rumus: function (r, K) { return K.pg + r + "-" + K.pb + r; }, z: "#,##0", nilai: function (x) { return x.pagu - x.pagu_b; }, diJumlah: true, total: T.pagu - T.pagu_b, lebar: 18 },
          { judul: B + " bencana (Rp)", kunci: "bb", jenis: "n", nilai: function (x) { return x.terbayar_b; }, jumlah: true, total: T.terbayar_b, lebar: 18 },
          { judul: B + " non bencana (Rp)", rumus: function (r, K) { return K.tb + r + "-" + K.bb + r; }, z: "#,##0", nilai: function (x) { return x.terbayar - x.terbayar_b; }, diJumlah: true, total: T.terbayar - T.terbayar_b, lebar: 18 }
        ];
      }
      var sumberNama = function (x) { return sd(x.sumber_dana); };
      var satuanNama = function (x) { return x.satuan; };

      if (satuProvinsi) {
        if (!s.provinsi) return Promise.reject(new Error("Belum ada provinsi yang dipilih"));
        semua = R.saring(semua, { provinsi: s.provinsi });
      }
      var keg = R.perKegiatan(semua), T = R.jumlah(keg, semua);
      var wsNas = lembar(X, [
        { judul: KEG, nilai: function (x) { return x.kegiatan; }, lebar: 52 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 },
        { judul: "Jumlah provinsi", jenis: "n", nilai: function (x) { return x.jml_prov; }, lebar: 9 },
        { judul: "Jumlah kab/kota", jenis: "n", nilai: function (x) { return x.jml_kab; }, lebar: 9 }
      ].concat(kolomAngka(T)), keg, "Jumlah nasional");

      var wsProvSatu = satuProvinsi ? lembar(X, [
        { judul: KEG, nilai: function (x) { return x.kegiatan; }, lebar: 52 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 },
        { judul: "Jumlah kab/kota", jenis: "n", nilai: function (x) { return x.jml_kab; }, lebar: 9 }
      ].concat(kolomAngka(T)), keg, "Jumlah provinsi") : null;

      var rowsProv = [];
      R.daftarProvinsi(semua).forEach(function (p) {
        R.perKegiatan(R.saring(semua, { provinsi: p.nama })).forEach(function (x) { x.provinsi = p.nama; rowsProv.push(x); });
      });
      var TP = R.jumlah(rowsProv, []);
      var wsProv = lembar(X, [
        { judul: "Provinsi", nilai: function (x) { return x.provinsi; }, lebar: 26 },
        { judul: KEG, nilai: function (x) { return x.kegiatan; }, lebar: 46 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 },
        { judul: "Jumlah kab/kota", jenis: "n", nilai: function (x) { return x.jml_kab; }, lebar: 9 }
      ].concat(kolomAngka(TP)), rowsProv, "Jumlah");

      var rowsKab = [];
      R.daftarProvinsi(semua).forEach(function (p) {
        R.perKabupaten(semua, p.nama).sort(function (a, b) { return a.grup - b.grup || (a.kegiatan < b.kegiatan ? -1 : a.kegiatan > b.kegiatan ? 1 : 0) || b.pagu - a.pagu; })
          .forEach(function (x) { x.provinsi = p.nama; rowsKab.push(x); });
      });
      var TK = R.jumlah(rowsKab, []);
      var wsKab = lembar(X, [
        { judul: "Provinsi", nilai: function (x) { return x.provinsi; }, lebar: 26 },
        { judul: "Kabupaten/kota", nilai: function (x) { return x.kabupaten; }, lebar: 28 },
        { judul: KEG, nilai: function (x) { return x.kegiatan; }, lebar: 46 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 }
      ].concat(kolomAngka(TK)), rowsKab, "Jumlah");

      var cat = [[(sm(j) ? "Rekap anggaran dan fisik semua akun " : "Rekap bantuan pemerintah (BANPER) perkebunan ") + (satuProvinsi ? "Provinsi " + R.namaProvinsi(s.provinsi) + " " : "") + "TA " + (j.ta || "")],
        [subjudul(j, s)],
        ["Diunduh " + Monev.format.waktu(new Date()) + " dari Monev Ditjenbun"], [""]]
        .concat(catatanDari(j).map(function (c) { return [c]; }))
        .concat([[""], ["Persentase dan jumlah memakai rumus. Jumlah fisik menjumlah baris kelompok Kawasan dan Kawasan ABT saja (SUMIF)."]]);
      var wsCat = X.utils.aoa_to_sheet(cat); wsCat["!cols"] = [{ wch: 140 }];

      var wb = X.utils.book_new();
      if (satuProvinsi) X.utils.book_append_sheet(wb, wsProvSatu, "Provinsi");
      else {
        X.utils.book_append_sheet(wb, wsNas, "Nasional");
        if (sm(j)) {
          var bel = [];
          R.perJenisBelanja(semua).forEach(function (x) { bel.push(x); x.sub.forEach(function (y) { bel.push(Object.assign({}, y, { anak: true })); }); });
          var TB = { pagu: 0, terbayar: 0, pagu_tl: 0, terbayar_tl: 0 };
          bel.forEach(function (x) { if (!x.anak) { TB.pagu += x.pagu; TB.terbayar += x.terbayar; TB.pagu_tl += x.pagu_tl; TB.terbayar_tl += x.terbayar_tl; } });
          var wsBel = lembar(X, [
            { judul: "Akun", nilai: function (x) { return x.akun; }, lebar: 9 },
            { judul: "Jenis belanja", nilai: function (x) { return (x.anak ? "di antaranya " : "") + x.nama; }, lebar: 56 },
            { judul: "Pagu (Rp)", kunci: "pg", jenis: "n", nilai: function (x) { return x.anak ? 0 : x.pagu; }, jumlah: true, total: TB.pagu, lebar: 18 },
            { judul: "Realisasi SP2D (Rp)", kunci: "tb", jenis: "n", nilai: function (x) { return x.anak ? 0 : x.terbayar; }, jumlah: true, total: TB.terbayar, lebar: 18 },
            { judul: "% SP2D", rumus: pctF("tb", "pg"), nilai: function (x) { return bagi(x.terbayar, x.pagu); }, diJumlah: true, total: bagi(TB.terbayar, TB.pagu), lebar: 9 },
            { judul: "Pagu tanpa lokus (Rp)", jenis: "n", nilai: function (x) { return x.anak ? 0 : x.pagu_tl; }, jumlah: true, total: TB.pagu_tl, lebar: 18 },
            { judul: "SP2D tanpa lokus (Rp)", jenis: "n", nilai: function (x) { return x.anak ? 0 : x.terbayar_tl; }, jumlah: true, total: TB.terbayar_tl, lebar: 18 },
            { judul: "Pagu (rincian, Rp)", jenis: "n", nilai: function (x) { return x.anak ? x.pagu : 0; }, lebar: 18 },
            { judul: "Realisasi SP2D (rincian, Rp)", jenis: "n", nilai: function (x) { return x.anak ? x.terbayar : 0; }, lebar: 18 }
          ], bel, "Jumlah");
          X.utils.book_append_sheet(wb, wsBel, "Per Jenis Belanja");
        }
        X.utils.book_append_sheet(wb, wsProv, "Per Provinsi");
      }
      X.utils.book_append_sheet(wb, wsKab, "Per Kabupaten");
      if (sm(j) && !satuProvinsi) {
        var tlRows = semua.filter(function (r) { return !r.provinsi; }), kegTl = R.perKegiatan(tlRows), TT = R.jumlah(kegTl, tlRows);
        X.utils.book_append_sheet(wb, lembar(X, [
          { judul: KEG, nilai: function (x) { return x.kegiatan; }, lebar: 52 },
          { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
          { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
          { judul: "Satuan", nilai: satuanNama, lebar: 9 }
        ].concat(kolomAngka(TT)), kegTl, "Jumlah tanpa lokus"), "Tanpa Lokus");
      }
      X.utils.book_append_sheet(wb, wsCat, "Catatan Data");
      simpanXlsx(X, wb, (sm(j) ? "Rekap Semua Akun Ditjenbun " : "Rekap Bantuan Ditjenbun ") + (j.ta || "") + " - " + (satuProvinsi ? R.namaProvinsi(s.provinsi) + " - " : "") + String(j.data_per || "").slice(0, 10) + ".xlsx");
    });
  }

  window.RekapDokumen = { unduhPDF: unduhPDF, unduhExcel: unduhExcel,
    unduhExcelProvinsi: function (j, s) { return unduhExcel(j, s, true); }, CATATAN: CATATAN, CATATAN_SEMUA: CATATAN_SEMUA };
})();
