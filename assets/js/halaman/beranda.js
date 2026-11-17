/* Menu Beranda — posisi anggaran, kontrak, dan bantuan dalam satu layar (desktop dan ponsel).
   Tidak ada rumus baru: setiap angka dihitung dengan fungsi menu asalnya.
   - Anggaran: Monev.menu.anggaran._model (kartu Realisasi), _selisihUnit (tab Perbandingan harian, ukuran SP2D, arsip terbaru vs sebelumnya).
   - Kontrak: Monev.menu.kontrak._ringkas (agg tab Ringkasan, bucket tab Peringatan, temuan status "belum" tab Temuan; kontrak aktif).
   - Bantuan: Monev.menu.bantuan._headline (angka utama Jejak), Sisbun.olah (fase dan status komoditas, siap tanam belum menanam),
     RekapInti.kartu (kartu Rekap nasional: pagu dan anggaran terbayar).
   Laporan harian dan Narasi PM hanya di halaman kerja (keputusan pemilik portal 17 Nov 2026).
   Data: data/<ta>/anggaran/latest.json, anggaran/arsip/, kontrak/kontrak.json, integrasi/rekap.json, API Sisbun.
   Mockup: Main (desktop), Mobile (ponsel). */
(function () {
  "use strict";

  var e = function (s) { return Monev.esc(s); };
  var F = function () { return Monev.format; };
  var I = function () { return Monev.istilah; };
  var MA = function () { return Monev.menu.anggaran; };
  var MK = function () { return Monev.menu.kontrak; };
  var MB = function () { return Monev.menu.bantuan; };
  var S = function () { return window.Sisbun; };
  var R = function () { return window.RekapInti; };

  var STATE = { unit: "" };
  /* Isian data: undefined = memuat, null = belum terbit (404), {gagal: true} = gagal dimuat. */
  var D = {};
  var elAktif = null;

  function baru(ta) {
    D = { ta: ta, j: undefined, harian: undefined, K: undefined, Sb: undefined, rekap: undefined };
  }
  function gagal(x) { return x && x.gagal; }
  /* Sisbun hanya untuk tahun berjalan (API tanpa pilihan tahun). */
  function nonaktif(x) { return x && x.nonaktif; }
  var TEKS_SISBUN = "Sisbun hanya memuat tahun berjalan";
  function siap(x) { return x && !x.gagal && !x.nonaktif; }
  function opsional404(p) {
    return p.catch(function (err) { if (err && err.status === 404) return null; return { gagal: true }; });
  }

  /* ---------------- muat ---------------- */
  function muatSemua(el, ta) {
    var set = function (k) { return function (v) { D[k] = v; gambar(); }; };
    var muat = function (p) { return Monev.data.muatTahun(p, ta); };
    var ulang = function (f) { return function (v) { if (D.ta === ta) f(v); }; };

    opsional404(muat("anggaran/latest.json")).then(ulang(set("j")));
    opsional404(muat("anggaran/arsip/indeks.json")).then(function (ix) {
      if (!siap(ix)) return ix;
      var daftar = (Array.isArray(ix.tanggal) ? ix.tanggal : []).filter(function (x) { return x.tanggal && x.file; })
        .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
      if (daftar.length < 2) return null;
      return Promise.all([muat("anggaran/arsip/" + daftar[0].file), muat("anggaran/arsip/" + daftar[1].file)]).then(function (h) {
        return { xa: daftar[0], xb: daftar[1], ja: h[0], jb: h[1] };
      }).catch(function () { return { gagal: true }; });
    }).then(ulang(set("harian")));
    MK()._muat(ta).then(function (j) { return j; }, function (err) { return err && err.status === 404 ? null : { gagal: true }; }).then(ulang(set("K")));
    if (!Monev.tahun.berjalan(ta)) D.Sb = { nonaktif: true };
    else S().ambilBersama(false).then(function (o) { return o; }, function () { return { gagal: true }; }).then(ulang(set("Sb")));
    opsional404(muat("integrasi/rekap.json")).then(ulang(set("rekap")));
  }

  /* ---------------- pembantu tampilan ---------------- */
  function persen(p) { return p == null || !isFinite(p) ? "–" : F().persen(p); }
  function rpM(n) { return n == null ? "–" : F().rupiahM(n); }
  function lebar(p) { return p > 0 && p < 1 ? 1 : Math.max(0, Math.min(100, p || 0)); }
  function memuatKecil(n) { return Monev.data.tampil.memuat(n || 2).replace('class="seksi"', 'class="muat-dalam"'); }
  function seksi(judul, isi, kanan, kelas) {
    return '<section class="seksi' + (kelas ? " " + kelas : "") + '"><div class="seksi-kepala"><h2>' + e(judul) + "</h2>" + (kanan || "") + "</div>" + isi + "</section>";
  }

  function kartu(o) {
    if (o.memuat) return '<div class="kartu-angka" aria-busy="true"><span class="kartu-label">' + e(o.label) + '</span>' +
      '<div class="kerangka-muat" aria-hidden="true"><span></span><span></span></div><span class="sr-only">Memuat data…</span></div>';
    return '<a class="kartu-angka" href="' + o.href + '"' + (o.unit ? ' data-beranda-unit-kontrak="' + e(o.unit) + '"' : "") + ">" +
      '<span class="kartu-label">' + e(o.label) + '</span><span class="kartu-nilai">' + e(o.nilai) + "</span>" +
      '<span class="kartu-ket">' + e(o.ket) + '</span><span class="kartu-tautan">' + e(o.tautan) + "</span></a>";
  }

  /** Teks umur data untuk chip status sumber (§5.8): "hari ini 15.30", "kemarin", "3 hari lalu". */
  function chipSumber(nama, nilai, opsi) {
    opsi = opsi || {};
    if (nilai === undefined) return '<span class="chip-sumber"><span class="titik titik-kosong"></span><strong>' + e(nama) + "</strong><span>memuat…</span></span>";
    if (!nilai) return '<span class="chip-sumber"><span class="titik titik-kosong"></span><strong>' + e(nama) + "</strong><span>" + e(opsi.kosong || "belum terbit") + "</span></span>";
    var tglSaja = /^\d{4}-\d{2}-\d{2}$/.test(nilai);
    var umur = F().umurHari(tglSaja ? nilai + "T12:00:00+07:00" : nilai);
    var teks = umur <= 0 ? "hari ini" + (tglSaja ? "" : " " + F().jam(nilai).replace(" WIB", "")) : umur === 1 ? "kemarin" : umur + " hari lalu";
    var kelas = umur <= 0 ? "titik-baru" : umur > 2 || opsi.lama ? "titik-basi" : "titik-kosong";
    return '<span class="chip-sumber" title="' + e(nama + " per " + (tglSaja ? F().tanggal(nilai) : F().waktu(nilai))) + '"><span class="titik ' + kelas + '"></span><strong>' + e(nama) + "</strong><span>" +
      e(teks + (opsi.lama ? " (cadangan)" : "")) + "</span></span>";
  }

  /* ---------------- bagian halaman ---------------- */
  function sumberData() {
    var m = siap(D.j) ? MA()._model(D.j) : null;
    var v = function (x, f) { return x === undefined ? undefined : siap(x) ? f(x) : null; };
    var kosong = function (x, teks) { return gagal(x) ? "gagal dimuat" : teks || "belum terbit"; };
    var daftar = [
      ["SP2D MyIntress", v(D.j, function () { return m.dataPer; }), { kosong: kosong(D.j) }],
      ["Kontrak MyIntress", v(D.K, function (K) { return K.data_per; }), { kosong: kosong(D.K) }],
      ["Sisbun", v(D.Sb, function (s) { return s.asof; }), { lama: siap(D.Sb) && D.Sb.lama, kosong: nonaktif(D.Sb) ? "hanya tahun berjalan" : kosong(D.Sb) }],
      ["Integrasi SAKTI–SAT 3", v(D.rekap, function (r) { return r.data_per; }), { kosong: kosong(D.rekap) }]
    ];
    return '<section class="baris-sumber" aria-label="Status sumber data">' + daftar.map(function (d) { return chipSumber(d[0], d[1], d[2]); }).join("") + "</section>";
  }

  function filterUnit() {
    var u = {};
    if (siap(D.j)) MA()._model(D.j).unit.forEach(function (r) { if (!r.unmapped) u[r.unit] = 1; });
    if (siap(D.K)) D.K.kontrak.forEach(function (c) { if (c.unitBaku && c.unitBaku !== "Pusat, belum terpetakan") u[c.unitBaku] = 1; });
    var units = Object.keys(u).sort(I().urutUnit);
    if (STATE.unit && !u[STATE.unit] && (siap(D.j) || siap(D.K))) STATE.unit = "";
    var opsi = function (v, l) { return '<option value="' + e(v) + '"' + (v === STATE.unit ? " selected" : "") + ">" + e(l) + "</option>"; };
    return '<div class="filter-bar" role="group" aria-label="Saring Beranda">' +
      '<label class="sr-only" for="f-beranda-unit">Unit kerja</label><select id="f-beranda-unit" data-beranda-unit>' +
      opsi("", "Semua unit kerja") + units.map(function (x) { return opsi(x, x); }).join("") + "</select>" +
      '<span class="sumber">' + (STATE.unit ? "Kartu anggaran dan kontrak, bar unit kerja, dan peringatan kontrak mengikuti unit kerja; bantuan tetap nasional"
        : "Anggaran dan kontrak seluruh Ditjenbun; bantuan nasional dari Sisbun dan hasil integrasi") + "</span></div>";
  }

  function kartuUtama() {
    var html = "";
    /* Anggaran: kartu Realisasi SP2D dan SP2D + OS tab Realisasi anggaran */
    if (D.j === undefined) html += kartu({ memuat: true, label: "Realisasi SP2D" }) + kartu({ memuat: true, label: "SP2D + outstanding" });
    else if (!siap(D.j)) {
      var ketA = gagal(D.j) ? "data anggaran gagal dimuat" : "data realisasi belum terbit";
      html += kartu({ label: "Realisasi SP2D", nilai: "–", ket: ketA, tautan: "Realisasi anggaran", href: "#anggaran" }) +
        kartu({ label: "SP2D + outstanding", nilai: "–", ket: ketA, tautan: "Outstanding", href: "#anggaran" });
    } else {
      var m = MA()._model(D.j), r = m.total, nama = "";
      if (STATE.unit) { var x = m.unit.filter(function (u) { return u.unit === STATE.unit; })[0]; if (x) { r = x; nama = STATE.unit + " · "; } }
      html += kartu({ label: "Realisasi SP2D", nilai: persen(r.pct), ket: nama + rpM(r.real) + " dari pagu " + rpM(r.pagu) + (r === m.total && m.hibah ? " · termasuk hibah" : ""),
        tautan: "Realisasi anggaran", href: "#anggaran" });
      html += kartu({ label: "SP2D + outstanding", nilai: persen(r.pct2), ket: nama + rpM(r.realOs) + (r.blokir == null ? " · potensi serapan" : " · sisa " + rpM(r.sisa)),
        tautan: "Outstanding kontrak", href: "#anggaran" });
    }
    /* Kontrak: kartu Kontrak aktif + Pembayaran tab Ringkasan (hanya kontrak aktif) */
    if (D.K === undefined) html += kartu({ memuat: true, label: "Kontrak aktif" });
    else if (!siap(D.K)) html += kartu({ label: "Kontrak aktif", nilai: "–", ket: gagal(D.K) ? "data kontrak gagal dimuat" : "data kontrak belum terbit", tautan: "Monitoring kontrak", href: "#kontrak" });
    else {
      var k = MK()._ringkas(D.K, STATE.unit), a = k.a;
      html += kartu({ label: "Kontrak aktif", nilai: F().satuan(a.n, "").trim(), ket: (STATE.unit ? STATE.unit + " · " : "") + "nilai " + rpM(a.nilai) + " · dibayar " + F().persen(a.pct * 100),
        tautan: "Monitoring kontrak", href: "#kontrak", unit: STATE.unit || "-" });
    }
    /* Bantuan: angka utama Jejak */
    if (D.Sb === undefined) html += kartu({ memuat: true, label: "Lahan sasaran ditanam" });
    else if (!siap(D.Sb)) html += kartu({ label: "Lahan sasaran ditanam", nilai: "–", ket: nonaktif(D.Sb) ? TEKS_SISBUN : "Sisbun gagal dibaca", tautan: nonaktif(D.Sb) ? "Rekap nasional" : "Jejak bantuan",
      href: nonaktif(D.Sb) ? "#bantuan-nasional" : "#bantuan" });
    else {
      var H = headline();
      html += kartu({ label: "Lahan sasaran ditanam", nilai: H.tanam == null ? "–" : F().persen(H.tanam),
        ket: S().ha(H.R) + " dari " + S().ha(H.T) + (H.tebuIkut ? " · termasuk tebu" : " · di luar tebu"), tautan: "Jejak bantuan", href: "#bantuan" });
    }
    return '<section class="grid-kartu grid-kartu-beranda" aria-label="Angka utama">' + html + "</section>";
  }

  function anggaranKom() { return siap(D.rekap) ? R().perKomoditas(R().baca(D.rekap)) : {}; }
  function headline() { return MB()._headline(D.Sb, anggaranKom()); }
  function olahKom() {
    var O = {};
    MB().KOMODITAS.forEach(function (k) { var s = D.Sb.S[k]; if (s) O[k] = S().olah(s, {}); });
    return O;
  }
  function rentang(a) {
    if (!a.length) return null;
    var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a);
    return { lo: lo, hi: hi, teks: S().nf(Math.floor(lo)) + "–" + S().nf(Math.round(hi)) + "%" };
  }

  function alur() {
    var L = [];
    var muatB = D.Sb === undefined, adaB = siap(D.Sb), muatR = D.rekap === undefined, adaR = siap(D.rekap);
    var K = adaR ? R().kartu(R().baca(D.rekap)) : null;
    var H = adaB ? headline() : null, O = adaB ? olahKom() : null;
    var langkah = function (nama, nilai, p, ket, opsi) { L.push({ nama: nama, nilai: nilai, p: p, ket: ket, o: opsi || {} }); };
    var belumR = muatR ? "memuat…" : gagal(D.rekap) ? "rekap gagal dimuat" : "hasil integrasi belum terbit";
    var belumB = muatB ? "memuat…" : nonaktif(D.Sb) ? TEKS_SISBUN : "Sisbun gagal dibaca";

    if (K && K.pagu) langkah("Pagu", "100%", 100, rpM(K.pagu) + " pagu bantuan · SAKTI");
    else langkah("Pagu", "–", 0, belumR === "memuat…" ? belumR : K ? "pagu bantuan belum ada" : belumR);
    if (H) langkah("CPCL ditetapkan", persen(H.cpcl), H.cpcl, S().ha(H.C) + " · Sisbun" + (H.tebuIkut ? "" : ", di luar tebu"));
    else langkah("CPCL ditetapkan", "–", 0, belumB);
    if (H && H.benihMin != null) langkah("Benih dikontrak", H.benih, H.benihMax, "rentang tujuh komoditas · Sisbun", { lo: H.benihMin });
    else langkah("Benih dikontrak", "–", 0, H ? "belum ada kontrak benih" : belumB);
    if (K && K.pagu) langkah("Anggaran terbayar", F().persen(K.terbayar / K.pagu * 100), K.terbayar / K.pagu * 100, rpM(K.terbayar) + " · SP2D 526 + benih + KBD tebu");
    else langkah("Anggaran terbayar", "–", 0, belumR);
    if (O) {
      /* tahap 5 Jejak: jadwal salur s.d. bulan ini ÷ kontrak benih (batang/mata), per komoditas */
      var nilai = [];
      MB().KOMODITAS.forEach(function (k) { var s = D.Sb.S[k], o = O[k]; if (s && o && s.vb) nilai.push(Math.min(100, o.planKini / s.vb * 100)); });
      var rg = rentang(nilai);
      if (rg) langkah("Jadwal salur s.d. bulan ini", rg.teks, rg.hi, "jadwal salur ÷ kontrak benih · Sisbun", { lo: rg.lo });
      else langkah("Jadwal salur s.d. bulan ini", "–", 0, "jadwal belum ada di Sisbun");
    } else langkah("Jadwal salur s.d. bulan ini", "–", 0, belumB);
    if (H) langkah("Ditanam", H.tanam == null ? "–" : F().persen(H.tanam), H.tanam, S().ha(H.R) + (H.tebuIkut ? " · termasuk tebu" : " · di luar tebu"));
    else langkah("Ditanam", "–", 0, belumB);

    var isi = '<ol class="alur-bantuan">' + L.map(function (x, i) {
      var bar = x.o.lo != null
        ? '<div class="bar" aria-hidden="true"><div class="bar-sp2d" style="width:' + lebar(x.o.lo) + '%"></div><div class="bar-os" style="width:' + Math.max(0, lebar(x.p) - lebar(x.o.lo)) + '%"></div></div>'
        : '<div class="bar" aria-hidden="true"><div class="bar-sp2d" style="width:' + lebar(x.p) + '%"></div></div>';
      return '<li class="alur-langkah"><span class="alur-nomor" aria-hidden="true">' + (i + 1) + '</span><span class="alur-nama">' + e(x.nama) + "</span>" +
        bar + '<span class="alur-nilai">' + e(x.nilai) + '</span><span class="catatan">' + e(x.ket) + "</span></li>";
    }).join("") + "</ol>";
    return seksi("Satu alur bantuan", isi + '<p class="catatan">Rentang = komoditas terendah sampai tertinggi (bagian muda pada bar). Pagu dan terbayar dari Rekap nasional; CPCL, benih, jadwal salur, dan tanam dari Jejak komoditas.</p>',
      '<span class="seksi-keterangan">Anggaran dan fisik dalam satu garis · dari Rekap nasional dan Jejak komoditas</span>');
  }

  function perUnit() {
    var kanan = '<a class="tautan-kecil" href="#anggaran">Rincian per kegiatan dan unit kerja</a>';
    if (D.j === undefined) return seksi("Realisasi per unit kerja", memuatKecil(4), kanan);
    if (!siap(D.j)) return seksi("Realisasi per unit kerja", '<p class="paragraf-kecil">' + (gagal(D.j) ? "Data anggaran gagal dimuat." : "Data realisasi belum terbit.") + "</p>", kanan);
    var m = MA()._model(D.j);
    var sel = {}, H = siap(D.harian) ? D.harian : null;
    if (H) MA()._selisihUnit(H.ja, H.jb, "sp2d").rows.forEach(function (x) { sel[x.unit] = x; });
    var units = m.unit.filter(function (x) { return !x.unmapped; }).slice().sort(function (a, b) { return I().urutUnit(a.unit, b.unit); });
    var tglB = H ? F().tanggal(H.xb.tanggal).replace(/ \d{4}$/, "") : "";
    var isi = MA()._legendaBar("os") + units.map(function (x) {
      var s = sel[x.unit], ket;
      if (D.harian === undefined) ket = "memuat selisih harian…";
      else if (!H) ket = "arsip harian belum cukup untuk dibandingkan";
      else if (!s || s.d == null) ket = "data " + tglB + " tidak ada";
      else ket = s.d > 0 ? "SP2D naik " + F().rupiah(s.d) + " dari " + tglB : s.d < 0 ? "SP2D turun " + F().rupiah(-s.d) + " dari " + tglB : "SP2D tetap sejak " + tglB;
      return '<div class="baris-unit' + (STATE.unit === x.unit ? " terpilih" : "") + '">' + MA()._barBaris(x.unit, x, "os") + '<span class="catatan">' + e(ket) + "</span></div>";
    }).join("");
    return seksi("Realisasi per unit kerja", isi + '<p class="catatan">Angka kanan = SP2D + outstanding terhadap pagu. Selisih SP2D antara dua arsip terakhir, sama dengan Perbandingan harian.</p>', kanan);
  }

  function perhatian() {
    var B = [], muat = [];
    var butir = function (jenis, kelas, judul, ket, href) { B.push({ jenis: jenis, kelas: kelas, judul: judul, ket: ket, href: href }); };
    var unitTeks = STATE.unit ? " di " + STATE.unit : "";

    if (siap(D.K)) {
      var k = MK()._ringkas(D.K, STATE.unit);
      if (k.peringatan.lewat) butir("KONTRAK", "warn", "Kontrak lewat batas", F().satuan(k.peringatan.lewat, "kontrak aktif") + " belum selesai setelah tanggal selesai" + unitTeks, "#kontrak-peringatan");
      if (k.peringatan.d7) butir("KONTRAK", "warn", "Kontrak berakhir ≤ 7 hari", F().satuan(k.peringatan.d7, "kontrak") + unitTeks + ", segera tindak lanjut ke PPK", "#kontrak-peringatan");
      if (k.temuan) butir("KONTRAK", "warn", "Temuan data kontrak belum diverifikasi", F().satuan(k.temuan, "temuan") + " di " + F().satuan(k.kontrakTemuan, "kontrak") + unitTeks, "#kontrak-temuan");
      if (k.baru) butir("KONTRAK", "warn", "Kontrak baru perlu diverifikasi", F().satuan(k.baru, "kontrak") + " dari import terakhir" + unitTeks, "#kontrak");
    } else if (D.K === undefined) muat.push("kontrak");

    if (siap(D.harian)) {
      var H = D.harian, rows = MA()._selisihUnit(H.ja, H.jb, "sp2d").rows.filter(function (x) { return !x.unmapped && x.d != null && x.d <= 0 && (!STATE.unit || x.unit === STATE.unit); });
      if (rows.length) butir("H-1", "info", "Unit kerja tanpa kenaikan realisasi", F().satuan(rows.length, "unit kerja") + " SP2D tetap atau turun dibanding " + F().tanggal(H.xb.tanggal) +
        ": " + rows.map(function (x) { return x.unit; }).join(", "), "#anggaran-harian");
    } else if (D.harian === undefined) muat.push("arsip harian");

    if (siap(D.Sb)) {
      var O = olahKom(), prov = {}, kom = [];
      MB().KOMODITAS.forEach(function (kk) {
        var o = O[kk]; if (!o || !o.siapBelum.length) return;
        kom.push(kk); o.siapBelum.forEach(function (p) { prov[p.n] = 1; });
      });
      var np = Object.keys(prov).length;
      if (np) butir("FISIK", "info", "Provinsi siap tanam tetapi belum menanam", F().satuan(np, "provinsi") + " (" + kom.join(", ") + "): CPCL dan kontrak ≥ 90% sasaran, luas tanam 0 ha", "#bantuan");
    } else if (D.Sb === undefined) muat.push("Sisbun");

    var basi = [];
    var cek = function (nama, nilai) { if (nilai && F().umurHari(/^\d{4}-\d{2}-\d{2}$/.test(nilai) ? nilai + "T12:00:00+07:00" : nilai) > Monev.config.BATAS_HARI_BASI) basi.push(nama); };
    if (siap(D.j)) cek("SP2D MyIntress", MA()._model(D.j).dataPer);
    if (siap(D.K)) cek("Kontrak MyIntress", D.K.data_per);
    if (siap(D.Sb)) { cek("Sisbun", D.Sb.asof); if (D.Sb.lama && basi.indexOf("Sisbun") < 0) basi.push("Sisbun (memakai data cadangan)"); }
    if (siap(D.rekap)) cek("hasil integrasi", D.rekap.data_per);
    if (basi.length && !Monev.tahun.ditutup(D.ta)) butir("DATA", "neutral", "Data belum diperbarui lebih dari " + Monev.config.BATAS_HARI_BASI + " hari", basi.join(", "), "#tentang");

    var isi = B.length ? '<ul class="daftar-beranda-perhatian isi-rata">' + B.map(function (b) {
      return '<li><a class="butir-perhatian" href="' + b.href + '"><span class="chip chip-' + b.kelas + '">' + e(b.jenis) + "</span>" +
        '<span class="butir-teks"><strong>' + e(b.judul) + '</strong><span class="paragraf-kecil">' + e(b.ket) + "</span></span></a></li>";
    }).join("") + "</ul>" : (muat.length ? "" : '<p class="paragraf-kecil">Tidak ada yang perlu perhatian dari data yang sudah terbit.</p>');
    if (muat.length) isi += '<p class="catatan" aria-busy="true">Masih memuat ' + e(muat.join(", ")) + "…</p>";
    return seksi("Perlu perhatian", isi,
      '<span class="seksi-keterangan">' + (B.length ? '<span class="chip chip-warn">' + B.length + "</span> " : "") + "Dihitung otomatis setiap muat data</span>");
  }

  function jejakKomoditas() {
    var kanan = '<a class="tautan-kecil" href="#bantuan-provinsi">Rekap per provinsi</a>';
    if (D.Sb === undefined) return seksi("Jejak tujuh komoditas", memuatKecil(2), kanan);
    if (nonaktif(D.Sb)) return seksi("Jejak tujuh komoditas", '<p class="paragraf-kecil">' + e(TEKS_SISBUN) + ", jadi status komoditas TA " + e(D.ta) + " tidak ditampilkan. Capaian fisik tahun ini ada di Rekap nasional.</p>", '<a class="tautan-kecil" href="#bantuan-nasional">Rekap nasional</a>');
    if (!siap(D.Sb)) return seksi("Jejak tujuh komoditas", '<p class="paragraf-kecil">Data Sisbun gagal dibaca. <button type="button" class="tautan-sel" data-beranda-ulang>Coba lagi</button></p>', kanan);
    var O = olahKom();
    var isi = '<div class="grid-komoditas-beranda">' + MB().KOMODITAS.map(function (k) {
      var o = O[k], st = o ? S().STATUS[o.status] : S().STATUS.kosong;
      return '<a class="kartu-komoditas" href="#bantuan" data-beranda-kom="' + e(k) + '"><strong>' + e(k) + '</strong><span class="catatan">' + e(o ? o.fase : "Data belum ada") + "</span>" +
        '<span class="chip chip-' + st.chip + '">' + e(st.label) + "</span></a>";
    }).join("") + "</div>" +
      '<p class="catatan">Sisbun per ' + e(F().tanggal(D.Sb.asof)) + (D.Sb.lama ? " (cadangan, Sisbun tidak bisa dihubungi)" : ", dibaca " + e(F().jam(D.Sb.diambil))) +
      ". Status: luas tanam ÷ jadwal salur s.d. akhir bulan lalu (≥ 75% sesuai jadwal, 30–75% perlu dipercepat, &lt; 30% tertinggal jauh).</p>";
    return seksi("Jejak tujuh komoditas", isi, kanan);
  }

  /* ---------------- pasang ---------------- */
  function gambar() {
    var el = elAktif;
    if (!el || !el.isConnected) return;
    var fokus = document.activeElement && document.activeElement.id;
    el.innerHTML = filterUnit() + sumberData() + kartuUtama() + alur() +
      '<div class="grid-dua">' + perUnit() + perhatian() + "</div>" + jejakKomoditas() +
      '<p class="catatan" id="beranda-pesan" role="status"></p>';
    if (fokus && document.getElementById(fokus)) document.getElementById(fokus).focus();
  }

  function pesan(t) { var p = document.getElementById("beranda-pesan"); if (p) p.textContent = t; }

  var terpasang = false;
  function pasangSekali() {
    if (terpasang) return; terpasang = true;
    document.addEventListener("change", function (ev) {
      var t = ev.target;
      if (!t.hasAttribute || !t.hasAttribute("data-beranda-unit")) return;
      STATE.unit = t.value; gambar();
    });
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-beranda-kom], [data-beranda-unit-kontrak], [data-beranda-ulang]");
      if (!t) return;
      if (t.hasAttribute("data-beranda-kom")) MB().pilihKomoditas(t.getAttribute("data-beranda-kom"));
      else if (t.hasAttribute("data-beranda-unit-kontrak")) { var u = t.getAttribute("data-beranda-unit-kontrak"); if (MK().saringUnit) MK().saringUnit(u === "-" ? "" : u); }
      else if (t.hasAttribute("data-beranda-ulang")) { D.Sb = undefined; gambar(); S().ambilBersama(true).then(function (o) { return o; }, function () { return { gagal: true }; }).then(function (v) { D.Sb = v; gambar(); }); }
    });
  }

  Monev.menu = Monev.menu || {};
  Monev.menu.beranda = {
    aksi: function () {
      return "";
    },
    isi: function (el) {
      elAktif = el; pasangSekali();
      var ta = Monev.tahun.aktif();
      /* Muat ulang setiap kali Beranda dibuka (berkas JSON di-cache Monev.data; Sisbun dibagi pakai dengan Bantuan). */
      baru(ta);
      muatSemua(el, ta);
      gambar();
    }
  };
})();
