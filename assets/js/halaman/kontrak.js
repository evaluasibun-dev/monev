/* Menu Kontrak — tab publik: Ringkasan, Temuan, Peringatan.
   Data: data/<tahun>/kontrak/kontrak.json (disusun pubKontrakJson_ di Apps Script, tanpa supplier dan NRK).
   Rumus agregasi SAMA dengan Dashboard.html lama (agg, bucket, filtered) supaya angkanya identik.
   Mockup: KontrakRingkasan, KontrakTemuan, KontrakPeringatan. */
(function () {
  "use strict";

  var F = function () { return Monev.format; };
  var e = function (s) { return Monev.esc(s); };
  var I = function () { return Monev.istilah; };

  /* Filter dipakai bersama ketiga tab dan bertahan saat pindah tab. */
  var FILTER = { unit: "", kegiatan: "", komoditas: "", sumber: "", aktif: true };
  var STATE = { peringatan: "semua", cariPeringatan: "", batasPeringatan: 100,
                kategori: "", verif: "belum", cariTemuan: "", batasTemuan: 100 };

  var TEMUAN = {
    "01": "Tidak ada lagi di ekspor MyIntress",
    "02": "NRK belum terdaftar",
    "03": "Melewati tanggal selesai",
    "04": "Nilai pembayaran kosong",
    "05": "Selesai tetapi masih ada sisa kontrak",
    "06": "KRO kosong",
    "07": "Akun di KRO ≠ kode COA",
    "08": "Kegiatan kosong",
    "09": "Volume/satuan kosong (akun bantuan)",
    "10": "Lokasi/komoditas kosong (akun bantuan)",
    "11": "Wilayah tidak cocok Master Lokus",
    "12": "Komoditas tidak baku",
    "13": "Kontrak manual belum diperbarui",
    "14": "Isian berbeda dengan uraian kontrak"
  };
  /* Sama dengan TEM_FIX di Dashboard.html: diperbaiki lewat verifikasi staf. */
  var TEMUAN_PERBAIKI = ["06", "07", "08", "09", "10", "11", "12", "14"];
  var TEMUAN_TINDAK = ["01", "02", "03", "04", "05", "13"];

  /* ---------- data ---------- */
  var muatan = {};   // per tahun: Promise

  function muat(ta) {
    if (!muatan[ta]) {
      muatan[ta] = Monev.data.muatTahun("kontrak/kontrak.json", ta).then(siapkan);
      muatan[ta].catch(function () { delete muatan[ta]; });
    }
    return muatan[ta];
  }

  function siapkan(j) {
    j.kontrak.forEach(function (c) {
      c.unitBaku = I().unit(c.unit);
      c.komBaku = I().komoditas(c.komoditas);
      c.manual = /^MANUAL/i.test(c.sumber || "");
      c.pct = c.nilai ? c.bayar / c.nilai : 0;
    });
    var idx = {};
    j.kontrak.forEach(function (c) { idx[c.no] = c; });
    j._idx = idx;
    return j;
  }

  function terfilter(j) {
    return j.kontrak.filter(function (c) {
      return (!FILTER.unit || c.unitBaku === FILTER.unit) &&
        (!FILTER.kegiatan || c.kegiatan === FILTER.kegiatan) &&
        (!FILTER.komoditas || (FILTER.komoditas === "-" ? !c.komBaku : c.komBaku === FILTER.komoditas)) &&
        (!FILTER.sumber || (FILTER.sumber === "manual" ? c.manual : !c.manual)) &&
        (!FILTER.aktif || c.aktif);
    });
  }

  /* agg() Dashboard.html */
  function agg(rows, batas) {
    var x = { n: 0, nilai: 0, bayar: 0, sisa: 0, selesai: 0, lunas: 0, belumLunas: 0, lewat: 0, habis: 0, ver: 0, manual: 0 };
    rows.forEach(function (c) {
      x.n++; x.nilai += c.nilai; x.bayar += c.bayar; x.sisa += c.sisa;
      if (c.manual) x.manual++;
      if (c.verifikasi === "TERVERIFIKASI") x.ver++;
      if (c.selesai) { x.selesai++; if (c.sisa > 0) x.belumLunas++; else x.lunas++; }
      if (!c.selesai && c.sisa_hari !== null && c.sisa_hari < 0) x.lewat++;
      if (!c.selesai && c.sisa_hari !== null && c.sisa_hari >= 0 && c.sisa_hari <= batas) x.habis++;
    });
    x.pct = x.nilai ? x.bayar / x.nilai : 0;
    return x;
  }

  /* bucket() Dashboard.html, dengan d14 dan d30 digabung menjadi "8–30 hari" (mockup KontrakPeringatan). */
  function bucket(c, batas) {
    if (c.selesai || !c.aktif || c.sisa_hari === null || c.sisa_hari === undefined) return null;
    if (c.sisa_hari < 0) return "lewat";
    if (c.sisa_hari <= 7) return "d7";
    if (c.sisa_hari <= batas) return "d30";
    return null;
  }

  function kelompok(rows, kunci) {
    var g = {};
    rows.forEach(function (c) { (g[c[kunci]] = g[c[kunci]] || []).push(c); });
    return g;
  }

  /* ---------- potongan tampilan ---------- */
  function persen(r) { return F().persen(r * 100); }

  function chipSisaHari(c, batas) {
    var b = bucket(c, batas);
    if (c.selesai) return c.sisa > 0
      ? '<span class="chip chip-warn">Selesai, sisa ' + e(F().rupiah(c.sisa)) + "</span>"
      : '<span class="chip chip-ok">Selesai</span>';
    if (c.sisa_hari === null || c.sisa_hari === undefined) return '<span class="chip chip-neutral">–</span>';
    if (b === "lewat") return '<span class="chip chip-bad">Lewat ' + (-c.sisa_hari) + " hari</span>";
    if (c.sisa_hari === 0) return '<span class="chip chip-warn">Berakhir hari ini</span>';
    if (b === "d7") return '<span class="chip chip-warn">' + c.sisa_hari + " hari lagi</span>";
    return '<span class="chip chip-neutral">' + c.sisa_hari + " hari lagi</span>";
  }

  function chipSumber(c) {
    return c.manual ? '<span class="chip chip-manual">Manual</span>' : '<span class="chip chip-myintress">MyIntress</span>';
  }

  function teksStatus(s) {
    s = String(s || "-");
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  function kartu(label, nilai, ket, opsi) {
    opsi = opsi || {};
    var isi = '<span class="kartu-label">' + e(label) + '</span><span class="kartu-nilai">' + e(nilai) + "</span>" +
      (ket ? '<span class="kartu-ket">' + e(ket) + "</span>" : "");
    if (opsi.tombol) return '<button type="button" class="kartu-angka kartu-tombol" data-kartu="' + e(opsi.tombol) +
      '" aria-pressed="' + (opsi.pilih ? "true" : "false") + '">' + isi + "</button>";
    return '<div class="kartu-angka">' + isi + "</div>";
  }

  function tombolMasuk(label) {
    var url = Monev.urlMasuk("");
    return url
      ? '<a class="tombol tombol-sekunder tombol-kecil" href="' + e(url) + '" rel="noopener">' + e(label) + "</a>"
      : '<span class="tombol tombol-sekunder tombol-kecil" role="link" aria-disabled="true" title="Halaman kerja belum tersedia">' + e(label) + "</span>";
  }

  function opsi(nilai, label, pilih) {
    return '<option value="' + e(nilai) + '"' + (nilai === pilih ? " selected" : "") + ">" + e(label) + "</option>";
  }

  function unik(arr) { var o = {}; arr.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }

  function filterBar(j) {
    var units = unik(j.kontrak.map(function (c) { return c.unitBaku; })).sort(I().urutUnit);
    var kegs = unik(j.kontrak.map(function (c) { return c.kegiatan; })).sort();
    var koms = unik(j.kontrak.map(function (c) { return c.komBaku; })).sort(I().urutKomoditas);
    var adaTanpaKom = j.kontrak.some(function (c) { return !c.komBaku; });
    return '<div class="filter-bar" role="group" aria-label="Saring kontrak">' +
      '<label class="sr-only" for="f-unit">Unit kerja</label><select id="f-unit" data-filter="unit">' +
        opsi("", "Semua unit kerja", FILTER.unit) + units.map(function (u) { return opsi(u, u, FILTER.unit); }).join("") + "</select>" +
      '<label class="sr-only" for="f-keg">Kegiatan</label><select id="f-keg" data-filter="kegiatan">' +
        opsi("", "Semua kegiatan", FILTER.kegiatan) + kegs.map(function (k) { return opsi(k, k, FILTER.kegiatan); }).join("") + "</select>" +
      '<label class="sr-only" for="f-kom">Komoditas</label><select id="f-kom" data-filter="komoditas">' +
        opsi("", "Semua komoditas", FILTER.komoditas) + koms.map(function (k) { return opsi(k, k, FILTER.komoditas); }).join("") +
        (adaTanpaKom ? opsi("-", "Tanpa komoditas", FILTER.komoditas) : "") + "</select>" +
      '<label class="sr-only" for="f-sumber">Sumber kontrak</label><select id="f-sumber" data-filter="sumber">' +
        opsi("", "MyIntress dan manual", FILTER.sumber) + opsi("myintress", "MyIntress", FILTER.sumber) + opsi("manual", "Manual", FILTER.sumber) + "</select>" +
      '<label class="centang"><input type="checkbox" data-filter="aktif"' + (FILTER.aktif ? " checked" : "") + "> Hanya kontrak aktif</label>" +
      '<span class="sumber">Database kontrak per ' + e(F().waktu(j.data_per)) + "</span>" +
      "</div>";
  }

  function seksi(judul, ket, isi, opsiSeksi) {
    opsiSeksi = opsiSeksi || {};
    return '<section class="seksi"' + (opsiSeksi.id ? ' id="' + opsiSeksi.id + '"' : "") + '><div class="seksi-kepala"><h2>' + e(judul) + "</h2>" +
      (opsiSeksi.kanan || (ket ? '<span class="seksi-keterangan">' + e(ket) + "</span>" : "")) + "</div>" + isi + "</section>";
  }

  function tombolCSV(nama) {
    return '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-csv="' + e(nama) + '">Unduh CSV</button>';
  }

  /* ================= RINGKASAN ================= */
  function ringkasan(j, rows) {
    var batas = j.batas_peringatan_hari || 30;
    var a = agg(rows, batas);
    var html = "";

    var baru = rows.filter(function (c) { return c.aktif && c.perlu_verifikasi && c.baru; }).length;
    if (baru) html += '<div class="banner" role="status"><span><strong>' + baru + " kontrak baru</strong> dari import terakhir perlu diverifikasi.</span>" +
      tombolMasuk("Verifikasi sekarang") + "</div>";

    html += '<section class="grid-kartu grid-kartu-padat" aria-label="Angka utama kontrak">' +
      kartu(FILTER.aktif ? "Kontrak aktif" : "Kontrak", F().satuan(a.n, "").trim(), F().satuan(a.n - a.manual, "MyIntress") + " · " + F().satuan(a.manual, "manual")) +
      kartu("Nilai kontrak", F().rupiahM(a.nilai), "termasuk addendum") +
      kartu("Pembayaran", persen(a.pct), F().rupiahM(a.bayar)) +
      kartu("Sisa kontrak (OS)", F().rupiahM(a.sisa), "masuk outstanding anggaran") +
      kartu("Selesai", F().satuan(a.selesai, "").trim(), F().satuan(a.belumLunas, "selesai tapi belum lunas")) +
      "</section>";

    /* per unit kerja */
    var g = kelompok(rows, "unitBaku");
    var units = Object.keys(g).sort(I().urutUnit);
    var A = {};
    units.forEach(function (u) { A[u] = agg(g[u], batas); });

    var barBayar = units.map(function (u) {
      var x = A[u], w = Math.max(0, Math.min(100, x.pct * 100));
      return '<div class="baris-bar"><span class="baris-label">' + e(u) + '</span>' +
        '<div class="bar" role="img" aria-label="' + e(u + ": pembayaran " + persen(x.pct) + " dari nilai kontrak") + '"><div class="bar-sp2d" style="width:' + w + '%"></div></div>' +
        '<span class="baris-angka">' + persen(x.pct) + "</span></div>";
    }).join("");

    var barStatus = units.map(function (u) {
      var x = A[u], n = x.n || 1;
      var berjalan = x.n - x.selesai;
      var ver = x.n ? x.ver / x.n : 0;
      var label = u + ": " + x.lunas + " selesai lunas, " + x.belumLunas + " selesai belum lunas, " + berjalan + " berjalan, terverifikasi " + persen(ver);
      return '<div class="baris-bar baris-bar-status"><span class="baris-label">' + e(u) + '</span>' +
        '<div class="bar" role="img" aria-label="' + e(label) + '" title="' + e(label) + '">' +
          '<div class="bar-lunas" style="width:' + (x.lunas / n * 100) + '%"></div>' +
          '<div class="bar-belum-lunas" style="width:' + (x.belumLunas / n * 100) + '%"></div>' +
          '<div class="bar-berjalan" style="width:' + (berjalan / n * 100) + '%"></div></div>' +
        '<span class="baris-angka" title="Terverifikasi">' + persen(ver) + "</span></div>";
    }).join("");

    html += '<div class="grid-dua">' +
      seksi("Persentase pembayaran per unit kerja", "", '<span class="catatan">Nilai pembayaran ÷ nilai kontrak</span>' + (barBayar || kosongKecil())) +
      seksi("Status progres dan verifikasi per unit kerja", "",
        '<div class="legenda"><span><i class="bar-lunas"></i>Selesai lunas</span><span><i class="bar-belum-lunas"></i>Selesai, belum lunas</span>' +
        '<span><i class="bar-berjalan"></i>Berjalan</span><span>Angka kanan = % terverifikasi</span></div>' + (barStatus || kosongKecil())) +
      "</div>";

    /* resume per unit kerja */
    var tot = agg(rows, batas);
    var baris = units.map(function (u) {
      var x = A[u];
      return '<tr><td><button type="button" class="tautan-sel" data-pilih-unit="' + e(u) + '">' + e(u) + "</button></td>" +
        '<td class="angka">' + F().satuan(x.n, "").trim() + '</td><td class="angka">' + F().ribuan(x.nilai) + '</td><td class="angka">' + F().ribuan(x.bayar) +
        '</td><td class="angka">' + persen(x.pct) + '</td><td class="angka">' + F().ribuan(x.sisa) + '</td><td class="angka">' + x.selesai +
        '</td><td class="angka">' + (x.lewat ? '<span class="chip chip-bad">' + x.lewat + "</span>" : "0") + '</td><td class="angka">' + persen(x.n ? x.ver / x.n : 0) + "</td></tr>";
    }).join("");
    var jumlah = '<tr class="jumlah"><td>Jumlah</td><td class="angka">' + F().satuan(tot.n, "").trim() + '</td><td class="angka">' + F().ribuan(tot.nilai) +
      '</td><td class="angka">' + F().ribuan(tot.bayar) + '</td><td class="angka">' + persen(tot.pct) + '</td><td class="angka">' + F().ribuan(tot.sisa) +
      '</td><td class="angka">' + tot.selesai + '</td><td class="angka">' + tot.lewat + '</td><td class="angka">' + persen(tot.n ? tot.ver / tot.n : 0) + "</td></tr>";
    html += seksi("Resume per unit kerja", "", '<div class="wadah-tabel"><table class="tabel tabel-sedang"><thead><tr><th scope="col">Unit kerja</th><th scope="col" class="angka">Kontrak</th>' +
      '<th scope="col" class="angka">Nilai kontrak (Rp)</th><th scope="col" class="angka">Pembayaran (Rp)</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Sisa OS (Rp)</th>' +
      '<th scope="col" class="angka">Selesai</th><th scope="col" class="angka">Lewat batas</th><th scope="col" class="angka">Terverifikasi</th></tr></thead><tbody>' +
      (baris || '<tr><td colspan="9">Tidak ada kontrak untuk saringan ini.</td></tr>') + jumlah + "</tbody></table></div>" +
      '<p class="catatan">Ditjenbun Pusat (satker 238830) dipecah per kode kegiatan. Kontrak Pusat yang KRO atau kode kegiatannya belum diisi tampil di baris "Pusat, belum terpetakan" sampai dilengkapi lewat verifikasi. Klik nama unit untuk menyaring.</p>',
      { kanan: tombolCSV("unit") });

    /* per kegiatan, 10 terbesar */
    var gk = kelompok(rows, "kegiatan");
    var kegs = Object.keys(gk).map(function (k) { return { k: k, x: agg(gk[k], batas) }; })
      .sort(function (p, q) { return q.x.nilai - p.x.nilai; }).slice(0, 10);
    var tKeg = kegs.map(function (o) {
      return "<tr><td>" + e(o.k) + '</td><td class="angka">' + F().ribuan(o.x.nilai) + '</td><td class="angka">' + F().ribuan(o.x.bayar) +
        '</td><td class="angka">' + persen(o.x.pct) + "</td></tr>";
    }).join("");

    /* histori harian (posisi akhir tiap hari import) */
    var h = j.histori || { hari: [], seri: {} };
    var kunciUnit = FILTER.unit ? Object.keys(h.seri || {}).filter(function (k) { return I().unit(k) === FILTER.unit; })[0] : "TOTAL";
    var seri = (h.seri || {})[kunciUnit] || [];
    var tHist = "";
    for (var i = (h.hari || []).length - 1; i >= 0 && i >= h.hari.length - 10; i--) {
      var p = seri[i];
      if (!p) { tHist += "<tr><td>" + F().tanggal(h.hari[i]) + '</td><td colspan="4">Tidak ada data unit kerja ini</td></tr>'; continue; }
      var prev = null;
      for (var k = i - 1; k >= 0; k--) if (seri[k]) { prev = seri[k]; break; }
      tHist += "<tr><td>" + F().tanggal(h.hari[i]) + '</td><td class="angka">' + F().ribuan(p.bayar) + '</td><td class="angka">' +
        persen(p.nilai ? p.bayar / p.nilai : 0) + '</td><td class="angka">' + (prev ? F().selisihRibuan(p.bayar - prev.bayar) : "–") +
        '</td><td class="angka">' + p.selesai + "</td></tr>";
    }
    var catatanHist = FILTER.kegiatan || FILTER.komoditas || FILTER.sumber ? "Saringan kegiatan, komoditas, dan sumber tidak berlaku untuk histori." : "Posisi akhir tiap hari import.";

    html += '<div class="grid-dua">' +
      seksi("Per kegiatan · 10 nilai kontrak terbesar", "", '<div class="wadah-tabel"><table class="tabel"><thead><tr><th scope="col">Kegiatan</th>' +
        '<th scope="col" class="angka">Nilai (Rp)</th><th scope="col" class="angka">Dibayar (Rp)</th><th scope="col" class="angka">%</th></tr></thead><tbody>' +
        (tKeg || '<tr><td colspan="4">Tidak ada kontrak untuk saringan ini.</td></tr>') + "</tbody></table></div>", { kanan: tombolCSV("kegiatan") }) +
      seksi("Histori harian", catatanHist, '<div class="wadah-tabel"><table class="tabel"><thead><tr><th scope="col">Tanggal</th>' +
        '<th scope="col" class="angka">Total bayar (Rp)</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Tambahan (Rp)</th><th scope="col" class="angka">Selesai</th></tr></thead><tbody>' +
        (tHist || '<tr><td colspan="5">Belum ada histori. Histori bertambah setiap kali file MyIntress diimport.</td></tr>') + "</tbody></table></div>") +
      "</div>";

    /* kontrak yang perlu perhatian: 5 teratas dari daftar peringatan */
    var w = rows.filter(function (c) { return bucket(c, batas); }).sort(function (p, q) { return p.sisa_hari - q.sisa_hari; }).slice(0, 5);
    var daftar = w.map(function (c) {
      return '<li class="baris-perhatian">' + chipSisaHari(c, batas) + '<span class="mono">' + e(c.no) + "</span>" +
        '<span class="perhatian-uraian">' + e(c.uraian) + " · berakhir " + e(F().tanggal(c.tgl_selesai)) + ", bayar " + persen(c.pct) + "</span>" +
        '<span class="perhatian-unit">' + e(c.unitBaku) + "</span></li>";
    }).join("");
    html += seksi("Kontrak yang perlu perhatian", "",
      daftar ? '<ul class="daftar-perhatian">' + daftar + "</ul>" : '<p class="paragraf-kecil">Tidak ada kontrak yang lewat batas atau berakhir dalam ' + batas + " hari.</p>",
      { kanan: '<a href="#kontrak-peringatan" class="tautan-kecil">Lihat semua peringatan</a>' });

    return html;
  }

  function kosongKecil() { return '<p class="paragraf-kecil">Tidak ada kontrak untuk saringan ini.</p>'; }

  /* ================= PERINGATAN ================= */
  function daftarPeringatan(rows, batas) {
    return rows.filter(function (c) {
      var b = bucket(c, batas);
      if (STATE.peringatan === "sisa") return c.aktif && c.selesai && c.sisa > 0;
      if (STATE.peringatan === "semua") return !!b;
      return b === STATE.peringatan;
    });
  }

  function peringatan(j, rows) {
    var batas = j.batas_peringatan_hari || 30;
    var hit = { lewat: 0, d7: 0, d30: 0 };
    rows.forEach(function (c) { var b = bucket(c, batas); if (b) hit[b]++; });
    var sisa = rows.filter(function (c) { return c.aktif && c.selesai && c.sisa > 0; });
    var nilaiSisa = sisa.reduce(function (s, c) { return s + c.sisa; }, 0);

    var html = '<section class="grid-kartu" aria-label="Kelompok peringatan">' +
      kartu("Lewat batas", String(hit.lewat), "belum selesai setelah tanggal selesai", { tombol: "lewat", pilih: STATE.peringatan === "lewat" }) +
      kartu("Berakhir ≤ 7 hari", String(hit.d7), "segera tindak lanjut ke PPK", { tombol: "d7", pilih: STATE.peringatan === "d7" }) +
      kartu("Berakhir ≤ " + batas + " hari", String(hit.d30), "8–" + batas + " hari lagi · pantau mingguan", { tombol: "d30", pilih: STATE.peringatan === "d30" }) +
      kartu("Selesai, masih ada sisa", String(sisa.length), F().rupiahM(nilaiSisa) + " belum dibayar", { tombol: "sisa", pilih: STATE.peringatan === "sisa" }) +
      "</section>";

    var list = daftarPeringatan(rows, batas);
    var q = STATE.cariPeringatan.toLowerCase();
    if (q) list = list.filter(function (c) { return (c.no + " " + c.uraian + " " + c.kab + " " + c.provinsi).toLowerCase().indexOf(q) >= 0; });
    list.sort(function (p, q2) {
      if (STATE.peringatan === "sisa") return q2.sisa - p.sisa;
      return p.sisa_hari - q2.sisa_hari;
    });

    var judulDaftar = { semua: "Kontrak akan berakhir atau lewat batas", lewat: "Kontrak lewat batas", d7: "Kontrak berakhir ≤ 7 hari",
      d30: "Kontrak berakhir 8–" + batas + " hari", sisa: "Kontrak selesai yang masih ada sisa" }[STATE.peringatan];
    var tampil = list.slice(0, STATE.batasPeringatan);
    var badan = tampil.map(function (c) {
      return "<tr><td>" + chipSisaHari(c, batas) + '</td><td class="mono">' + e(c.no) + '</td><td class="sel-uraian">' + e(c.uraian) +
        "</td><td>" + e(c.unitBaku) + " " + (c.manual ? chipSumber(c) : "") + "</td><td>" + e(F().tanggal(c.tgl_selesai)) +
        '</td><td class="angka">' + F().ribuan(c.nilai) + '</td><td class="angka">' + persen(c.pct) + "</td><td>" + e(teksStatus(c.status)) + "</td></tr>";
    }).join("");

    html += seksi(judulDaftar, "",
      '<div class="baris-alat"><label class="sr-only" for="cari-peringatan">Cari kontrak</label>' +
        '<input type="search" id="cari-peringatan" class="input-cari" placeholder="Cari nomor kontrak, uraian, provinsi…" value="' + e(STATE.cariPeringatan) + '">' +
        (STATE.peringatan !== "semua" ? '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-kartu="semua">Tampilkan semua peringatan</button>' : "") +
      "</div>" +
      '<div class="wadah-tabel"><table class="tabel tabel-lebar"><thead><tr><th scope="col">Batas</th><th scope="col">Nomor kontrak</th><th scope="col">Uraian</th>' +
      '<th scope="col">Unit kerja</th><th scope="col">Tanggal selesai</th><th scope="col" class="angka">Nilai (Rp)</th><th scope="col" class="angka">Bayar</th><th scope="col">Status progres</th></tr></thead><tbody>' +
      (badan || '<tr><td colspan="8">Tidak ada kontrak dalam kelompok ini.</td></tr>') + "</tbody></table></div>" +
      (list.length > tampil.length ? '<button type="button" class="tombol tombol-sekunder" data-lebih="peringatan">Tampilkan ' + Math.min(100, list.length - tampil.length) + " lagi dari " + (list.length - tampil.length) + "</button>" : "") +
      '<p class="catatan">' + list.length + " kontrak · diurutkan dari yang paling mendesak · tanggal selesai dari MyIntress atau input manual.</p>",
      { kanan: tombolCSV("peringatan") });
    return html;
  }

  /* ================= TEMUAN ================= */
  function kodeTemuan(k) { var m = String(k).match(/^(\d{2})/); return m ? m[1] : k; }

  function cocokVerif(c, verif) {
    var v = verif || STATE.verif;
    return v === "semua" || (v === "belum" && !c.verifikasi) || (v === "kon" && c.verifikasi === "PERLU KONFIRMASI") || (v === "ver" && c.verifikasi === "TERVERIFIKASI");
  }

  /** Temuan untuk kontrak terpilih dan status verifikasi → {basis, hit per kode}. Dipakai tab Temuan dan Beranda. */
  function hitungTemuan(j, rows, verif) {
    var ada = {};
    rows.forEach(function (c) { ada[c.no] = c; });
    var basis = (j.temuan || []).filter(function (t) { return ada[t.no]; }).map(function (t) { return { t: t, c: ada[t.no], kode: kodeTemuan(t.k) }; })
      .filter(function (x) { return cocokVerif(x.c, verif); });
    var hit = {};
    basis.forEach(function (x) { hit[x.kode] = (hit[x.kode] || 0) + 1; });
    return { basis: basis, hit: hit };
  }

  function temuan(j, rows) {
    var T = hitungTemuan(j, rows), basis = T.basis, hit = T.hit;
    if (!STATE.kategori || !hit[STATE.kategori]) {
      var pertama = TEMUAN_PERBAIKI.concat(TEMUAN_TINDAK).filter(function (k) { return hit[k]; })[0];
      STATE.kategori = pertama || STATE.kategori || "06";
    }

    var tombolKat = function (k) {
      var n = hit[k] || 0;
      return '<button type="button" class="tombol-kategori" data-kategori="' + k + '" aria-pressed="' + (STATE.kategori === k ? "true" : "false") + '">' +
        "<span>" + k + " " + e(TEMUAN[k]) + '</span><span class="jumlah-kategori' + (n ? "" : " nol") + '">' + n + "</span></button>";
    };

    var html = seksi("Temuan data kontrak", "",
      '<p class="paragraf-kecil">Dihitung dari database kontrak setiap kali data diterbitkan, sama dengan sheet TEMUAN_KONTRAK. Begitu diperbaiki lewat verifikasi, temuan kontrak itu hilang pada terbitan berikutnya. Pilih kategori untuk melihat daftarnya.</p>' +
      '<div class="baris-alat"><label class="label-kecil" for="f-verif">Status verifikasi</label><select id="f-verif" data-verif>' +
        opsi("belum", "Belum diverifikasi atau ditindaklanjuti", STATE.verif) + opsi("kon", "Perlu konfirmasi", STATE.verif) +
        opsi("ver", "Terverifikasi", STATE.verif) + opsi("semua", "Semua", STATE.verif) + "</select></div>" +
      '<h3 class="subjudul">Bisa diperbaiki lewat verifikasi</h3><div class="grid-kategori">' + TEMUAN_PERBAIKI.map(tombolKat).join("") + "</div>" +
      '<h3 class="subjudul">Perlu tindak lanjut ke PPK, MyIntress, atau SAKTI</h3><div class="grid-kategori">' + TEMUAN_TINDAK.map(tombolKat).join("") + "</div>");

    var q = STATE.cariTemuan.toLowerCase();
    var list = basis.filter(function (x) {
      return x.kode === STATE.kategori && (!q || (x.c.no + " " + x.c.uraian + " " + x.t.d + " " + x.c.kab).toLowerCase().indexOf(q) >= 0);
    }).sort(function (p, q2) { return I().urutUnit(p.c.unitBaku, q2.c.unitBaku) || q2.c.nilai - p.c.nilai; });
    var tampil = list.slice(0, STATE.batasTemuan);

    var badan = tampil.map(function (x) {
      return '<tr><td class="mono">' + e(x.c.no) + '</td><td class="sel-uraian">' + e(String(x.c.uraian).slice(0, 140)) + "</td><td>" + e(x.c.unitBaku) +
        '</td><td class="angka">' + F().ribuan(x.c.nilai) + "</td><td>" + e(x.t.d || "–") + "</td><td>" + e(x.t.tl || "–") + "</td></tr>";
    }).join("");

    html += seksi("Daftar temuan · " + STATE.kategori + " " + (TEMUAN[STATE.kategori] || ""), list.length + " temuan",
      '<div class="baris-alat"><label class="sr-only" for="cari-temuan">Cari temuan</label>' +
        '<input type="search" id="cari-temuan" class="input-cari" placeholder="Cari nomor kontrak, uraian, detail temuan…" value="' + e(STATE.cariTemuan) + '">' + tombolCSV("temuan") + "</div>" +
      '<div class="wadah-tabel"><table class="tabel tabel-lebar"><thead><tr><th scope="col">Nomor kontrak</th><th scope="col">Uraian</th><th scope="col">Unit kerja</th>' +
      '<th scope="col" class="angka">Nilai (Rp)</th><th scope="col">Detail temuan</th><th scope="col">Tindak lanjut</th></tr></thead><tbody>' +
      (badan || '<tr><td colspan="6">Tidak ada temuan untuk kategori dan saringan ini.</td></tr>') + "</tbody></table></div>" +
      (list.length > tampil.length ? '<button type="button" class="tombol tombol-sekunder" data-lebih="temuan">Tampilkan ' + Math.min(100, list.length - tampil.length) + " lagi dari " + (list.length - tampil.length) + "</button>" : "") +
      '<p class="catatan">Perbaikan dilakukan operator di halaman kerja (tombol Halaman kerja), bukan di halaman publik ini.</p>');
    return html;
  }

  /* ================= CSV ================= */
  function unduh(jenis, j, rows) {
    var batas = j.batas_peringatan_hari || 30, ta = j.ta, f = Monev.unduhCSV;
    if (jenis === "unit") {
      var g = kelompok(rows, "unitBaku");
      f("kontrak-per-unit-" + ta + ".csv", ["Unit kerja", "Kontrak", "Nilai kontrak (Rp)", "Pembayaran (Rp)", "% bayar", "Sisa OS (Rp)", "Selesai", "Lewat batas", "Terverifikasi"],
        Object.keys(g).sort(I().urutUnit).map(function (u) {
          var x = agg(g[u], batas);
          return [u, x.n, x.nilai, x.bayar, +(x.pct * 100).toFixed(1), x.sisa, x.selesai, x.lewat, x.ver];
        }));
    } else if (jenis === "kegiatan") {
      var gk = kelompok(rows, "kegiatan");
      f("kontrak-per-kegiatan-" + ta + ".csv", ["Kegiatan", "Kontrak", "Nilai kontrak (Rp)", "Pembayaran (Rp)", "% bayar"],
        Object.keys(gk).map(function (k) { var x = agg(gk[k], batas); return [k, x.n, x.nilai, x.bayar, +(x.pct * 100).toFixed(1)]; })
          .sort(function (p, q) { return q[2] - p[2]; }));
    } else if (jenis === "peringatan") {
      f("kontrak-peringatan-" + ta + ".csv", ["Nomor kontrak", "Uraian", "Unit kerja", "Tanggal selesai", "Sisa hari", "Nilai (Rp)", "Pembayaran (Rp)", "% bayar", "Status progres", "Sumber"],
        daftarPeringatan(rows, batas).map(function (c) {
          return [c.no, c.uraian, c.unitBaku, c.tgl_selesai, c.sisa_hari, c.nilai, c.bayar, +(c.pct * 100).toFixed(1), c.status, c.manual ? "Manual" : "MyIntress"];
        }));
    } else if (jenis === "temuan") {
      var ada = {};
      rows.forEach(function (c) { ada[c.no] = c; });
      f("kontrak-temuan-" + STATE.kategori + "-" + ta + ".csv", ["Kategori", "Nomor kontrak", "Uraian", "Unit kerja", "Nilai (Rp)", "Detail temuan", "Tindak lanjut", "Verifikasi"],
        (j.temuan || []).filter(function (t) { return ada[t.no] && kodeTemuan(t.k) === STATE.kategori && cocokVerif(ada[t.no]); }).map(function (t) {
          var c = ada[t.no];
          return [STATE.kategori + " " + TEMUAN[STATE.kategori], c.no, c.uraian, c.unitBaku, c.nilai, t.d, t.tl, c.verifikasi || "Belum"];
        }));
    }
  }

  /* ================= pasang ================= */
  function gambar(el, r, j) {
    var rows = terfilter(j);
    var tab = r.sub && r.sub.id ? r.sub.id : "";
    var isi = tab === "temuan" ? temuan(j, rows) : tab === "peringatan" ? peringatan(j, rows) : ringkasan(j, rows);
    var fokus = document.activeElement && document.activeElement.id;
    var posisi = fokus && document.activeElement.selectionStart;
    el.innerHTML = filterBar(j) + isi;
    if (fokus && document.getElementById(fokus)) {
      var x = document.getElementById(fokus);
      x.focus();
      if (posisi != null && x.setSelectionRange) try { x.setSelectionRange(posisi, posisi); } catch (er) { /* abaikan */ }
    }
  }

  function pasangPeristiwa(el, r, j) {
    var ulang = function () { gambar(el, r, j); };
    el.addEventListener("change", function (ev) {
      var t = ev.target, k = t.getAttribute("data-filter");
      if (k) { FILTER[k] = k === "aktif" ? t.checked : t.value; STATE.batasPeringatan = STATE.batasTemuan = 100; ulang(); return; }
      if (t.hasAttribute("data-verif")) { STATE.verif = t.value; STATE.batasTemuan = 100; ulang(); }
    });
    el.addEventListener("input", function (ev) {
      if (ev.target.id === "cari-peringatan") { STATE.cariPeringatan = ev.target.value; STATE.batasPeringatan = 100; ulang(); }
      if (ev.target.id === "cari-temuan") { STATE.cariTemuan = ev.target.value; STATE.batasTemuan = 100; ulang(); }
    });
    el.addEventListener("click", function (ev) {
      var t = ev.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-kartu")) { STATE.peringatan = t.getAttribute("data-kartu") === STATE.peringatan ? "semua" : t.getAttribute("data-kartu"); STATE.batasPeringatan = 100; ulang(); }
      else if (t.hasAttribute("data-kategori")) { STATE.kategori = t.getAttribute("data-kategori"); STATE.batasTemuan = 100; ulang(); }
      else if (t.hasAttribute("data-pilih-unit")) { FILTER.unit = t.getAttribute("data-pilih-unit"); ulang(); }
      else if (t.hasAttribute("data-lebih")) { var k = t.getAttribute("data-lebih"); if (k === "temuan") STATE.batasTemuan += 100; else STATE.batasPeringatan += 100; ulang(); }
      else if (t.hasAttribute("data-csv")) unduh(t.getAttribute("data-csv"), j, terfilter(j));
    });
  }

  Monev.menu = Monev.menu || {};
  Monev.menu.kontrak = {
    /** Dipanggil menu lain (Anggaran › per unit kerja) sebelum pindah ke #kontrak. */
    saringUnit: function (unit) { FILTER.unit = unit || ""; FILTER.kegiatan = ""; FILTER.komoditas = ""; FILTER.sumber = ""; },
    /** Ringkasan untuk Beranda: rumus sama dengan tab Ringkasan (agg), Peringatan (bucket), dan Temuan (status "belum"). unit "" = semua. */
    _muat: muat,
    _ringkas: function (j, unit) {
      var batas = j.batas_peringatan_hari || 30;
      var rows = j.kontrak.filter(function (c) { return c.aktif && (!unit || c.unitBaku === unit); });
      var b = { lewat: 0, d7: 0, d30: 0 };
      rows.forEach(function (c) { var k = bucket(c, batas); if (k) b[k]++; });
      var T = hitungTemuan(j, rows, "belum");
      return {
        a: agg(rows, batas), batas: batas, peringatan: b, temuan: T.basis.length,
        kontrakTemuan: Object.keys(T.basis.reduce(function (o, x) { o[x.c.no] = 1; return o; }, {})).length,
        baru: rows.filter(function (c) { return c.perlu_verifikasi && c.baru; }).length
      };
    },
    aksi: function (r) {
      if (r.sub && r.sub.id) return "";
      return '<a class="tombol tombol-myintress" href="#unggah">Upload MyIntress</a>' +
        '<a class="tombol tombol-manual" href="#unggah">Upload manual (HIBAH)</a>';
    },
    isi: function (el, r) {
      var ta = Monev.tahun.aktif();
      muat(ta).then(function (j) {
        if (!el.isConnected) return;
        gambar(el, r, j);
        pasangPeristiwa(el, r, j);
      }).catch(function (err) {
        if (!el.isConnected) return;
        el.innerHTML = err.status === 404
          ? Monev.data.tampil.kosong("Belum ada data kontrak TA " + ta,
              "Data kontrak terbit setelah file MyIntress diunggah dan diproses di halaman kerja.",
              { label: "Unggah data kontrak", href: "#unggah" })
          : Monev.data.tampil.gagal("Data kontrak TA " + ta + " gagal dimuat", "");
      });
    }
  };
})();
