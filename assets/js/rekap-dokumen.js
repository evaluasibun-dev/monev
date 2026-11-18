/* Unduhan menu Bantuan — PDF A4 lanskap (jsPDF + autotable dari CDN) dan Excel (SheetJS dari CDN), DESIGN §7.
   Angka dari rekap.json yang sama dengan layar, diolah window.RekapInti. Pustaka dimuat saat tombol ditekan.
   PDF: kop Kementerian Pertanian RI, judul dan tanggal data, tabel; "Halaman X dari Y" dan sumber di kaki tiap halaman;
   catatan data di halaman terakhir. Format Bencana (pagu dan terbayar non bencana/bencana) hanya untuk nasional dan
   provinsi terdampak (rekap.json provinsi_bencana). */
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
    "Sumber: hasil integrasi SAKTI (anggaran), FA16 Segmen, RAW SAT 3 (target fisik), Hilirisasi (luas tanam desa), dan berkas Produksi Benih; diolah Setditjenbun.",
    "Anggaran terbayar = SP2D akun 526 + realisasi Produksi Benih + KBD Tebu. Outstanding kontrak tidak termasuk. Pagu bantuan dihitung dengan dasar yang sama.",
    "Anggaran di semua tingkat mengikuti RAW SAKTI; kode provinsi dan kabupaten mengikuti Master Lokus.",
    "Reguler dan ABT selalu baris terpisah. ABT belum punya realisasi fisik di Hilirisasi. Baris Produksi Benih dan KBD Tebu belum dipisah per sumber dana.",
    "Realisasi fisik = luas tanam desa (Hilirisasi) diagregasi ke kabupaten; luas HOK tidak dihitung. Target dan realisasi fisik mengikuti akun 526115.",
    "Jumlah fisik hanya menjumlah baris kawasan (hektar). Volume Produksi Benih (batang) dan KBD Tebu tidak dijumlah. Volume KBD Tebu tercatat \"Hektar\" di sumber tetapi bernilai ratusan juta, kemungkinan satuannya mata.",
    "Bencana = sumber dana ABT, serta kegiatan reguler di kabupaten terdampak bencana (Aceh, Sumatera Utara, Sumatera Barat). Rincian bencana hanya untuk nasional dan provinsi terdampak.",
    "Baris yang lokusnya tingkat provinsi (tanpa kabupaten) tampil sebagai \"Tingkat provinsi\"."
  ];

  /* ================= PDF ================= */
  function kepalaTabel(lingkup, bencana) {
    var h1 = ["No", "Kegiatan / sub-komponen", "Sumber dana"].concat(lingkup === "nasional" ? ["Prov"] : []).concat(["Kab/kota", "Volume", "Satuan", "Realisasi fisik", "% fisik",
      "Pagu (Rp)", "Terbayar (Rp)", "% terbayar"]);
    if (bencana) h1 = h1.concat(["Pagu non bencana (Rp)", "Pagu bencana (Rp)", "Terbayar non bencana (Rp)", "Terbayar bencana (Rp)"]);
    return [h1];
  }
  function selBaris(x, lingkup, bencana, no, label) {
    var r = [no, label || x.kegiatan, sd(x.sumber_dana)].concat(lingkup === "nasional" ? [x.jml_prov != null ? nf(x.jml_prov) : ""] : [])
      .concat([x.jml_kab != null ? nf(x.jml_kab) : "", angka(x.target), x.satuan === "Hektar" ? "ha" : String(x.satuan || "").toLowerCase(), angka(x.realisasi), fisikPersen(x),
        rupiah(x.pagu), rupiah(x.terbayar), persen(x.terbayar, x.pagu)]);
    if (bencana) r = r.concat([rupiah(x.pagu - x.pagu_b), rupiah(x.pagu_b), rupiah(x.terbayar - x.terbayar_b), rupiah(x.terbayar_b)]);
    return r;
  }
  function badanTabel(rows, lingkup, bencana, kabDari) {
    var R = window.RekapInti, keg = R.perKegiatan(rows), t = R.jumlah(keg, rows), body = [];
    keg.forEach(function (x, i) {
      body.push({ jenis: "induk", sel: selBaris(x, lingkup, bencana, String(i + 1)) });
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
  function tabel(doc, head, body, startY) {
    var angkaMulai = 3, awal = doc.internal.getCurrentPageInfo().pageNumber;
    /* kolom rupiah murni tidak boleh terpotong baris: lebar "wrap"; tabel berkolom bencana memakai huruf lebih kecil supaya muat A4 lanskap */
    var lebar = head[0].length > 13, huruf = lebar ? 6.4 : 7.2, kol = { 0: { halign: "center", cellWidth: 7 }, 1: { cellWidth: lebar ? 44 : 58 } };
    head[0].forEach(function (h, i) {   /* lebar tetap = angka terpanjang di kolom itu; kepala kolom boleh terpotong baris */
      if (!/\(Rp\)$/.test(h)) return;
      var mm = 0;
      doc.setFont("helvetica", "bold");   /* ukur dengan huruf tebal (baris jumlah) supaya pasti muat */
      body.forEach(function (x) { mm = Math.max(mm, doc.getStringUnitWidth(String(x.sel[i])) * huruf * 25.4 / 72); });
      kol[i] = { cellWidth: Math.max(14, mm + 2 * 1.2 + 0.6) };
    });
    doc.setFont("helvetica", "normal");
    doc.autoTable({
      head: head, body: body.map(function (b) { return b.sel; }), startY: startY || 40, margin: { top: 26, left: 12, right: 12, bottom: 16 },
      theme: "grid", styles: { font: "helvetica", fontSize: huruf, cellPadding: 1.2, textColor: W.ink, lineColor: W.garis, lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: W.report, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: huruf },
      columnStyles: kol,
      didParseCell: function (d) {
        if (d.section !== "body") { return; }
        var b = body[d.row.index];
        if (d.column.index >= angkaMulai) d.cell.styles.halign = "right";
        if (d.column.index === 2) d.cell.styles.halign = "center";
        if (b.jenis === "jumlah") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = W.muted; }
        if (b.jenis === "induk") d.cell.styles.fontStyle = "bold";
        if (b.jenis === "kab" || b.jenis === "sub") { d.cell.styles.textColor = W.ink3; d.cell.styles.fontSize = huruf - 0.4; }
      },
      didDrawPage: function () { if (doc.internal.getCurrentPageInfo().pageNumber > awal) kop(doc); }   /* halaman lanjutan tabel */
    });
  }
  function catatanAkhir(doc, j, tambahan) {
    var y = doc.lastAutoTable.finalY + 8;
    if (y > 160) { doc.addPage(); kop(doc); y = 30; }
    doc.setTextColor.apply(doc, W.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Catatan data", 12, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor.apply(doc, W.ink3);
    CATATAN.concat(tambahan || []).forEach(function (c) {
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
    return "Data per " + tglTeks(j.data_per) + " · " + namaSumber(s) + (s.komoditas ? " · komoditas " + s.komoditas.toLowerCase() : "");
  }

  /** jenis: "nasional" (nasional + satu tabel per provinsi), "provinsi" (satu provinsi + kabupaten), "semua" (semua provinsi + kabupaten) */
  function unduhPDF(jenis, j, s) {
    s = s || {};
    return muatPDF().then(function (jsPDF) {
      var R = window.RekapInti, semua = R.saring(R.baca(j), { sumber: s.sumber, komoditas: s.komoditas });
      var bencanaProv = j.provinsi_bencana || [], doc = buatDokumen(jsPDF, j), ta = j.ta || "";
      var prov = R.daftarProvinsi(semua).map(function (p) { return p.nama; });
      function satuProvinsi(nama, denganKab) {
        var rows = R.saring(semua, { provinsi: nama }), ben = bencanaProv.indexOf(nama) >= 0;
        judul(doc, "REKAP BANTUAN PERKEBUNAN DI PROVINSI " + nama + " TA " + ta, subjudul(j, s));
        tabel(doc, kepalaTabel("provinsi", ben), badanTabel(rows, "provinsi", ben, denganKab ? R.perKabupaten(rows, nama) : null));
      }
      if (jenis === "nasional") {
        judul(doc, "REKAP NASIONAL BANTUAN PERKEBUNAN TA " + ta, subjudul(j, s));
        tabel(doc, kepalaTabel("nasional", true), badanTabel(semua, "nasional", true));
        prov.forEach(function (p) { satuProvinsi(p, false); });
      } else if (jenis === "provinsi") {
        satuProvinsi(s.provinsi, true);
      } else {
        prov.forEach(function (p) { satuProvinsi(p, true); });
      }
      catatanAkhir(doc, j);
      kaki(doc);
      var nama = jenis === "nasional" ? "Nasional" : jenis === "provinsi" ? R.namaProvinsi(s.provinsi) : "Semua provinsi";
      doc.save("Rekap Bantuan Ditjenbun " + ta + " - " + nama + " - " + String(j.data_per || "").slice(0, 10) + ".pdf");
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
      var R = window.RekapInti, semua = R.saring(R.baca(j), { sumber: s.sumber, komoditas: s.komoditas });
      var HA = "#,##0.00", bagi = function (a, b) { return b ? a / b : 0; };
      var grupNama = function (x) { return R.NAMA_GRUP[x.grup]; };
      var pctF = function (a, b) { return function (r, K) { return "IF(" + K[b] + r + "=0,0," + K[a] + r + "/" + K[b] + r + ")"; }; };
      function kolomAngka(T) {
        return [
          { judul: "Target", kunci: "tg", jenis: "n", z: HA, nilai: function (x) { return x.target; }, fisik: true, total: T.target, lebar: 14 },
          { judul: "Realisasi fisik", kunci: "rf", jenis: "n", z: HA, nilai: function (x) { return x.realisasi; }, fisik: true, total: T.realisasi, lebar: 14 },
          { judul: "% fisik", rumus: pctF("rf", "tg"), nilai: function (x) { return bagi(x.realisasi, x.target); }, diJumlah: true, total: bagi(T.realisasi, T.target), lebar: 9 },
          { judul: "Pagu (Rp)", kunci: "pg", jenis: "n", nilai: function (x) { return x.pagu; }, jumlah: true, total: T.pagu, lebar: 18 },
          { judul: "Terbayar (Rp)", kunci: "tb", jenis: "n", nilai: function (x) { return x.terbayar; }, jumlah: true, total: T.terbayar, lebar: 18 },
          { judul: "% terbayar", rumus: pctF("tb", "pg"), nilai: function (x) { return bagi(x.terbayar, x.pagu); }, diJumlah: true, total: bagi(T.terbayar, T.pagu), lebar: 10 },
          { judul: "Pagu bencana (Rp)", kunci: "pb", jenis: "n", nilai: function (x) { return x.pagu_b; }, jumlah: true, total: T.pagu_b, lebar: 18 },
          { judul: "Pagu non bencana (Rp)", rumus: function (r, K) { return K.pg + r + "-" + K.pb + r; }, z: "#,##0", nilai: function (x) { return x.pagu - x.pagu_b; }, diJumlah: true, total: T.pagu - T.pagu_b, lebar: 18 },
          { judul: "Terbayar bencana (Rp)", kunci: "bb", jenis: "n", nilai: function (x) { return x.terbayar_b; }, jumlah: true, total: T.terbayar_b, lebar: 18 },
          { judul: "Terbayar non bencana (Rp)", rumus: function (r, K) { return K.tb + r + "-" + K.bb + r; }, z: "#,##0", nilai: function (x) { return x.terbayar - x.terbayar_b; }, diJumlah: true, total: T.terbayar - T.terbayar_b, lebar: 18 }
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
        { judul: "Kegiatan/Bantuan", nilai: function (x) { return x.kegiatan; }, lebar: 52 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 },
        { judul: "Jumlah provinsi", jenis: "n", nilai: function (x) { return x.jml_prov; }, lebar: 9 },
        { judul: "Jumlah kab/kota", jenis: "n", nilai: function (x) { return x.jml_kab; }, lebar: 9 }
      ].concat(kolomAngka(T)), keg, "Jumlah nasional");

      var wsProvSatu = satuProvinsi ? lembar(X, [
        { judul: "Kegiatan/Bantuan", nilai: function (x) { return x.kegiatan; }, lebar: 52 },
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
        { judul: "Kegiatan/Bantuan", nilai: function (x) { return x.kegiatan; }, lebar: 46 },
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
        { judul: "Kegiatan/Bantuan", nilai: function (x) { return x.kegiatan; }, lebar: 46 },
        { judul: "Kelompok", kunci: "grup", nilai: grupNama, lebar: 18 },
        { judul: "Sumber dana", nilai: sumberNama, lebar: 11 },
        { judul: "Satuan", nilai: satuanNama, lebar: 9 }
      ].concat(kolomAngka(TK)), rowsKab, "Jumlah");

      var cat = [["Rekap bantuan perkebunan " + (satuProvinsi ? "Provinsi " + R.namaProvinsi(s.provinsi) + " " : "") + "TA " + (j.ta || "")], ["Data per " + tglTeks(j.data_per)],
        ["Sumber dana: " + namaSumber(s) + (s.komoditas ? " · komoditas " + s.komoditas.toLowerCase() : "")],
        ["Diunduh " + Monev.format.waktu(new Date()) + " dari Monev Ditjenbun"], [""]]
        .concat(CATATAN.map(function (c) { return [c]; }))
        .concat([[""], ["Persentase dan jumlah memakai rumus. Jumlah fisik menjumlah baris kelompok Kawasan dan Kawasan ABT saja (SUMIF)."]]);
      var wsCat = X.utils.aoa_to_sheet(cat); wsCat["!cols"] = [{ wch: 140 }];

      var wb = X.utils.book_new();
      if (satuProvinsi) X.utils.book_append_sheet(wb, wsProvSatu, "Provinsi");
      else {
        X.utils.book_append_sheet(wb, wsNas, "Nasional");
        X.utils.book_append_sheet(wb, wsProv, "Per Provinsi");
      }
      X.utils.book_append_sheet(wb, wsKab, "Per Kabupaten");
      X.utils.book_append_sheet(wb, wsCat, "Catatan Data");
      simpanXlsx(X, wb, "Rekap Bantuan Ditjenbun " + (j.ta || "") + " - " + (satuProvinsi ? R.namaProvinsi(s.provinsi) + " - " : "") + String(j.data_per || "").slice(0, 10) + ".xlsx");
    });
  }

  window.RekapDokumen = { unduhPDF: unduhPDF, unduhExcel: unduhExcel,
    unduhExcelProvinsi: function (j, s) { return unduhExcel(j, s, true); }, CATATAN: CATATAN };
})();
