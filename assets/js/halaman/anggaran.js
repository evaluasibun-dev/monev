/* Menu Anggaran — Realisasi anggaran, Rincian RO dan akun, Perbandingan harian, Target serapan.
   Data: data/<tahun>/anggaran/latest.json, arsip/indeks.json, arsip/YYYYMMDD.json, target.json.
   - latest.json berisi kunci FA16 Segmen bentuk lama (tanggal, total, satker, kegiatan, kro, ro, komponen, akun, satker_*, …)
     ditambah realisasi {s2, s4, s5} dari Real_.compute (Realisasiserver.gs) = angka slide 2/4/5 PPT.
     File bentuk lama tanpa "realisasi" tetap terbaca: tabel kegiatan/unit diturunkan dari FA16, blokir dan hibah "–".
   - target.json = Dash_.target() (DashboardServer.gs); hitungan harian/mingguan disalin dari tgEngine() di Dashboard.html.
   Mockup: Anggaran, AnggaranRincian, AnggaranHarian, Target. */
(function () {
  "use strict";

  var F = function () { return Monev.format; };
  var I = function () { return Monev.istilah; };
  var e = function (s) { return Monev.esc(s); };

  var STATE = {
    mode: "sp2d", unit: "", kegiatan: "", komoditas: "",
    rinci: { satker: "", kegiatan: "", kro: "", jenis: "", buka: {}, akunHal: 0 },
    harian: { a: "", b: "", ukur: "sp2d" },
    target: { unit: "", jalur: "1", hariHal: null }
  };

  var JENIS = { "51": "Pegawai", "52": "Barang", "53": "Modal", "57": "Bansos/Banper" };
  var URUT_JENIS = ["51", "52", "53", "57"];

  /* ================= data ================= */
  function muat(path, ta) { return Monev.data.muatTahun("anggaran/" + path, ta); }
  function muatOpsional(path, ta) {
    return muat(path, ta).catch(function (err) { if (err.status === 404) return null; throw err; });
  }

  function pct(a, b) { return b ? (a / b) * 100 : null; }

  function lengkapi(r) {
    r.realOs = r.real + r.os;
    r.pct = pct(r.real, r.pagu);
    r.pct2 = pct(r.realOs, r.pagu);
    r.sisa = r.pagu - (r.blokir || 0) - r.realOs;
    return r;
  }

  function jumlahkan(rows) {
    var t = { pagu: 0, blokir: 0, real: 0, os: 0, adaBlokir: false };
    rows.forEach(function (r) {
      t.pagu += r.pagu; t.real += r.real; t.os += r.os;
      if (r.blokir != null) { t.blokir += r.blokir; t.adaBlokir = true; }
    });
    if (!t.adaBlokir) t.blokir = null;
    return lengkapi(t);
  }

  function urutPersen(a, b) { return (b.pct || 0) - (a.pct || 0); }

  /** Satu bentuk internal untuk dua bentuk file (baru dengan realisasi, lama FA16 saja). */
  function model(j) {
    if (j._model) return j._model;
    var m = { lengkap: !!(j.realisasi && j.realisasi.s4 && j.realisasi.s5), keg: [], unit: [], catatan: [] };
    var sumber = j.sumber || {};
    m.dataPer = j.data_per || sumber.myintress_unduh || j.tanggal || "";
    m.kontrakPer = sumber.kontrak_per || "";

    if (m.lengkap) {
      var R = j.realisasi;
      m.keg = R.s4.rows.map(function (r) {
        return lengkapi({ kode: r.unmapped ? "" : String(r.kode || r.kunci || ""), nama: r.unmapped ? "Belum terpetakan" : I().kegiatan(String(r.kode || r.kunci), r.nama),
          ket: r.unmapped ? String(r.nama || "").replace(/^Belum terpetakan\s*/, "") : "",
          pagu: +r.pagu || 0, blokir: +r.blokir || 0, real: +r.real || 0, os: +r.os || 0, unmapped: !!r.unmapped });
      });
      m.unit = R.s5.rows.map(function (r) {
        var nama = r.unmapped ? "Pusat, belum terpetakan" : I().unit(r.kunci || r.nama);
        return lengkapi({ unit: nama, kunci: r.kunci || r.nama, ket: r.unmapped ? String(r.nama || "").replace(/^.*?(–|-)\s*/, "") : "",
          pagu: +r.pagu || 0, blokir: +r.blokir || 0, real: +r.real || 0, os: +r.os || 0, unmapped: !!r.unmapped });
      });
      var s2 = R.s2 || {};
      m.total = lengkapi({ pagu: +s2.pagu || 0, blokir: +s2.blokir || 0, real: +s2.real || 0, os: +s2.os || 0 });
      m.hibah = +s2.manualBayar || 0;
      m.catatan = (R.s5.notes || []).slice();
      m.kontrakAktif = R.kontrak_aktif;
    } else {
      /* Bentuk lama: OS dari outstanding.by_kegiatan / by_seg5 / by_satker. */
      var O = j.outstanding || {};
      var osKeg = {}, osSeg = {}, osSat = {};
      (O.by_kegiatan || []).forEach(function (x) { osKeg[x.KDKEG] = (osKeg[x.KDKEG] || 0) + (+x.sisa_kontrak || 0); });
      (O.by_seg5 || []).forEach(function (x) { var k = x.KODE_SATKER + "|" + x.KDKEG; osSeg[k] = (osSeg[k] || 0) + (+x.sisa_kontrak || 0); });
      (O.by_satker || []).forEach(function (x) { osSat[x.KODE_SATKER] = (osSat[x.KODE_SATKER] || 0) + (+x.sisa_kontrak || 0); });
      m.keg = (j.kegiatan || []).map(function (r) {
        return lengkapi({ kode: String(r.KDKEG), nama: I().kegiatan(String(r.KDKEG), r.NAMA_KEGIATAN), pagu: +r.pagu || 0, blokir: null, real: +r.real || 0, os: osKeg[r.KDKEG] || 0 });
      }).sort(urutPersen);
      var pusat = I().SATKER_PUSAT;
      (j.satker_kegiatan || []).forEach(function (r) {
        if (String(r.KODE_SATKER) !== pusat) return;
        m.unit.push(lengkapi({ unit: I().unitDari(pusat, String(r.KDKEG)), kunci: "", pagu: +r.pagu || 0, blokir: null, real: +r.real || 0,
          os: osSeg[pusat + "|" + r.KDKEG] || 0 }));
      });
      (j.satker || []).forEach(function (r) {
        if (String(r.KODE_SATKER) === pusat) return;
        m.unit.push(lengkapi({ unit: I().satker(String(r.KODE_SATKER), r.DESKRIPSI_SATKER), kunci: "", pagu: +r.pagu || 0, blokir: null, real: +r.real || 0,
          os: osSat[r.KODE_SATKER] || 0 }));
      });
      m.unit.sort(urutPersen);
      var osTotal = O.summary ? +O.summary.sisa_kontrak || 0 : m.keg.reduce(function (s, r) { return s + r.os; }, 0);
      var sisaKeg = osTotal - m.keg.reduce(function (s, r) { return s + r.os; }, 0);
      if (sisaKeg > 1) m.keg.push(lengkapi({ kode: "", nama: "Belum terpetakan", ket: "", pagu: 0, blokir: null, real: 0, os: sisaKeg, unmapped: true }));
      var sisaUnit = osTotal - m.unit.reduce(function (s, r) { return s + r.os; }, 0);
      if (sisaUnit > 1) m.unit.push(lengkapi({ unit: "Pusat, belum terpetakan", kunci: "", ket: "", pagu: 0, blokir: null, real: 0, os: sisaUnit, unmapped: true }));
      var t = j.total || {};
      m.total = lengkapi({ pagu: +t.pagu || 0, blokir: null, real: +t.real || 0, os: osTotal });
      m.hibah = null;
      m.kontrakAktif = O.summary ? O.summary.jml_kontrak : null;
    }
    m.totalKeg = jumlahkan(m.keg);
    m.totalUnit = jumlahkan(m.unit);
    j._model = m;
    return m;
  }

  /* ================= potongan tampilan ================= */
  function persen(p) { return p == null ? "–" : F().persen(p); }
  function rpM(n) { return n == null ? "–" : F().rupiahM(n); }

  function kartu(label, nilai, ket, opsi) {
    opsi = opsi || {};
    return '<div class="kartu-angka"><span class="kartu-label">' + e(label) + '</span><span class="kartu-nilai">' + e(nilai) + "</span>" +
      (ket ? '<span class="kartu-ket' + (opsi.kelas ? " " + opsi.kelas : "") + '">' + e(ket) + "</span>" : "") + "</div>";
  }

  function seksi(judul, isi, opsi) {
    opsi = opsi || {};
    return '<section class="seksi' + (opsi.kelas ? " " + opsi.kelas : "") + '"><div class="seksi-kepala"><h2>' + e(judul) + "</h2>" +
      (opsi.kanan || (opsi.ket ? '<span class="seksi-keterangan">' + e(opsi.ket) + "</span>" : "")) + "</div>" + isi + "</section>";
  }

  function tombolCSV(nama) {
    return '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-csv="' + e(nama) + '">Unduh CSV</button>';
  }

  function tombolMasuk(label, utama, page) {
    var url = Monev.urlMasuk(page);
    var kelas = "tombol " + (utama ? "tombol-utama" : "tombol-sekunder");
    return url
      ? '<a class="' + kelas + '" href="' + e(url) + '" rel="noopener">' + e(label) + "</a>"
      : '<span class="' + kelas + '" role="link" aria-disabled="true" title="Halaman kerja belum tersedia (Tahap 4)">' + e(label) + "</span>";
  }

  function opsi(nilai, label, pilih) {
    return '<option value="' + e(nilai) + '"' + (String(nilai) === String(pilih) ? " selected" : "") + ">" + e(label) + "</option>";
  }

  function pilihan(id, label, kunci, isi) {
    return '<label class="sr-only" for="' + id + '">' + e(label) + '</label><select id="' + id + '" data-pilih="' + kunci + '">' + isi + "</select>";
  }

  function segmen(kunci, daftar, nilai, label) {
    return '<div class="segmen" role="group" aria-label="' + e(label) + '">' + daftar.map(function (d) {
      return '<button type="button" data-segmen="' + kunci + '" data-nilai="' + e(d[0]) + '" aria-pressed="' + (d[0] === nilai ? "true" : "false") + '">' + e(d[1]) + "</button>";
    }).join("") + "</div>";
  }

  function gapTeks(g) {
    if (g == null || !isFinite(g)) return "–";
    return '<span class="' + (g >= 0 ? "teks-ok" : "teks-bad") + '">' + e(F().selisihRupiah(g)) + "</span>";
  }

  function td(isi, angka, kelas) { return "<td" + (angka || kelas ? ' class="' + (angka ? "angka" : "") + (kelas ? " " + kelas : "") + '"' : "") + ">" + isi + "</td>"; }

  /* ================= TAB REALISASI ================= */
  function barBaris(label, r, mode) {
    var p = r.pagu || 0;
    var w1 = p ? Math.max(0, Math.min(100, (r.real / p) * 100)) : 0;
    var w2 = p && mode === "os" ? Math.max(0, Math.min(100 - w1, (r.os / p) * 100)) : 0;
    var angka = mode === "os" ? persen(r.pct2) : persen(r.pct);
    var aria = label + ": realisasi SP2D " + persen(r.pct) + (mode === "os" ? ", SP2D + outstanding " + persen(r.pct2) : "") + " dari pagu";
    return '<div class="baris-bar"><span class="baris-label">' + e(label) + '</span><div class="bar" role="img" aria-label="' + e(aria) + '">' +
      '<div class="bar-sp2d" style="width:' + w1 + '%"></div>' + (w2 ? '<div class="bar-os" style="width:' + w2 + '%"></div>' : "") + "</div>" +
      '<span class="baris-angka">' + angka + "</span></div>";
  }

  function legendaBar(mode) {
    return '<div class="legenda"><span><i class="bar-sp2d"></i>SP2D</span>' + (mode === "os" ? '<span><i class="bar-os"></i>Outstanding kontrak</span>' : "") + "</div>";
  }

  function tabelAnggaran(rows, total, kolomPertama, opsiT) {
    opsiT = opsiT || {};
    var kepala = "<thead><tr>" + kolomPertama.map(function (k) { return '<th scope="col">' + e(k) + "</th>"; }).join("") +
      '<th scope="col" class="angka">Pagu</th><th scope="col" class="angka">Blokir</th><th scope="col" class="angka">Realisasi SP2D</th><th scope="col" class="angka">%</th>' +
      '<th scope="col" class="angka">Outstanding</th><th scope="col" class="angka">SP2D + OS</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Sisa</th></tr></thead>';
    var badan = rows.map(function (r) {
      var kelas = (r.unmapped ? "redup" : "") + (opsiT.pilih && opsiT.pilih(r) ? " terpilih" : "");
      return '<tr' + (kelas.trim() ? ' class="' + kelas.trim() + '"' : "") + ">" + opsiT.sel(r) +
        td(r.unmapped ? "–" : rpM(r.pagu), 1) + td(!r.blokir || r.unmapped ? "–" : rpM(r.blokir), 1) + td(r.unmapped && !r.real ? "–" : rpM(r.real), 1) + td(r.unmapped ? "–" : persen(r.pct), 1) +
        td(rpM(r.os), 1) + td(rpM(r.realOs), 1) + td(r.unmapped ? "–" : persen(r.pct2), 1) + td(r.unmapped || r.blokir == null ? "–" : rpM(r.sisa), 1) + "</tr>";
    }).join("");
    var jumlah = '<tr class="jumlah">' + kolomPertama.map(function (k, i) { return "<td>" + (i === kolomPertama.length - 1 ? "Jumlah" : "") + "</td>"; }).join("") +
      td(rpM(total.pagu), 1) + td(rpM(total.blokir), 1) + td(rpM(total.real), 1) + td(persen(total.pct), 1) + td(rpM(total.os), 1) + td(rpM(total.realOs), 1) +
      td(persen(total.pct2), 1) + td(total.blokir == null ? "–" : rpM(total.sisa), 1) + "</tr>";
    return '<div class="wadah-tabel"><table class="tabel tabel-anggaran">' + kepala + "<tbody>" + (badan || '<tr><td colspan="10">Belum ada data.</td></tr>') + jumlah + "</tbody></table></div>";
  }

  function filterRealisasi(j, m) {
    var units = m.unit.filter(function (r) { return !r.unmapped; }).map(function (r) { return r.unit; }).sort(I().urutUnit);
    var kegs = m.keg.filter(function (r) { return !r.unmapped; }).map(function (r) { return r.kode; }).sort();
    var adaKom = Array.isArray(j.per_komoditas) && j.per_komoditas.length;
    var koms = adaKom ? unik(j.per_komoditas.map(function (r) { return I().komoditas(r.komoditas); })).sort(I().urutKomoditas) : [];
    var sumber = m.lengkap
      ? "MyIntress diunduh " + F().waktu(m.dataPer) + (m.kontrakPer ? " · kontrak per " + F().waktu(m.kontrakPer) : "")
      : "FA16 Segmen per " + F().tanggal(j.tanggal || m.dataPer);
    return '<div class="filter-bar" role="group" aria-label="Saring realisasi anggaran">' +
      segmen("mode", [["sp2d", "Realisasi SP2D"], ["os", "SP2D + outstanding"]], STATE.mode, "Ukuran grafik") +
      pilihan("f-anggaran-unit", "Unit kerja", "unit", opsi("", "Semua unit kerja", STATE.unit) + units.map(function (u) { return opsi(u, u, STATE.unit); }).join("")) +
      pilihan("f-anggaran-keg", "Kegiatan", "kegiatan", opsi("", "Semua kegiatan", STATE.kegiatan) +
        kegs.map(function (k) { return opsi(k, k + " " + I().kegiatanSingkat(k), STATE.kegiatan); }).join("")) +
      (adaKom ? pilihan("f-anggaran-kom", "Komoditas", "komoditas", opsi("", "Semua komoditas", STATE.komoditas) + koms.map(function (k) { return opsi(k, k, STATE.komoditas); }).join("")) : "") +
      '<span class="sumber">' + e(sumber) + "</span></div>";
  }

  function unik(arr) { var o = {}; arr.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }

  function realisasi(j) {
    var m = model(j);
    var html = filterRealisasi(j, m);

    /* kartu: total, atau satu unit kerja / satu kegiatan bila disaring */
    var r = m.total, namaPilih = "Ditjen Perkebunan";
    if (STATE.unit) { r = m.unit.filter(function (x) { return x.unit === STATE.unit; })[0] || r; namaPilih = STATE.unit; }
    else if (STATE.kegiatan) { r = m.keg.filter(function (x) { return x.kode === STATE.kegiatan; })[0] || r; namaPilih = STATE.kegiatan + " " + I().kegiatanSingkat(STATE.kegiatan); }
    var ketReal = rpM(r.real) + (r === m.total && m.hibah ? " · termasuk hibah" : "");
    var ketOs = r === m.total && m.kontrakAktif != null ? F().satuan(m.kontrakAktif, "kontrak aktif") : "dari database kontrak";
    html += '<section class="grid-kartu grid-kartu-padat" aria-label="Angka utama anggaran">' +
      kartu("Pagu", rpM(r.pagu), namaPilih) +
      kartu("Blokir", r.blokir == null ? "–" : rpM(r.blokir), r.blokir == null ? "belum tercatat di data ini" : "dari sheet pagu dan blokir") +
      kartu("Realisasi SP2D", persen(r.pct), ketReal) +
      kartu("Outstanding kontrak", rpM(r.os), ketOs) +
      kartu("SP2D + outstanding", persen(r.pct2), rpM(r.realOs) + " · potensi serapan") +
      kartu("Sisa anggaran", r.blokir == null ? "–" : rpM(r.sisa), "Pagu − blokir − (SP2D + OS)") +
      "</section>";
    if (!m.lengkap) html += '<p class="catatan">Data ini masih bentuk lama (FA16 Segmen): blokir dan tambahan realisasi hibah belum tercatat, unit kerja Pusat diturunkan dari kode kegiatan. Angka slide 4 dan 5 tampil setelah data realisasi diterbitkan dari halaman kerja.</p>';
    if (STATE.unit || STATE.kegiatan) html += '<p class="catatan">Kartu angka mengikuti saringan; tabel di bawah tetap utuh seperti paparan, baris terpilih ditandai.</p>';

    /* grafik batang, urutan baku */
    var kegBar = m.keg.filter(function (x) { return !x.unmapped; }).slice().sort(function (a, b) { return a.kode < b.kode ? -1 : 1; });
    var unitBar = m.unit.filter(function (x) { return !x.unmapped; }).slice().sort(function (a, b) { return I().urutUnit(a.unit, b.unit); });
    html += '<div class="grid-dua">' +
      seksi("Realisasi per kegiatan", legendaBar(STATE.mode) + kegBar.map(function (x) { return barBaris(x.kode + " " + I().kegiatanSingkat(x.kode, x.nama), x, STATE.mode); }).join("")) +
      seksi("Realisasi per unit kerja", legendaBar(STATE.mode) + unitBar.map(function (x) { return barBaris(x.unit, x, STATE.mode); }).join("")) +
      "</div>";

    /* slide 4 */
    html += seksi("Realisasi kegiatan Ditjen Perkebunan",
      '<span class="seksi-keterangan">' + (m.lengkap ? "Sama dengan slide 4 paparan" : "Diturunkan dari FA16 Segmen") + " · blokir dan tambahan hibah diubah admin</span>" +
      tabelAnggaran(m.keg, m.totalKeg, ["Kode", "Kegiatan"], {
        pilih: function (x) { return STATE.kegiatan && x.kode === STATE.kegiatan; },
        sel: function (x) {
          return '<td class="mono">' + e(x.kode || "–") + "</td><td>" + e(x.nama) + (x.ket ? ' <span class="teks-redup">' + e(x.ket) + "</span>" : "") + "</td>";
        }
      }) +
      '<p class="catatan">Realisasi SP2D = realisasi MyIntress + tambahan realisasi hibah yang belum tercatat di MyIntress. Outstanding = sisa semua kontrak aktif, termasuk kontrak selesai yang belum lunas. Baris diurutkan dari % realisasi SP2D tertinggi, seperti paparan.</p>',
      { kanan: tombolCSV("kegiatan") });

    /* slide 5 */
    html += seksi("Realisasi kegiatan per unit kerja",
      '<span class="seksi-keterangan">' + (m.lengkap ? "Sama dengan slide 5 paparan" : "Diturunkan dari FA16 Segmen") + " · klik unit kerja untuk melihat kontraknya</span>" +
      tabelAnggaran(m.unit, m.totalUnit, ["Unit kerja"], {
        pilih: function (x) { return STATE.unit && x.unit === STATE.unit; },
        sel: function (x) {
          if (x.unmapped) return "<td>" + e(x.unit) + (x.ket ? ' <span class="teks-redup">' + e(x.ket) + "</span>" : "") + "</td>";
          return '<td><button type="button" class="tautan-sel" data-ke-kontrak="' + e(x.unit) + '">' + e(x.unit) + "</button></td>";
        }
      }) +
      (m.catatan.length ? m.catatan.map(function (c) { return '<p class="catatan">' + e(c) + "</p>"; }).join("") : "") +
      '<p class="catatan">Kontrak dengan kode kegiatan tidak valid tampil sebagai "Pusat, belum terpetakan"; outstanding-nya tetap masuk jumlah.</p>',
      { kanan: tombolCSV("unit") });

    /* per komoditas */
    html += komoditas(j);

    /* ekspor */
    html += seksi("Ekspor", '<div class="grid-ekspor">' +
      '<div class="kotak-ekspor"><h3>Paparan realisasi (.pptx)</h3><ol><li>Cover</li><li>Ringkasan eksekutif</li><li>Status kontrak</li><li>Realisasi per kegiatan</li><li>Realisasi per unit kerja</li><li>Penutup</li></ol>' +
        '<p class="catatan">Paparan PPT sementara masih dibuat di halaman kerja (tombol Halaman kerja).</p>' +
        '<div class="baris-alat"><span class="tombol tombol-ppt" role="link" aria-disabled="true" title="Paparan PPT dibuat di halaman kerja">Unduh PPT</span></div></div>' +
      '<div class="kotak-ekspor"><h3>Excel realisasi (.xlsx)</h3><ul><li>Ringkasan (slide 2)</li><li>Per kegiatan (slide 4), dengan rumus %, SP2D + OS, sisa</li><li>Per unit kerja (slide 5)</li></ul>' +
        '<div class="baris-alat"><button type="button" class="tombol tombol-utama" data-excel>Unduh Excel</button><span class="catatan" id="pesan-excel" role="status"></span></div></div>' +
      "</div>");
    return html;
  }

  function komoditas(j) {
    var data = Array.isArray(j.per_komoditas) ? j.per_komoditas : null;
    var ket = "Pagu dan SP2D dari FA16 Segmen (sub-komponen) · outstanding dari database kontrak";
    if (!data || !data.length) {
      return seksi("Realisasi bantuan per komoditas",
        '<p class="paragraf-kecil">Tabel ini tampil setelah data FA16 Segmen diterbitkan dengan kolom komoditas dan sumber dana (Reguler dan ABT sebagai baris terpisah). Data saat ini belum memuat kolom itu.</p>',
        { ket: ket });
    }
    var rows = data.map(function (r) {
      return lengkapi({ kom: I().komoditas(r.komoditas), jenis: r.jenis || "–", dana: r.sumber_dana || "", pagu: +r.pagu || 0, blokir: null, real: +r.sp2d || +r.real || 0, os: +r.os || +r.outstanding || 0 });
    }).filter(function (r) { return !STATE.komoditas || r.kom === STATE.komoditas; })
      .sort(function (a, b) { return I().urutKomoditas(a.kom, b.kom) || (a.dana < b.dana ? -1 : 1); });
    var t = jumlahkan(rows);
    var badan = rows.map(function (r) {
      var chip = /ABT/i.test(r.dana) ? ' <span class="chip chip-abt">ABT</span>' : r.dana ? ' <span class="chip chip-ok">Reguler</span>' : "";
      return "<tr><td>" + e(r.kom) + chip + "</td><td>" + e(r.jenis) + "</td>" + td(rpM(r.pagu), 1) + td(rpM(r.real), 1) + td(persen(r.pct), 1) +
        td(rpM(r.os), 1) + td(rpM(r.realOs), 1) + td(persen(r.pct2), 1) + "</tr>";
    }).join("");
    return seksi("Realisasi bantuan per komoditas",
      '<span class="seksi-keterangan">' + e(ket) + "</span>" +
      '<div class="wadah-tabel"><table class="tabel tabel-sedang"><thead><tr><th scope="col">Komoditas</th><th scope="col">Jenis bantuan</th><th scope="col" class="angka">Pagu</th>' +
      '<th scope="col" class="angka">Realisasi SP2D</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Outstanding</th><th scope="col" class="angka">SP2D + OS</th><th scope="col" class="angka">%</th></tr></thead><tbody>' +
      (badan || '<tr><td colspan="8">Tidak ada data untuk saringan ini.</td></tr>') +
      '<tr class="jumlah"><td>Jumlah</td><td></td>' + td(rpM(t.pagu), 1) + td(rpM(t.real), 1) + td(persen(t.pct), 1) + td(rpM(t.os), 1) + td(rpM(t.realOs), 1) + td(persen(t.pct2), 1) + "</tr></tbody></table></div>" +
      '<p class="catatan">Sub-komponen digabung sesuai aturan integrasi: kelapa dalam, genjah, dan genjah khusus menjadi Kelapa; arabika, robusta, dan liberika menjadi Kopi. Anggaran di luar bantuan komoditas tidak masuk tabel ini.</p>',
      { kanan: tombolCSV("komoditas") });
  }

  /* ---------- Excel (SheetJS dari CDN, dimuat saat diminta) ---------- */
  var SHEETJS = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var janjiSheetJS = null;
  function muatSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!janjiSheetJS) {
      janjiSheetJS = new Promise(function (ok, gagal) {
        var s = document.createElement("script");
        s.src = SHEETJS; s.async = true; s.crossOrigin = "anonymous";
        s.onload = function () { ok(window.XLSX); };
        s.onerror = function () { janjiSheetJS = null; gagal(new Error("Pustaka Excel gagal dimuat")); };
        document.head.appendChild(s);
      });
    }
    return janjiSheetJS;
  }

  /* SheetJS edisi komunitas tidak menulis panel beku; baris judul dibekukan dengan menyunting XML tiap sheet (DESIGN §7). */
  function simpanXlsx(X, wb, nama) {
    var data = new Uint8Array(X.write(wb, { type: "array", bookType: "xlsx" }));
    try {
      var zip = X.CFB.read(data, { type: "buffer" });
      var beku = '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>';
      zip.FullPaths.forEach(function (p, i) {
        if (!/\/xl\/worksheets\/sheet\d+\.xml$/.test(p)) return;
        var xml = new TextDecoder().decode(zip.FileIndex[i].content);
        zip.FileIndex[i].content = new TextEncoder().encode(xml.replace('<sheetView workbookViewId="0"/>', beku));
      });
      data = X.CFB.write(zip, { fileType: "zip", type: "array" });
    } catch (er) { /* bila gagal, simpan tanpa panel beku */ }
    var blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function unduhExcel(j, ta) {
    var m = model(j), pesan = document.getElementById("pesan-excel");
    if (pesan) pesan.textContent = "Menyiapkan Excel…";
    muatSheetJS().then(function (X) {
      var RP = "#,##0", PC = "0.0%";
      var n = function (v) { return { t: "n", v: v == null ? 0 : v, z: RP }; };
      /* rumus + nilai tersimpan (cached), supaya pembaca yang tidak menghitung ulang tetap melihat angka */
      var f = function (rumus, v, z) { return { t: "n", f: rumus, v: v == null || !isFinite(v) ? 0 : v, z: z || RP }; };
      var bagi = function (a, b) { return b ? a / b : 0; };
      var s = function (v) { return { t: "s", v: String(v == null ? "" : v) }; };

      function lembarTabel(judulKolom, rows, total, namaBaris) {
        var aoa = [judulKolom.concat(["Pagu (Rp)", "Blokir (Rp)", "Realisasi SP2D (Rp)", "% SP2D", "Outstanding (Rp)", "SP2D + OS (Rp)", "% SP2D + OS", "Sisa (Rp)"]).map(s)];
        var o = judulKolom.length, kol = function (i) { return String.fromCharCode(65 + o + i); };
        rows.forEach(function (r, i) {
          var b = i + 2;
          var p = r.unmapped ? 0 : r.pagu, bl = r.blokir || 0;
          aoa.push(namaBaris(r).map(s).concat([n(p), n(bl), n(r.real),
            f("IF(" + kol(0) + b + "=0,0," + kol(2) + b + "/" + kol(0) + b + ")", bagi(r.real, p), PC), n(r.os), f(kol(2) + b + "+" + kol(4) + b, r.real + r.os),
            f("IF(" + kol(0) + b + "=0,0," + kol(5) + b + "/" + kol(0) + b + ")", bagi(r.real + r.os, p), PC), f(kol(0) + b + "-" + kol(1) + b + "-" + kol(5) + b, p - bl - r.real - r.os)]));
        });
        var akhir = rows.length + 1, bj = rows.length + 2;
        var sum = function (i, v) { return f("SUM(" + kol(i) + "2:" + kol(i) + akhir + ")", v); };
        var tb = total.blokir || 0;
        aoa.push(judulKolom.map(function (_, i) { return s(i === judulKolom.length - 1 ? "Jumlah" : ""); }).concat([sum(0, total.pagu), sum(1, tb), sum(2, total.real),
          f("IF(" + kol(0) + bj + "=0,0," + kol(2) + bj + "/" + kol(0) + bj + ")", bagi(total.real, total.pagu), PC), sum(4, total.os), sum(5, total.realOs),
          f("IF(" + kol(0) + bj + "=0,0," + kol(5) + bj + "/" + kol(0) + bj + ")", bagi(total.realOs, total.pagu), PC), f(kol(0) + bj + "-" + kol(1) + bj + "-" + kol(5) + bj, total.pagu - tb - total.realOs)]));
        var ws = X.utils.aoa_to_sheet(aoa);
        ws["!cols"] = judulKolom.map(function (_, i) { return { wch: i === judulKolom.length - 1 ? 52 : 10 }; }).concat([18, 16, 20, 9, 18, 18, 11, 18].map(function (w) { return { wch: w }; }));
        ws["!views"] = [{ state: "frozen", ySplit: 1 }];
        return ws;
      }

      var t = m.total;
      var ring = X.utils.aoa_to_sheet([
        [s("Realisasi anggaran Ditjen Perkebunan TA " + ta), s("")],
        [s("Data per"), s(F().waktu(m.dataPer))],
        [s("Pagu (Rp)"), n(t.pagu)],
        [s("Blokir (Rp)"), n(t.blokir)],
        [s("Realisasi SP2D (Rp)"), n(t.real)],
        [s("% realisasi SP2D"), f("IF(B3=0,0,B5/B3)", bagi(t.real, t.pagu), PC)],
        [s("Outstanding kontrak (Rp)"), n(t.os)],
        [s("SP2D + OS (Rp)"), f("B5+B7", t.realOs)],
        [s("% SP2D + OS"), f("IF(B3=0,0,B8/B3)", bagi(t.realOs, t.pagu), PC)],
        [s("Sisa anggaran (Rp)"), f("B3-B4-B8", t.pagu - (t.blokir || 0) - t.realOs)],
        [s("Sisa anggaran = pagu − blokir − (SP2D + OS). Realisasi SP2D termasuk tambahan realisasi hibah."), s("")]
      ]);
      ring["!cols"] = [{ wch: 34 }, { wch: 24 }];
      ring["!views"] = [{ state: "frozen", ySplit: 1 }];
      var wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ring, "Ringkasan");
      X.utils.book_append_sheet(wb, lembarTabel(["Kode", "Kegiatan"], m.keg, m.totalKeg, function (r) { return [r.kode, r.nama + (r.ket ? " " + r.ket : "")]; }), "Per kegiatan");
      X.utils.book_append_sheet(wb, lembarTabel(["Unit kerja"], m.unit, m.totalUnit, function (r) { return [r.unit + (r.ket ? " " + r.ket : "")]; }), "Per unit kerja");
      simpanXlsx(X, wb, "realisasi-anggaran-" + String(m.dataPer).slice(0, 10) + ".xlsx");
      if (pesan) pesan.textContent = "";
    }).catch(function (err) {
      if (pesan) pesan.textContent = err.message + ". Periksa sambungan internet lalu coba lagi.";
    });
  }

  /* ================= TAB RINCIAN ================= */
  function cocok(r) {
    var R = STATE.rinci;
    return (!R.kegiatan || String(r.KDKEG) === R.kegiatan) && (!R.kro || String(r.S05) === R.kro);
  }

  function kumpul(rows, kunci) {
    var d = {}, urut = [];
    rows.forEach(function (r) {
      var k = kunci.map(function (x) { return r[x]; }).join("|");
      if (!d[k]) { d[k] = { pagu: 0, real: 0 }; kunci.forEach(function (x) { d[k][x] = r[x]; }); urut.push(k); }
      d[k].pagu += +r.pagu || 0; d[k].real += +r.real || 0;
    });
    return urut.map(function (k) { return d[k]; });
  }

  function dataRinci(j) {
    var sat = STATE.rinci.satker;
    var pilihSat = function (arr) { return (arr || []).filter(function (r) { return !sat || String(r.KODE_SATKER) === sat; }); };
    var L = {
      0: sat ? pilihSat(j.satker_kegiatan) : (j.kegiatan || []),
      1: sat ? kumpul(pilihSat(j.satker_ro), ["KDKEG", "S05"]) : (j.kro || []),
      2: sat ? pilihSat(j.satker_ro) : (j.ro || []),
      3: sat ? pilihSat(j.satker_komponen) : (j.komponen || []),
      // kode sub-komponen SAKTI hanya unik di dalam satu satker: jangan digabung antarsatker
      4: kumpul(pilihSat(j.satker_subkomponen), ["KODE_SATKER", "KDKEG", "S05", "S13", "S14", "S15", "NAMA_SUBKOMPONEN"])
    };
    Object.keys(L).forEach(function (k) {
      L[k] = L[k].filter(function (r) { return (!STATE.rinci.kegiatan || String(r.KDKEG) === STATE.rinci.kegiatan) && (k === "0" || cocok(r)); });
    });
    return L;
  }

  var KUNCI_TINGKAT = [["KDKEG"], ["KDKEG", "S05"], ["KDKEG", "S05", "S13"], ["KDKEG", "S05", "S13", "S14"], ["KDKEG", "S05", "S13", "S14", "S15", "KODE_SATKER"]];
  var NAMA_TINGKAT = ["Kegiatan", "KRO", "RO", "Komponen", "Sub-komponen"];

  function kunciDari(r, t) { return KUNCI_TINGKAT[t].map(function (x) { return r[x]; }).join("|"); }

  function pohon(j) {
    var L = dataRinci(j);
    var namaKro = {}, namaRo = {}, namaKomp = {};
    (j.kro || []).forEach(function (r) { namaKro[r.S05] = r.NAMA_KRO; });
    (j.ro || []).concat(j.satker_ro || []).forEach(function (r) { namaRo[r.S05 + "|" + r.S13] = r.NAMA_RO; });
    (j.komponen || []).concat(j.satker_komponen || []).forEach(function (r) { namaKomp[r.S05 + "|" + r.S13 + "|" + r.S14] = r.NAMA_KOMPONEN; });
    var anak = {};
    for (var t = 1; t <= 4; t++) {
      L[t].forEach(function (r) {
        var induk = kunciDari(r, t - 1);
        (anak[induk] = anak[induk] || []).push(r);
      });
    }
    function kode(r, t) {
      if (t === 0) return String(r.KDKEG);
      if (t === 1) return String(r.S05).indexOf(String(r.KDKEG)) === 0 ? String(r.KDKEG) + "." + String(r.S05).slice(String(r.KDKEG).length) : String(r.S05);
      return String([r.S13, r.S14, r.S15][t - 2]);
    }
    function uraian(r, t) {
      if (t === 0) return I().kegiatan(String(r.KDKEG), r.NAMA_KEGIATAN);
      if (t === 1) return namaKro[r.S05] || r.NAMA_KRO || "–";
      if (t === 2) return namaRo[r.S05 + "|" + r.S13] || r.NAMA_RO || "–";
      if (t === 3) return namaKomp[r.S05 + "|" + r.S13 + "|" + r.S14] || r.NAMA_KOMPONEN || "–";
      var nm = r.NAMA_SUBKOMPONEN ? String(r.NAMA_SUBKOMPONEN).replace(/\s+/g, " ").trim() : "Sub-komponen " + r.S15;
      return STATE.rinci.satker ? nm : nm + " · " + I().satker(String(r.KODE_SATKER));
    }
    var keluar = [];
    function jalan(rows, t) {
      rows.slice().sort(function (a, b) {
        var x = kode(a, t), y = kode(b, t);
        if (x === y && t === 4) return I().urutSatker(String(a.KODE_SATKER), String(b.KODE_SATKER));
        return x < y ? -1 : x > y ? 1 : 0;
      }).forEach(function (r) {
        var k = kunciDari(r, t), punyaAnak = t < 4 && (anak[k] || []).length > 0;
        var buka = !!STATE.rinci.buka[k];
        keluar.push({ t: t, k: k, kode: kode(r, t), uraian: uraian(r, t), pagu: +r.pagu || 0, real: +r.real || 0, anak: punyaAnak, buka: buka });
        if (punyaAnak && buka) jalan(anak[k], t + 1);
      });
    }
    jalan(L[0], 0);
    var tot = L[0].reduce(function (s, r) { s.pagu += +r.pagu || 0; s.real += +r.real || 0; return s; }, { pagu: 0, real: 0 });
    return { baris: keluar, total: tot, L: L };
  }

  function sumberAkun(j) {
    var R = STATE.rinci, rows;
    if (R.satker) rows = (j.satker_akun_kegiatan || []).filter(function (r) { return String(r.KODE_SATKER) === R.satker && (!R.kegiatan || String(r.KDKEG) === R.kegiatan); });
    else if (R.kegiatan) rows = (j.akun_kegiatan || []).filter(function (r) { return String(r.KDKEG) === R.kegiatan; });
    else rows = j.akun || [];
    var nama = {};
    (j.akun || []).concat(j.akun_kegiatan || []).forEach(function (r) { if (r.NAMA_AKUN) nama[r.S03] = r.NAMA_AKUN; });
    return kumpul(rows, ["S03"]).map(function (r) { r.nama = nama[r.S03] || r.NAMA_AKUN || "–"; return r; })
      .sort(function (a, b) { return a.S03 < b.S03 ? -1 : 1; });
  }

  /*
   * Tabel akun dibagi per halaman, 10 akun per halaman (pilihan pemilik portal 15 Nov 2026).
   * Kartu Komposisi di sebelahnya ikut setinggi kartu akun (grid). Baris Jumlah selalu tampil
   * dan tetap menjumlah semua akun pada saringan.
   */
  var AKUN_PER_HAL = 10;
  function halamanAkun(el) {
    var sa = el.querySelector(".seksi-akun");
    if (!sa) return;
    var rows = Array.prototype.slice.call(sa.querySelectorAll("tr[data-akun-baris]"));
    var pager = sa.querySelector("[data-pager-akun]");
    var batas = [0];
    for (var i = AKUN_PER_HAL; i < rows.length; i += AKUN_PER_HAL) batas.push(i);
    var jml = batas.length, R = STATE.rinci;
    if (R.akunHal >= jml) R.akunHal = jml - 1;
    if (R.akunHal < 0) R.akunHal = 0;
    var dari = batas[R.akunHal], ke = R.akunHal + 1 < jml ? batas[R.akunHal + 1] : rows.length;
    rows.forEach(function (r, n) { r.hidden = n < dari || n >= ke; });
    pager.hidden = jml < 2;
    sa.querySelector("[data-akun-ket]").textContent = "Halaman " + (R.akunHal + 1) + " dari " + jml + " · akun " + (dari + 1) + "–" + ke + " dari " + rows.length;
    pager.querySelector('[data-akun-hal="-1"]').disabled = R.akunHal === 0;
    pager.querySelector('[data-akun-hal="1"]').disabled = R.akunHal >= jml - 1;
  }

  function jenisDari(akun) { var k = String(akun).slice(0, 2); return JENIS[k] ? k : "lain"; }

  function rincian(j) {
    if (!j.kegiatan && !j.satker_kegiatan) {
      return Monev.data.tampil.kosong("Rincian RO dan akun belum tersedia",
        "Rincian ini dibaca dari data FA16 Segmen, yang belum ada di data anggaran TA ini.", { label: "Unggah data FA16 Segmen", href: "#unggah" });
    }
    var R = STATE.rinci;
    var satkers = unik((j.satker || []).map(function (r) { return String(r.KODE_SATKER); })).sort(I().urutSatker);
    var kegs = unik((j.kegiatan || j.satker_kegiatan || []).map(function (r) { return String(r.KDKEG); })).sort();
    var kros = (j.kro || []).filter(function (r) { return !R.kegiatan || String(r.KDKEG) === R.kegiatan; });
    var html = '<div class="filter-bar" role="group" aria-label="Saring rincian anggaran">' +
      pilihan("f-rinci-satker", "Satker", "r-satker", opsi("", "Semua satker", R.satker) + satkers.map(function (s) { return opsi(s, I().satker(s), R.satker); }).join("")) +
      pilihan("f-rinci-keg", "Kegiatan", "r-kegiatan", opsi("", "Semua kegiatan", R.kegiatan) + kegs.map(function (k) { return opsi(k, k + " " + I().kegiatanSingkat(k), R.kegiatan); }).join("")) +
      pilihan("f-rinci-kro", "KRO", "r-kro", opsi("", "Semua KRO", R.kro) + kros.map(function (r) { return opsi(r.S05, r.S05 + " " + (r.NAMA_KRO || ""), R.kro); }).join("")) +
      '<span class="sumber">FA16 Segmen per ' + e(F().tanggal(j.tanggal || j.data_per)) + "</span></div>";

    /* pohon */
    var P = pohon(j);
    var badan = P.baris.map(function (b) {
      var tombol = b.anak
        ? '<button type="button" class="tombol-buka" data-buka="' + e(b.k) + '" aria-expanded="' + (b.buka ? "true" : "false") + '" aria-label="' + (b.buka ? "Tutup " : "Buka ") + e(NAMA_TINGKAT[b.t] + " " + b.kode) + '">' + (b.buka ? "▾" : "▸") + "</button>"
        : '<span class="tombol-buka-kosong"></span>';
      return '<tr class="tingkat-' + b.t + '"><td class="mono"><span class="tingkat-sel" style="padding-left:' + (18 * b.t) + 'px">' + tombol + "<span>" + e(b.kode) + "</span></span></td>" +
        '<td class="sel-uraian">' + e(b.uraian) + "</td><td>" + NAMA_TINGKAT[b.t] + "</td>" +
        td(rpM(b.pagu), 1) + td(rpM(b.real), 1) + td(persen(pct(b.real, b.pagu)), 1) + td(rpM(b.pagu - b.real), 1) + "</tr>";
    }).join("");
    html += seksi("Rincian kegiatan sampai sub-komponen",
      '<p class="catatan">Klik ▸ untuk membuka tingkat di bawahnya · anggaran mengikuti RAW SAKTI' + (R.kro ? " · saringan KRO berlaku mulai tingkat KRO" : "") + "</p>" +
      '<div class="baris-alat"><button type="button" class="tombol tombol-sekunder tombol-kecil" data-buka-semua="1">Buka semua</button>' +
      '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-buka-semua="0">Tutup semua</button></div>' +
      '<div class="wadah-tabel"><table class="tabel tabel-anggaran"><thead><tr><th scope="col">Kode</th><th scope="col">Uraian</th><th scope="col">Tingkat</th>' +
      '<th scope="col" class="angka">Pagu</th><th scope="col" class="angka">Realisasi SP2D</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Sisa</th></tr></thead><tbody>' +
      (badan || '<tr><td colspan="7">Tidak ada anggaran untuk saringan ini.</td></tr>') +
      '<tr class="jumlah"><td></td><td>Jumlah</td><td></td>' + td(rpM(P.total.pagu), 1) + td(rpM(P.total.real), 1) + td(persen(pct(P.total.real, P.total.pagu)), 1) + td(rpM(P.total.pagu - P.total.real), 1) + "</tr>" +
      "</tbody></table></div>" +
      '<p class="catatan">Sisa di tabel ini = pagu − realisasi SP2D (tanpa blokir dan outstanding, karena keduanya tidak tercatat per RO). Realisasi di sini dari FA16 Segmen, belum termasuk tambahan realisasi hibah, sehingga bisa lebih kecil dari tab Realisasi anggaran. Saringan Reguler/ABT dan komoditas tampil setelah data FA16 memuat kolom itu.</p>',
      { kanan: tombolCSV("rincian") });

    /* akun */
    var akun = sumberAkun(j);
    var akunTampil = akun.filter(function (r) { return !R.jenis || jenisDari(r.S03) === R.jenis; });
    var tAkun = akunTampil.reduce(function (s, r) { s.pagu += r.pagu; s.real += r.real; return s; }, { pagu: 0, real: 0 });
    var tabAkun = '<div class="pilih-jenis" role="group" aria-label="Jenis belanja">' +
      [["", "Semua"]].concat(URUT_JENIS.map(function (k) { return [k, k + " " + JENIS[k]]; })).map(function (d) {
        return '<button type="button" data-jenis="' + d[0] + '" aria-pressed="' + (R.jenis === d[0] ? "true" : "false") + '">' + e(d[1]) + "</button>";
      }).join("") + "</div>" +
      '<div class="wadah-tabel"><table class="tabel tabel-kecil"><thead><tr><th scope="col">Akun</th><th scope="col">Nama akun</th><th scope="col" class="angka">Pagu</th>' +
      '<th scope="col" class="angka">SP2D</th><th scope="col" class="angka">%</th></tr></thead><tbody>' +
      (akunTampil.map(function (r) {
        return '<tr data-akun-baris><td class="mono">' + e(r.S03) + "</td><td>" + e(r.nama) + "</td>" + td(rpM(r.pagu), 1) + td(rpM(r.real), 1) + td(persen(pct(r.real, r.pagu)), 1) + "</tr>";
      }).join("") || '<tr><td colspan="5">Tidak ada akun untuk saringan ini.</td></tr>') +
      '<tr class="jumlah"><td></td><td>Jumlah</td>' + td(rpM(tAkun.pagu), 1) + td(rpM(tAkun.real), 1) + td(persen(pct(tAkun.real, tAkun.pagu)), 1) + "</tr></tbody></table></div>" +
      (R.kro ? '<p class="catatan">Saringan KRO tidak berlaku untuk akun (data akun tidak dirinci per KRO).</p>' : "") +
      '<div class="pager-akun" data-pager-akun hidden><button type="button" class="tombol tombol-sekunder tombol-kecil" data-akun-hal="-1">‹ Sebelumnya</button>' +
      '<span aria-live="polite" data-akun-ket></span><button type="button" class="tombol tombol-sekunder tombol-kecil" data-akun-hal="1">Berikutnya ›</button></div>';

    /* komposisi */
    var perJenis = {};
    akun.forEach(function (r) { var k = jenisDari(r.S03); perJenis[k] = perJenis[k] || { pagu: 0, real: 0 }; perJenis[k].pagu += r.pagu; perJenis[k].real += r.real; });
    var paguAkun = akun.reduce(function (s, r) { return s + r.pagu; }, 0);
    var urutJ = URUT_JENIS.concat(["lain"]).filter(function (k) { return perJenis[k]; });
    var namaJ = function (k) { return k === "lain" ? "Lainnya" : k + " " + JENIS[k]; };
    var barKomp = '<div class="bar-komposisi" role="img" aria-label="' + e("Komposisi pagu: " + urutJ.map(function (k) { return namaJ(k) + " " + persen(pct(perJenis[k].pagu, paguAkun)); }).join(", ")) + '">' +
      urutJ.map(function (k) { return '<div class="jenis-' + k + '" style="width:' + (paguAkun ? (perJenis[k].pagu / paguAkun) * 100 : 0) + '%"></div>'; }).join("") + "</div>" +
      '<div class="legenda">' + urutJ.map(function (k) { return '<span><i class="jenis-' + k + '"></i>' + e(namaJ(k)) + " " + persen(pct(perJenis[k].pagu, paguAkun)) + "</span>"; }).join("") + "</div>";

    var kw = kewenangan(j);
    var kolomKw = kw.kolom;
    var tabelKw = '<div class="wadah-tabel"><table class="tabel"><thead><tr><th scope="col">Jenis belanja</th>' +
      kolomKw.map(function (k) { return '<th scope="col" class="angka">' + k + "</th>"; }).join("") + '<th scope="col" class="angka">Jumlah</th></tr></thead><tbody>' +
      (kw.jenis.map(function (k) {
        var x = kw.isi[k], jml = kolomKw.reduce(function (s, c) { return s + (x[c] || 0); }, 0);
        return "<tr><td>" + e(namaJ(k)) + "</td>" + kolomKw.map(function (c) { return td(rpM(x[c] || 0), 1); }).join("") + td(rpM(jml), 1) + "</tr>";
      }).join("") || '<tr><td colspan="' + (kolomKw.length + 2) + '">Tidak ada data untuk saringan ini.</td></tr>') +
      '<tr class="jumlah"><td>Jumlah</td>' + kolomKw.map(function (c) { return td(rpM(kw.tot[c] || 0), 1); }).join("") +
      td(rpM(kolomKw.reduce(function (s, c) { return s + (kw.tot[c] || 0); }, 0)), 1) + "</tr></tbody></table></div>" +
      '<p class="catatan">KP kantor pusat (satker 238830) · KD kantor daerah (balai)' + (kolomKw.indexOf("DK") >= 0 ? " · DK dekonsentrasi" : "") + (kolomKw.indexOf("TP") >= 0 ? " · TP tugas pembantuan" : "") +
      ". Kolom DK dan TP tampil bila datanya ada.</p>";

    html += '<div class="grid-dua">' +
      seksi("Realisasi per akun belanja", tabAkun, { kanan: tombolCSV("akun"), kelas: "seksi-akun" }) +
      seksi("Komposisi belanja dan pagu", '<h3 class="subjudul">Per jenis belanja (% dari pagu)</h3>' + barKomp +
        '<h3 class="subjudul">Realisasi SP2D per jenis belanja dan kewenangan</h3>' + tabelKw, { kanan: tombolCSV("kewenangan"), kelas: "seksi-komposisi" }) +
      "</div>";

    /* satker × kegiatan */
    var mx = matriks(j);
    html += seksi("Realisasi per satker × kegiatan",
      '<p class="catatan">% realisasi SP2D terhadap pagu · sel kosong berarti satker tidak punya pagu di kegiatan itu</p>' +
      '<div class="wadah-tabel"><table class="tabel tabel-sedang"><thead><tr><th scope="col">Satker</th>' +
      mx.kegs.map(function (k) { return '<th scope="col" class="angka" title="' + e(I().kegiatan(k)) + '">' + e(k) + "</th>"; }).join("") + '<th scope="col" class="angka">Jumlah</th></tr></thead><tbody>' +
      mx.sats.map(function (s) {
        var baris = mx.isi[s] || {}, tot = { pagu: 0, real: 0 };
        return "<tr><td>" + e(I().satker(s)) + "</td>" + mx.kegs.map(function (k) {
          var x = baris[k]; if (!x || !x.pagu) return td("", 1);
          tot.pagu += x.pagu; tot.real += x.real;
          return td(persen(pct(x.real, x.pagu)), 1);
        }).join("") + td("<strong>" + persen(pct(tot.real, tot.pagu)) + "</strong>", 1) + "</tr>";
      }).join("") +
      '<tr class="jumlah"><td>Jumlah</td>' + mx.kegs.map(function (k) { var x = mx.perKeg[k]; return td(x && x.pagu ? persen(pct(x.real, x.pagu)) : "", 1); }).join("") +
      td(persen(pct(mx.tot.real, mx.tot.pagu)), 1) + "</tr></tbody></table></div>",
      { kanan: tombolCSV("matriks") });
    return html;
  }

  function kewenangan(j) {
    var R = STATE.rinci, pusat = I().SATKER_PUSAT;
    var rows = (j.satker_akun_kegiatan || []).filter(function (r) {
      return (!R.satker || String(r.KODE_SATKER) === R.satker) && (!R.kegiatan || String(r.KDKEG) === R.kegiatan);
    });
    var isi = {}, tot = {}, ada = {};
    rows.forEach(function (r) {
      var k = jenisDari(r.S03), c = r.S08 ? ({ "1": "KP", "2": "KD", "3": "DK", "4": "TP" }[String(r.S08)] || "KD") : (String(r.KODE_SATKER) === pusat ? "KP" : "KD");
      isi[k] = isi[k] || {}; isi[k][c] = (isi[k][c] || 0) + (+r.real || 0); tot[c] = (tot[c] || 0) + (+r.real || 0); ada[c] = 1;
    });
    var kolom = ["KP", "KD"].concat(["DK", "TP"].filter(function (c) { return ada[c]; }));
    var jenis = URUT_JENIS.concat(["lain"]).filter(function (k) { return isi[k]; });
    return { kolom: kolom, jenis: jenis, isi: isi, tot: tot };
  }

  function matriks(j) {
    var R = STATE.rinci;
    var rows = (j.satker_kegiatan || []).filter(function (r) {
      return (!R.satker || String(r.KODE_SATKER) === R.satker) && (!R.kegiatan || String(r.KDKEG) === R.kegiatan);
    });
    var isi = {}, perKeg = {}, tot = { pagu: 0, real: 0 };
    rows.forEach(function (r) {
      var s = String(r.KODE_SATKER), k = String(r.KDKEG);
      isi[s] = isi[s] || {};
      isi[s][k] = { pagu: +r.pagu || 0, real: +r.real || 0 };
      perKeg[k] = perKeg[k] || { pagu: 0, real: 0 };
      perKeg[k].pagu += +r.pagu || 0; perKeg[k].real += +r.real || 0;
      tot.pagu += +r.pagu || 0; tot.real += +r.real || 0;
    });
    return { sats: Object.keys(isi).sort(I().urutSatker), kegs: Object.keys(perKeg).sort(), isi: isi, perKeg: perKeg, tot: tot };
  }

  /* ================= TAB PERBANDINGAN HARIAN ================= */
  function labelTanggal(x) {
    var w = x.data_per ? F().waktu(x.data_per) : F().tanggal(x.tanggal);
    return w;
  }

  function harianKerangka(indeks) {
    var H = STATE.harian;
    var adaFile = indeks.filter(function (x) { return x.file; }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    if (!H.a || !adaFile.some(function (x) { return x.file === H.a; })) H.a = adaFile[0] ? adaFile[0].file : "";
    if (!H.b || !adaFile.some(function (x) { return x.file === H.b; }) || H.b === H.a) {
      var iA = adaFile.map(function (x) { return x.file; }).indexOf(H.a);
      H.b = adaFile[iA + 1] ? adaFile[iA + 1].file : (adaFile[0] && adaFile[0].file !== H.a ? adaFile[0].file : "");
    }
    var hariIni = F().tanggal(new Date());
    var lbl = function (x, i) {
      var t = labelTanggal(x);
      return (F().tanggal(x.tanggal) === hariIni ? "Hari ini · " : "") + t + (i === 1 ? " (H-1)" : "");
    };
    return '<div class="filter-bar" role="group" aria-label="Pilih tanggal pembanding">' +
      pilihan("f-harian-a", "Tanggal data", "h-a", adaFile.map(function (x, i) { return opsi(x.file, lbl(x, i), H.a); }).join("")) +
      pilihan("f-harian-b", "Dibandingkan dengan", "h-b", adaFile.map(function (x, i) { return opsi(x.file, lbl(x, i), H.b); }).join("")) +
      pilihan("f-harian-ukur", "Ukuran", "h-ukur", opsi("sp2d", "Realisasi SP2D", H.ukur) + opsi("os", "SP2D + outstanding", H.ukur)) +
      '<span class="sumber">Arsip per tanggal dari setiap unggahan realisasi</span></div>';
  }

  function harianGrafik(indeks) {
    var urut = indeks.slice().sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
    return seksi("Perkembangan realisasi",
      '<span class="seksi-keterangan">% terhadap pagu per tanggal unduh data MyIntress</span>' +
      Monev.grafik.legenda([{ nama: "Realisasi SP2D", warna: "--brand" }, { nama: "SP2D + outstanding", warna: "--brand-mid" }]) +
      '<div class="wadah-grafik" data-grafik="harian"></div>' +
      '<p class="catatan">' + urut.length + " tanggal data, " + F().tanggal(urut[0].tanggal) + " sampai " + F().tanggal(urut[urut.length - 1].tanggal) + ".</p>");
  }

  function pasangGrafikHarian(el, indeks) {
    var wadah = el.querySelector('[data-grafik="harian"]');
    if (!wadah) return;
    var urut = indeks.slice().sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
    var sp = urut.map(function (x) { return pct(x.sp2d, x.pagu); });
    var ro = urut.map(function (x) { return pct((x.sp2d || 0) + (x.os || 0), x.pagu); });
    var akhir = urut[urut.length - 1];
    Monev.grafik.garis(wadah, {
      label: urut.map(function (x) { return F().tanggal(x.tanggal).replace(/ \d{4}$/, ""); }),
      seri: [{ nama: "SP2D + outstanding", data: ro, warna: "--brand-mid", tebal: 3 }, { nama: "Realisasi SP2D", data: sp, warna: "--brand", tebal: 3 }],
      yMaks: 100, satuanY: "%",
      ringkasan: "Realisasi SP2D " + persen(sp[0]) + " pada " + F().tanggal(urut[0].tanggal) + " menjadi " + persen(sp[sp.length - 1]) + " pada " + F().tanggal(akhir.tanggal) +
        "; SP2D + outstanding " + persen(ro[ro.length - 1]) + "."
    });
  }

  /** Selisih per unit kerja antara dua arsip (ja = tanggal data, jb = pembanding). Dipakai tab Perbandingan harian dan Beranda. */
  function selisihUnit(ja, jb, ukur) {
    var ma = model(ja), mb = jb ? model(jb) : null;
    var ambil = function (r) { return r ? (ukur === "os" ? r.realOs : r.real) : null; };
    var peta = {};
    if (mb) mb.unit.forEach(function (r) { peta[r.unit] = r; });
    var rows = ma.unit.slice().sort(function (a, b) { return a.unmapped - b.unmapped || I().urutUnit(a.unit, b.unit); }).map(function (r) {
      var p = peta[r.unit], va = ambil(r), vb = ambil(p);
      var pa = r.pagu ? (va / r.pagu) * 100 : null, pb = p && p.pagu ? (vb / p.pagu) * 100 : null;
      return { unit: r.unit, unmapped: r.unmapped, vb: vb, va: va, d: vb == null ? null : va - vb, dp: pa == null || pb == null ? null : pa - pb };
    }).filter(function (r) { return !(r.unmapped && !r.va && !r.vb); });
    var tA = ambil(ma.total), tB = mb ? ambil(mb.total) : null;
    var dpT = mb && ma.total.pagu && mb.total.pagu ? (tA / ma.total.pagu - tB / mb.total.pagu) * 100 : null;
    return { rows: rows, tA: tA, tB: tB, dpT: dpT };
  }

  function harianTabel(indeks, ja, jb) {
    var H = STATE.harian;
    var xa = indeks.filter(function (x) { return x.file === H.a; })[0], xb = indeks.filter(function (x) { return x.file === H.b; })[0];
    var S = selisihUnit(ja, jb, H.ukur), rows = S.rows, tA = S.tA, tB = S.tB, dpT = S.dpT;
    var la = xa ? F().tanggal(xa.tanggal).replace(/ \d{4}$/, "") : "?", lb = xb ? F().tanggal(xb.tanggal).replace(/ \d{4}$/, "") : "?";
    var nama = H.ukur === "os" ? "SP2D + OS" : "Realisasi";
    var status = function (d) {
      if (d == null) return '<span class="chip chip-neutral">Data H-1 tidak ada</span>';
      return d > 0 ? '<span class="chip chip-ok">Naik</span>' : d < 0 ? '<span class="chip chip-warn">Turun</span>' : '<span class="chip chip-neutral">Tetap</span>';
    };
    var badan = rows.map(function (r) {
      return "<tr" + (r.d != null && r.d < 0 ? ' class="sorot"' : "") + "><td>" + e(r.unit) + "</td>" + td(rpM(r.vb), 1) + td(rpM(r.va), 1) +
        td(r.d == null ? "–" : e(F().selisihRupiah(r.d)), 1) + td(r.dp == null ? "–" : e(F().selisihPoin(r.dp)), 1) + "<td>" + status(r.d) + "</td></tr>";
    }).join("");
    var judul = "Selisih per unit kerja dibanding " + (xb ? F().tanggal(xb.tanggal) : "H-1");
    return seksi(judul,
      '<div class="wadah-tabel"><table class="tabel tabel-sedang"><thead><tr><th scope="col">Unit kerja</th><th scope="col" class="angka">' + e(nama + " " + lb) + "</th>" +
      '<th scope="col" class="angka">' + e(nama + " " + la) + '</th><th scope="col" class="angka">Selisih (Rp)</th><th scope="col" class="angka">Selisih (% poin)</th><th scope="col">Status</th></tr></thead><tbody>' +
      badan + '<tr class="jumlah"><td>Jumlah</td>' + td(rpM(tB), 1) + td(rpM(tA), 1) + td(tB == null ? "–" : e(F().selisihRupiah(tA - tB)), 1) +
      td(dpT == null ? "–" : e(F().selisihPoin(dpT)), 1) + "<td>" + status(tB == null ? null : tA - tB) + "</td></tr></tbody></table></div>" +
      '<p class="catatan">Realisasi yang turun dibanding H-1 biasanya karena koreksi SP2D atau file yang belum lengkap; unggahan seperti ini mendapat PERINGATAN dan wajib diberi catatan. Selisih % poin dihitung terhadap pagu masing-masing tanggal.</p>',
      { kanan: tombolCSV("harian") });
  }

  /* ================= TAB TARGET SERAPAN (tgEngine Dashboard.html) ================= */
  function dISO(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function pISO(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function tambahHari(s, n) { var d = pISO(s); d.setDate(d.getDate() + n); return dISO(d); }
  var HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function hariDihitung(cfg) {
    var out = [], lib = {};
    (cfg.libur || []).forEach(function (x) { lib[x] = 1; });
    for (var d = cfg.start; d <= cfg.end; d = tambahHari(d, 1)) {
      var wd = pISO(d).getDay();
      if (cfg.mode === "KALENDER" || (wd >= 1 && wd <= 5 && !lib[d])) out.push(d);
    }
    return out;
  }

  /** Salinan tgEngine() Dashboard.html: seri realisasi kumulatif dan rencana untuk sekumpulan unit kerja. */
  function mesinTarget(T, units, s5rows) {
    var cfg = T.cfg, keys = {};
    units.forEach(function (u) { keys[u.unit] = 1; });
    var byDate = {}, paguBy = {}, osBy = {};
    T.snaps.forEach(function (s) {
      if (!keys[s.unit]) return;
      byDate[s.tgl] = (byDate[s.tgl] || 0) + s.real; paguBy[s.tgl] = (paguBy[s.tgl] || 0) + s.pagu; osBy[s.tgl] = (osBy[s.tgl] || 0) + (s.os || 0);
    });
    var sd = Object.keys(byDate).sort();
    var t1 = units.reduce(function (a, u) { return a + u.t1; }, 0), t2 = units.reduce(function (a, u) { return a + u.t2; }, 0);
    var R = s5rows || [];
    var pagu = sd.length ? paguBy[sd[sd.length - 1]] : R.filter(function (r) { return keys[r.kunci || r.nama]; }).reduce(function (a, r) { return a + r.pagu; }, 0);
    var E = { t1: t1, t2: t2, pagu: pagu, sd: sd, ok: !!sd.length };
    if (!sd.length) return E;
    var at = function (d) { var v = null; for (var i = 0; i < sd.length && sd[i] <= d; i++) v = byDate[sd[i]]; return v; };
    var atOs = function (d) { var v = null; for (var i = 0; i < sd.length && sd[i] <= d; i++) v = byDate[sd[i]] + osBy[sd[i]]; return v; };
    var before = function (d) { var v = null; for (var i = 0; i < sd.length && sd[i] < d; i++) v = byDate[sd[i]]; return v; };
    var bDate = null;
    sd.forEach(function (x) { if (x < cfg.start) bDate = x; });
    if (!bDate) bDate = sd[0];
    var B0 = byDate[bDate], days = hariDihitung(cfg).filter(function (d) { return d > bDate; }), N = days.length;
    var last = sd[sd.length - 1], lastReal = byDate[last];
    var futIdx = -1;
    for (var q = 0; q < days.length; q++) if (days[q] > last) { futIdx = q; break; }
    var remFut = futIdx < 0 ? 0 : N - futIdx;
    var needNow1 = remFut ? Math.max(0, t1 - lastReal) / remFut : 0, needNow2 = remFut ? Math.max(0, t2 - lastReal) / remFut : 0;
    var rows = days.map(function (d, i) {
      var past = d <= last, prev = past ? before(d) : lastReal;
      if (prev == null) prev = B0;
      var rem = N - i;
      var plan1 = B0 + (t1 - B0) * (i + 1) / N, plan2 = B0 + (t2 - B0) * (i + 1) / N;
      var need1 = past ? Math.max(0, t1 - prev) / rem : needNow1, need2 = past ? Math.max(0, t2 - prev) / rem : needNow2;
      var act = past && byDate[d] != null ? byDate[d] - prev : null, cum = past ? at(d) : null, cumOs = past ? atOs(d) : null;
      return { d: d, i: i + 1, rem: rem, past: past, plan1: plan1, plan2: plan2, need1: need1, need2: need2, act: act, cum: cum, cumOs: cumOs,
        gap1: cum == null ? null : cum - plan1, gap2: cum == null ? null : cum - plan2 };
    });
    var doneDays = days.filter(function (d) { return d <= last; }).length;
    E.lastOs = osBy[last]; E.lastRo = byDate[last] + osBy[last]; E.B0os = byDate[bDate] + osBy[bDate];
    E.bDate = bDate; E.B0 = B0; E.days = days; E.N = N; E.last = last; E.lastReal = lastReal; E.rows = rows; E.remFut = remFut;
    E.needNow1 = needNow1; E.needNow2 = needNow2;
    E.planNow1 = B0 + (t1 - B0) * doneDays / (N || 1); E.planNow2 = B0 + (t2 - B0) * doneDays / (N || 1);
    E.gapNow1 = lastReal - E.planNow1; E.gapNow2 = lastReal - E.planNow2;
    var W = [], cur = null;
    rows.forEach(function (r) {
      var dt = pISO(r.d), mon = tambahHari(r.d, -((dt.getDay() + 6) % 7));
      if (!cur || cur.mon !== mon) { cur = { mon: mon, sun: tambahHari(mon, 6), rows: [] }; W.push(cur); }
      cur.rows.push(r);
    });
    W.forEach(function (w, k) {
      var f = w.rows[0], l = w.rows[w.rows.length - 1];
      w.no = k + 1; w.from = f.d; w.to = l.d; w.n = w.rows.length;
      var startPos = f.i === 1 ? B0 : rows[f.i - 2].plan1, startPos2 = f.i === 1 ? B0 : rows[f.i - 2].plan2;
      w.tw1 = l.plan1 - startPos; w.tw2 = l.plan2 - startPos2; w.cum1 = l.plan1; w.cum2 = l.plan2;
      var realStart = before(f.d);
      if (realStart == null || f.d <= bDate) realStart = B0;
      w.status = f.d > last ? "akan" : (l.d <= last ? "selesai" : "berjalan");
      if (w.status === "akan") { w.realCum = null; w.realWeek = null; w.gap1 = null; w.gap2 = null; return; }
      var upto = w.status === "selesai" ? l.d : last;
      w.upto = upto; w.realCum = at(upto); w.realWeek = w.realCum - realStart; w.roCum = atOs(upto);
      var pr = rows.filter(function (r) { return r.d <= upto; }), p = pr[pr.length - 1];
      w.planUpto1 = p ? p.plan1 : B0; w.planUpto2 = p ? p.plan2 : B0;
      w.gap1 = w.realCum - w.planUpto1; w.gap2 = w.realCum - w.planUpto2;
    });
    E.weeks = W;
    E.series = { labels: [bDate].concat(days), real: [B0].concat(rows.map(function (r) { return r.cum; })),
      ro: [E.B0os].concat(rows.map(function (r) { return r.cumOs; })), p1: [B0].concat(rows.map(function (r) { return r.plan1; })), p2: [B0].concat(rows.map(function (r) { return r.plan2; })) };
    return E;
  }

  function unitTarget(T) {
    return T.units.slice().sort(function (a, b) { return I().urutUnit(I().unit(a.unit), I().unit(b.unit)); });
  }

  function target(T, j) {
    var units = unitTarget(T), G = STATE.target;
    if (G.unit && !units.some(function (u) { return u.unit === G.unit; })) G.unit = "";
    var pilih = G.unit ? units.filter(function (u) { return u.unit === G.unit; }) : units;
    var s5 = j && j.realisasi && j.realisasi.s5 ? j.realisasi.s5.rows : [];
    var E = mesinTarget(T, pilih, s5), cfg = T.cfg;
    var html = '<div class="filter-bar" role="group" aria-label="Pilih unit kerja target">' +
      pilihan("f-target-unit", "Unit kerja", "t-unit", opsi("", "Semua unit kerja (Ditjen Perkebunan)", G.unit) + units.map(function (u) { return opsi(u.unit, I().unit(u.unit), G.unit); }).join("")) +
      segmen("jalur", [["1", "RPATA"], ["2", "Tanpa RPATA"]], G.jalur, "Jalur target untuk tabel mingguan dan harian") +
      '<span class="sumber">' + tombolMasuk("Ubah target", true) + "</span></div>";
    if (!E.ok) {
      return html + Monev.data.tampil.kosong("Belum ada data realisasi harian",
        "Realisasi per unit kerja tercatat setiap kali data realisasi MyIntress diproses. Proses setiap hari kerja supaya kebutuhan harian dihitung ulang.",
        { label: "Unggah data realisasi", href: "#unggah" });
    }
    var P = E.pagu || 1, pp = function (v) { return persen((v / P) * 100); };
    var rp = function (v) { return F().rupiah(v); };
    html += '<p class="meta-target">Periode ' + e(F().tanggal(cfg.start)) + " – " + e(F().tanggal(cfg.end)) + " · " +
      (cfg.mode === "KALENDER" ? "semua hari kalender" : "hari kerja Senin–Jumat" + (cfg.libur && cfg.libur.length ? ", libur " + cfg.libur.map(function (x) { return F().tanggal(x); }).join(", ") + " dikecualikan" : "")) +
      " · posisi awal realisasi per " + e(F().tanggal(E.bDate)) + " · data realisasi terakhir " + e(F().tanggal(E.last)) + ", sisa " + E.remFut + " hari dihitung. " +
      "GAP dihitung dari realisasi SP2D; SP2D + outstanding ditampilkan sebagai potensi serapan.</p>";
    var gapKet = function (g) { return E.remFut + " hari tersisa · GAP " + F().selisihRupiah(g); };
    html += '<section class="grid-kartu grid-kartu-padat grid-kartu-tujuh" aria-label="Angka utama target serapan">' +
      kartu("Pagu", rp(P), G.unit ? I().unit(G.unit) : units.length + " unit kerja") +
      kartu("Realisasi SP2D", pp(E.lastReal), rp(E.lastReal) + " · per " + F().tanggal(E.last)) +
      kartu("SP2D + outstanding", pp(E.lastRo), E.lastRo >= E.t1 ? "sudah ≥ target RPATA" : "kurang " + rp(E.t1 - E.lastRo) + " dari target RPATA", { kelas: E.lastRo >= E.t1 ? "teks-ok" : "" }) +
      kartu("Target RPATA", pp(E.t1), "sisa " + rp(Math.max(0, E.t1 - E.lastReal))) +
      kartu("Butuh per hari (RPATA)", rp(E.needNow1), gapKet(E.gapNow1), { kelas: E.gapNow1 >= 0 ? "teks-ok" : "teks-bad" }) +
      kartu("Target tanpa RPATA", pp(E.t2), "sisa " + rp(Math.max(0, E.t2 - E.lastReal))) +
      kartu("Butuh per hari (tanpa RPATA)", rp(E.needNow2), gapKet(E.gapNow2), { kelas: E.gapNow2 >= 0 ? "teks-ok" : "teks-bad" }) +
      "</section>";

    /* posisi per unit */
    var semua = units.map(function (u) { var x = mesinTarget(T, [u], s5); x.u = u; return x; }).filter(function (x) { return x.ok; });
    var tabUnit = '<div class="wadah-tabel"><table class="tabel tabel-kecil"><thead><tr><th scope="col" rowspan="2">Unit kerja</th><th scope="col" rowspan="2" class="angka">SP2D</th>' +
      '<th scope="colgroup" colspan="2" class="kelompok">RPATA</th><th scope="colgroup" colspan="2" class="kelompok">Tanpa RPATA</th></tr>' +
      '<tr><th scope="col" class="angka">Butuh/hari</th><th scope="col" class="angka">GAP</th><th scope="col" class="angka">Butuh/hari</th><th scope="col" class="angka">GAP</th></tr></thead><tbody>' +
      semua.map(function (x) {
        var p = x.pagu || 1;
        return "<tr" + (G.unit === x.u.unit ? ' class="terpilih"' : "") + '><td><button type="button" class="tautan-sel" data-t-unit="' + e(x.u.unit) + '">' + e(I().unit(x.u.unit)) + "</button></td>" +
          td(persen((x.lastReal / p) * 100), 1) + td(e(F().rupiah(x.needNow1)), 1) + td(gapTeks(x.gapNow1), 1) + td(e(F().rupiah(x.needNow2)), 1) + td(gapTeks(x.gapNow2), 1) + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="catatan">Butuh/hari = sisa target ÷ sisa hari setelah data terakhir · GAP = realisasi − rencana s.d. data terakhir. Klik unit kerja untuk melihat rinciannya.</p>';

    html += '<div class="grid-dua">' +
      seksi("Realisasi kumulatif vs rencana",
        Monev.grafik.legenda([{ nama: "Realisasi SP2D", warna: "--brand" }, { nama: "SP2D + outstanding", warna: "--brand-mid" },
          { nama: "Rencana RPATA", warna: "--export-ppt", putus: true }, { nama: "Rencana tanpa RPATA", warna: "--info-fg", putus: true }]) +
        '<div class="wadah-grafik" data-grafik="target"></div>') +
      seksi("Posisi per unit kerja", tabUnit, { kanan: tombolCSV("t-unit") }) + "</div>";

    /* mingguan dan harian */
    var k = G.jalur, namaJalur = k === "1" ? "RPATA" : "tanpa RPATA";
    var stMinggu = { selesai: '<span class="chip chip-neutral">Selesai</span>', berjalan: '<span class="chip chip-info">Berjalan</span>', akan: '<span class="chip chip-neutral">Akan datang</span>' };
    var tw = function (key) { return E.weeks.reduce(function (a, w) { return a + (w[key] || 0); }, 0); };
    var tabMinggu = '<div class="wadah-tabel"><table class="tabel tabel-kecil"><thead><tr><th scope="col">Minggu</th><th scope="col" class="angka">Target minggu</th>' +
      '<th scope="col" class="angka">Realisasi minggu</th><th scope="col" class="angka">GAP kumulatif</th><th scope="col">Status</th></tr></thead><tbody>' +
      E.weeks.map(function (w) {
        return "<tr" + (w.status === "berjalan" ? ' class="terpilih"' : w.status === "akan" ? ' class="redup"' : "") + "><td>Minggu " + w.no +
          '<br><span class="teks-redup">' + e(F().tanggal(w.from).replace(/ \d{4}$/, "") + " – " + F().tanggal(w.to).replace(/ \d{4}$/, "")) + "</span></td>" +
          td(e(rp(w["tw" + k])), 1) + td(w.realWeek == null ? "–" : e(rp(w.realWeek)), 1) + td(gapTeks(w["gap" + k]), 1) + "<td>" + stMinggu[w.status] + "</td></tr>";
      }).join("") +
      '<tr class="jumlah"><td>Jumlah</td>' + td(e(rp(tw("tw" + k))), 1) + td(e(rp(E.lastReal - E.B0)), 1) + td(gapTeks(E["gapNow" + k]), 1) + "<td></td></tr></tbody></table></div>" +
      '<p class="catatan">Minggu Senin–Minggu. Target minggu = bagian rencana rata dari posisi ' + e(F().tanggal(E.bDate)) + " ke target akhir tahun (" + namaJalur + "). Minggu berjalan dihitung s.d. data terakhir.</p>";

    var hariIni = dISO(new Date());
    var tabHari = '<div class="wadah-tabel"><table class="tabel tabel-kecil"><thead><tr><th scope="col">Tanggal</th><th scope="col" class="angka">Sisa hari</th>' +
      '<th scope="col" class="angka">Butuh (' + namaJalur + ')</th><th scope="col" class="angka">Realisasi</th><th scope="col">Status</th></tr></thead><tbody>' +
      E.rows.map(function (r) {
        var butuh = r["need" + k];
        var st = r.act == null ? "" : r.act >= butuh ? '<span class="chip chip-ok">Tercapai</span>' : '<span class="chip chip-bad">Kurang</span>';
        var kelas = r.d === hariIni ? "terpilih" : !r.past ? "redup" : "";
        return "<tr data-hari-baris" + (r.d === hariIni ? " data-hari-ini" : "") + (kelas ? ' class="' + kelas + '"' : "") + "><td>" + e(HARI[pISO(r.d).getDay()] + ", " + F().tanggal(r.d).replace(/ \d{4}$/, "")) +
          (r.d === hariIni ? ' <span class="chip chip-warn">Hari ini</span>' : "") + "</td>" + td(String(r.rem), 1) + td(e(rp(butuh)), 1) +
          td(r.act == null ? "–" : e(rp(r.act)), 1) + "<td>" + st + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="pager-akun" data-pager-hari hidden><button type="button" class="tombol tombol-sekunder tombol-kecil" data-hari-hal="-1">‹ Sebelumnya</button>' +
      '<span aria-live="polite" data-hari-ket></span><button type="button" class="tombol tombol-sekunder tombol-kecil" data-hari-hal="1">Berikutnya ›</button></div>';

    html += '<div class="grid-dua">' +
      seksi("Rekap mingguan", tabMinggu, { kanan: tombolCSV("t-minggu"), kelas: "seksi-minggu" }) +
      seksi("Kebutuhan serapan harian",
        '<p class="catatan">Kebutuhan harian = (target − realisasi s.d. kemarin) ÷ sisa hari. Kekurangan satu hari otomatis dibagi ke hari berikutnya. Realisasi harian = selisih data realisasi antartanggal; hari tanpa data ditandai "–".</p>' + tabHari,
        { kanan: tombolCSV("t-hari"), kelas: "seksi-hari" }) + "</div>";
    return html;
  }

  /*
   * Tabel Kebutuhan serapan harian dibagi per halaman: bila berdampingan dengan Rekap mingguan,
   * tinggi kartunya mengikuti kartu Rekap mingguan; bila bertumpuk (layar sempit), 10 hari per halaman.
   * Halaman awal = halaman yang memuat hari ini (atau hari terakhir yang sudah lewat).
   */
  var HARI_PER_HAL = 10;
  function halamanHari(el) {
    var sa = el.querySelector(".seksi-hari"), sk = el.querySelector(".seksi-minggu");
    if (!sa || !sk) return;
    var rows = Array.prototype.slice.call(sa.querySelectorAll("tr[data-hari-baris]"));
    var pager = sa.querySelector("[data-pager-hari]");
    var batas = [0], i;
    sa.style.alignSelf = "start"; sk.style.alignSelf = "start";
    if (Math.abs(sa.offsetTop - sk.offsetTop) >= 4) {
      for (i = HARI_PER_HAL; i < rows.length; i += HARI_PER_HAL) batas.push(i);
    } else {
      pager.hidden = false;
      rows.forEach(function (r) { r.hidden = true; });
      var target = sk.offsetHeight, mulai = 0;
      for (i = 0; i < rows.length; i++) {
        rows[i].hidden = false;
        if (sa.offsetHeight > target && i > mulai) {
          for (var k = mulai; k <= i; k++) rows[k].hidden = true;
          rows[i].hidden = false; batas.push(i); mulai = i;
        }
      }
    }
    sa.style.alignSelf = ""; sk.style.alignSelf = "";
    var jml = batas.length, T = STATE.target;
    if (T.hariHal == null) {
      var idx = rows.findIndex(function (r) { return r.hasAttribute("data-hari-ini"); });
      if (idx < 0) { idx = rows.findIndex(function (r) { return r.classList.contains("redup"); }) - 1; if (idx < -1) idx = rows.length - 1; }
      if (idx < 0) idx = 0;
      T.hariHal = 0;
      for (i = 0; i < jml; i++) if (batas[i] <= idx) T.hariHal = i;
    }
    if (T.hariHal >= jml) T.hariHal = jml - 1;
    if (T.hariHal < 0) T.hariHal = 0;
    var dari = batas[T.hariHal], ke = T.hariHal + 1 < jml ? batas[T.hariHal + 1] : rows.length;
    rows.forEach(function (r, n) { r.hidden = n < dari || n >= ke; });
    pager.hidden = jml < 2;
    sa.querySelector("[data-hari-ket]").textContent = "Halaman " + (T.hariHal + 1) + " dari " + jml;
    pager.querySelector('[data-hari-hal="-1"]').disabled = T.hariHal === 0;
    pager.querySelector('[data-hari-hal="1"]').disabled = T.hariHal >= jml - 1;
  }

  function pasangGrafikTarget(el, T, j) {
    var wadah = el.querySelector('[data-grafik="target"]');
    if (!wadah) return;
    var units = unitTarget(T), G = STATE.target;
    var pilih = G.unit ? units.filter(function (u) { return u.unit === G.unit; }) : units;
    var E = mesinTarget(T, pilih, j && j.realisasi && j.realisasi.s5 ? j.realisasi.s5.rows : []);
    if (!E.ok) return;
    var P = E.pagu || 1, pc = function (a) { return a.map(function (v) { return v == null ? null : (v / P) * 100; }); };
    var S = E.series, iAkhir = 0;
    S.labels.forEach(function (d, i) { if (d <= E.last) iAkhir = i; });
    var maks = Math.max(100, Math.ceil(Math.max.apply(null, pc(S.p1).concat(pc(S.ro)).filter(function (v) { return v != null; })) / 10) * 10);
    Monev.grafik.garis(wadah, {
      label: S.labels.map(function (d) { return F().tanggal(d).replace(/ \d{4}$/, ""); }),
      seri: [{ nama: "Rencana tanpa RPATA", data: pc(S.p2), warna: "--info-fg", putus: true, tebal: 2 },
        { nama: "Rencana RPATA", data: pc(S.p1), warna: "--export-ppt", putus: true, tebal: 2 },
        { nama: "SP2D + outstanding", data: pc(S.ro), warna: "--brand-mid", tebal: 3 },
        { nama: "Realisasi SP2D", data: pc(S.real), warna: "--brand", tebal: 3 }],
      yMaks: maks, satuanY: "%", penanda: { indeks: iAkhir, teks: "data terakhir" },
      ringkasan: "Realisasi SP2D " + persen((E.lastReal / P) * 100) + " per " + F().tanggal(E.last) + "; target RPATA " + persen((E.t1 / P) * 100) +
        " dan tanpa RPATA " + persen((E.t2 / P) * 100) + " pada " + F().tanggal(T.cfg.end) + "."
    });
  }

  /* ================= CSV ================= */
  function unduh(jenis, ctx) {
    var f = Monev.unduhCSV, ta = ctx.ta, j = ctx.j;
    var bulat = function (p) { return p == null ? "" : +p.toFixed(1); };
    var baris = function (r) { return [r.unmapped ? 0 : r.pagu, r.blokir == null ? "" : r.blokir, r.real, bulat(r.pct), r.os, r.realOs, bulat(r.pct2), r.blokir == null ? "" : r.sisa]; };
    var kepalaUang = ["Pagu (Rp)", "Blokir (Rp)", "Realisasi SP2D (Rp)", "% SP2D", "Outstanding (Rp)", "SP2D + OS (Rp)", "% SP2D + OS", "Sisa (Rp)"];
    if (jenis === "kegiatan") {
      var m = model(j);
      f("anggaran-per-kegiatan-" + ta + ".csv", ["Kode", "Kegiatan"].concat(kepalaUang), m.keg.map(function (r) { return [r.kode, r.nama + (r.ket ? " " + r.ket : "")].concat(baris(r)); }));
    } else if (jenis === "unit") {
      var m2 = model(j);
      f("anggaran-per-unit-kerja-" + ta + ".csv", ["Unit kerja"].concat(kepalaUang), m2.unit.map(function (r) { return [r.unit + (r.ket ? " " + r.ket : "")].concat(baris(r)); }));
    } else if (jenis === "komoditas") {
      f("anggaran-per-komoditas-" + ta + ".csv", ["Komoditas", "Jenis bantuan", "Sumber dana", "Pagu (Rp)", "Realisasi SP2D (Rp)", "Outstanding (Rp)"],
        (j.per_komoditas || []).map(function (r) { return [I().komoditas(r.komoditas), r.jenis, r.sumber_dana, r.pagu, r.sp2d || r.real, r.os || r.outstanding]; }));
    } else if (jenis === "rincian") {
      var L = dataRinci(j), out = [];
      for (var t = 0; t <= 4; t++) L[t].forEach(function (r) { out.push([NAMA_TINGKAT[t], r.KDKEG, r.S05 || "", r.S13 || "", r.S14 || "", r.S15 || "", t === 4 ? String(r.KODE_SATKER || "") : "", t === 4 ? (r.NAMA_SUBKOMPONEN || "") : "", +r.pagu || 0, +r.real || 0]); });
      f("anggaran-rincian-" + ta + ".csv", ["Tingkat", "Kegiatan", "KRO", "RO", "Komponen", "Sub-komponen", "Kode satker (sub-komponen)", "Nama sub-komponen", "Pagu (Rp)", "Realisasi SP2D (Rp)"], out);
    } else if (jenis === "akun") {
      f("anggaran-per-akun-" + ta + ".csv", ["Akun", "Nama akun", "Pagu (Rp)", "Realisasi SP2D (Rp)", "%"],
        sumberAkun(j).filter(function (r) { return !STATE.rinci.jenis || jenisDari(r.S03) === STATE.rinci.jenis; })
          .map(function (r) { return [r.S03, r.nama, r.pagu, r.real, bulat(pct(r.real, r.pagu))]; }));
    } else if (jenis === "kewenangan") {
      var kw = kewenangan(j);
      f("anggaran-jenis-kewenangan-" + ta + ".csv", ["Jenis belanja"].concat(kw.kolom.map(function (c) { return c + " (Rp)"; })),
        kw.jenis.map(function (k) { return [k === "lain" ? "Lainnya" : k + " " + JENIS[k]].concat(kw.kolom.map(function (c) { return kw.isi[k][c] || 0; })); }));
    } else if (jenis === "matriks") {
      var mx = matriks(j);
      f("anggaran-satker-kegiatan-" + ta + ".csv", ["Satker", "Kode satker", "Kegiatan", "Pagu (Rp)", "Realisasi SP2D (Rp)", "%"],
        [].concat.apply([], mx.sats.map(function (s) { return Object.keys(mx.isi[s]).sort().map(function (k) { var x = mx.isi[s][k]; return [I().satker(s), s, k, x.pagu, x.real, bulat(pct(x.real, x.pagu))]; }); })));
    } else if (jenis === "harian" && ctx.ja) {
      var ma = model(ctx.ja), mb = ctx.jb ? model(ctx.jb) : null, peta = {};
      if (mb) mb.unit.forEach(function (r) { peta[r.unit] = r; });
      f("anggaran-perbandingan-harian-" + ta + ".csv", ["Unit kerja", "Realisasi SP2D pembanding (Rp)", "Realisasi SP2D (Rp)", "SP2D + OS pembanding (Rp)", "SP2D + OS (Rp)"],
        ma.unit.map(function (r) { var p = peta[r.unit]; return [r.unit, p ? p.real : "", r.real, p ? p.realOs : "", r.realOs]; }));
    } else if (jenis.indexOf("t-") === 0 && ctx.T) {
      var T = ctx.T, units = unitTarget(T), G = STATE.target, s5 = j && j.realisasi && j.realisasi.s5 ? j.realisasi.s5.rows : [];
      var E = mesinTarget(T, G.unit ? units.filter(function (u) { return u.unit === G.unit; }) : units, s5);
      if (!E.ok) return;
      if (jenis === "t-unit") {
        f("target-posisi-unit-" + ta + ".csv", ["Unit kerja", "Pagu (Rp)", "Realisasi SP2D (Rp)", "SP2D + OS (Rp)", "Target RPATA (Rp)", "Butuh/hari RPATA (Rp)", "GAP RPATA (Rp)",
          "Target tanpa RPATA (Rp)", "Butuh/hari tanpa RPATA (Rp)", "GAP tanpa RPATA (Rp)"],
          units.map(function (u) { var x = mesinTarget(T, [u], s5); return x.ok ? [I().unit(u.unit), x.pagu, x.lastReal, x.lastRo, x.t1, Math.round(x.needNow1), Math.round(x.gapNow1), x.t2, Math.round(x.needNow2), Math.round(x.gapNow2)] : null; })
            .filter(Boolean));
      } else if (jenis === "t-minggu") {
        f("target-mingguan-" + ta + ".csv", ["Minggu", "Dari", "Sampai", "Hari", "Target minggu RPATA (Rp)", "Target minggu tanpa RPATA (Rp)", "Realisasi minggu (Rp)", "Realisasi SP2D kumulatif (Rp)",
          "SP2D + OS kumulatif (Rp)", "Target kumulatif RPATA (Rp)", "GAP RPATA (Rp)", "Target kumulatif tanpa RPATA (Rp)", "GAP tanpa RPATA (Rp)", "Status"],
          E.weeks.map(function (w) { return [w.no, w.from, w.to, w.n, Math.round(w.tw1), Math.round(w.tw2), w.realWeek, w.realCum, w.roCum, Math.round(w.cum1), w.gap1 == null ? "" : Math.round(w.gap1), Math.round(w.cum2), w.gap2 == null ? "" : Math.round(w.gap2), w.status]; }));
      } else if (jenis === "t-hari") {
        f("target-harian-" + ta + ".csv", ["Tanggal", "Hari ke", "Sisa hari", "Butuh RPATA (Rp)", "Butuh tanpa RPATA (Rp)", "Realisasi hari itu (Rp)", "Realisasi SP2D kumulatif (Rp)",
          "SP2D + OS kumulatif (Rp)", "GAP RPATA (Rp)", "GAP tanpa RPATA (Rp)"],
          E.rows.map(function (r) { return [r.d, r.i, r.rem, Math.round(r.need1), Math.round(r.need2), r.act == null ? "" : r.act, r.cum == null ? "" : r.cum, r.cumOs == null ? "" : r.cumOs,
            r.gap1 == null ? "" : Math.round(r.gap1), r.gap2 == null ? "" : Math.round(r.gap2)]; }));
      }
    }
  }

  /* ================= pasang ================= */
  function kosongAnggaran(ta) {
    return Monev.data.tampil.kosong("Belum ada data realisasi anggaran TA " + ta,
      "Data realisasi terbit setelah file realisasi MyIntress diunggah dan diproses di halaman kerja.", { label: "Unggah data realisasi", href: "#unggah" });
  }

  function jaga(el, fokusId) {
    var aktif = document.activeElement && document.activeElement.id;
    return function () {
      var id = fokusId || aktif;
      if (id && document.getElementById(id)) document.getElementById(id).focus();
    };
  }

  function isiTab(el, r, ta) {
    var tab = r.sub && r.sub.id ? r.sub.id : "";
    var ctx = { ta: ta };

    function gagal(err, apa) {
      if (!el.isConnected) return;
      el.innerHTML = err && err.status === 404 ? kosongAnggaran(ta) : Monev.data.tampil.gagal(apa + " TA " + ta + " gagal dimuat", "");
    }

    function gambar() {
      if (!el.isConnected) return;
      var kembali = jaga(el);
      if (tab === "") el.innerHTML = realisasi(ctx.j);
      else if (tab === "rincian") { el.innerHTML = rincian(ctx.j); halamanAkun(el); }
      else if (tab === "harian") {
        el.innerHTML = harianKerangka(ctx.indeks) + harianGrafik(ctx.indeks) + Monev.data.tampil.memuat(3);
        pasangGrafikHarian(el, ctx.indeks);
        muatHarian();
      } else if (tab === "target") {
        el.innerHTML = target(ctx.T, ctx.j);
        pasangGrafikTarget(el, ctx.T, ctx.j);
        halamanHari(el);
      }
      kembali();
    }

    function muatHarian() {
      var H = STATE.harian, indeks = ctx.indeks;
      var cari = function (file) { return file ? muat("arsip/" + file, ta) : Promise.resolve(null); };
      Promise.all([cari(H.a), cari(H.b).catch(function () { return null; })]).then(function (hasil) {
        if (!el.isConnected) return;
        ctx.ja = hasil[0]; ctx.jb = hasil[1];
        var muatEl = el.querySelector('[aria-busy="true"]');
        var div = document.createElement("div");
        div.innerHTML = harianTabel(indeks, ctx.ja, ctx.jb);
        if (muatEl) muatEl.replaceWith(div.firstChild);
      }).catch(function () {
        var muatEl = el.querySelector('[aria-busy="true"]');
        if (muatEl) muatEl.outerHTML = Monev.data.tampil.gagal("Arsip realisasi tanggal terpilih gagal dimuat", "");
      });
    }

    var janji;
    if (tab === "harian") {
      janji = muatOpsional("arsip/indeks.json", ta).then(function (ix) {
        var daftar = ix && Array.isArray(ix.tanggal) ? ix.tanggal.filter(function (x) { return x.tanggal; }) : [];
        if (!daftar.filter(function (x) { return x.file; }).length) {
          el.innerHTML = Monev.data.tampil.kosong("Arsip harian belum ada",
            "Perbandingan harian membutuhkan arsip realisasi per tanggal. Arsip bertambah setiap kali data realisasi diterbitkan.",
            { label: "Lihat realisasi terakhir", href: "#anggaran" });
          return false;
        }
        ctx.indeks = daftar;
        return true;
      });
    } else if (tab === "target") {
      janji = Promise.all([muatOpsional("target.json", ta), muatOpsional("latest.json", ta).catch(function () { return null; })]).then(function (h) {
        if (!h[0] || !h[0].units || !h[0].units.length) {
          el.innerHTML = Monev.data.tampil.kosong("Target serapan belum tersedia",
            "Target serapan per unit kerja diisi admin di halaman kerja (sheet TARGET_SERAPAN) lalu diterbitkan.", null);
          return false;
        }
        ctx.T = h[0]; ctx.T.snaps = ctx.T.snaps || []; ctx.j = h[1];
        return true;
      });
    } else {
      janji = muat("latest.json", ta).then(function (j) { ctx.j = j; return true; });
    }

    janji.then(function (ok) {
      if (!ok || !el.isConnected) return;
      gambar();
      pasang();
    }).catch(function (err) { gagal(err, tab === "harian" ? "Arsip realisasi" : tab === "target" ? "Target serapan" : "Data anggaran"); });

    function pasang() {
      var tundaUkur;
      window.addEventListener("resize", function ukurUlang() {
        if (!el.isConnected) { window.removeEventListener("resize", ukurUlang); return; }
        if (tab !== "target") return;
        clearTimeout(tundaUkur); tundaUkur = setTimeout(function () { halamanHari(el); }, 200);
      });
      el.addEventListener("change", function (ev) {
        var t = ev.target, k = t.getAttribute("data-pilih");
        if (!k) return;
        if (k === "unit") { STATE.unit = t.value; if (t.value) STATE.kegiatan = ""; }
        else if (k === "kegiatan") { STATE.kegiatan = t.value; if (t.value) STATE.unit = ""; }
        else if (k === "komoditas") STATE.komoditas = t.value;
        else if (k === "r-satker") { STATE.rinci.satker = t.value; STATE.rinci.akunHal = 0; }
        else if (k === "r-kegiatan") { STATE.rinci.kegiatan = t.value; STATE.rinci.kro = ""; STATE.rinci.akunHal = 0; }
        else if (k === "r-kro") STATE.rinci.kro = t.value;
        else if (k === "h-a") STATE.harian.a = t.value;
        else if (k === "h-b") STATE.harian.b = t.value;
        else if (k === "h-ukur") STATE.harian.ukur = t.value;
        else if (k === "t-unit") { STATE.target.unit = t.value; STATE.target.hariHal = null; }
        gambar();
      });
      el.addEventListener("click", function (ev) {
        var t = ev.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.hasAttribute("data-segmen")) {
          var s = t.getAttribute("data-segmen"), v = t.getAttribute("data-nilai");
          if (s === "mode") STATE.mode = v; else if (s === "jalur") { STATE.target.jalur = v; STATE.target.hariHal = null; }
          var id = "seg-" + s + "-" + v; t.id = id; gambar(); var x = el.querySelector('[data-segmen="' + s + '"][data-nilai="' + v + '"]'); if (x) x.focus();
        } else if (t.hasAttribute("data-buka")) {
          var kunci = t.getAttribute("data-buka");
          STATE.rinci.buka[kunci] = !STATE.rinci.buka[kunci];
          gambar();
          var b = el.querySelector('[data-buka="' + (window.CSS && CSS.escape ? CSS.escape(kunci) : kunci) + '"]'); if (b) b.focus();
        } else if (t.hasAttribute("data-buka-semua")) {
          var buka = t.getAttribute("data-buka-semua") === "1";
          STATE.rinci.buka = {};
          if (buka) { var P = dataRinci(ctx.j); for (var tk = 0; tk < 4; tk++) P[tk].forEach(function (r) { STATE.rinci.buka[kunciDari(r, tk)] = true; }); }
          gambar();
        } else if (t.hasAttribute("data-hari-hal")) {
          var arahH = t.getAttribute("data-hari-hal");
          STATE.target.hariHal += +arahH;
          halamanHari(el);
          var hb = el.querySelector('[data-hari-hal="' + arahH + '"]');
          if (hb && !hb.disabled) hb.focus(); else { var hl = el.querySelector("[data-hari-hal]:not([disabled])"); if (hl) hl.focus(); }
        } else if (t.hasAttribute("data-akun-hal")) {
          var arah = t.getAttribute("data-akun-hal");
          STATE.rinci.akunHal += +arah;
          halamanAkun(el);
          var pb = el.querySelector('[data-akun-hal="' + arah + '"]');
          if (pb && !pb.disabled) pb.focus(); else { var lain = el.querySelector("[data-akun-hal]:not([disabled])"); if (lain) lain.focus(); }
        } else if (t.hasAttribute("data-jenis")) {
          STATE.rinci.jenis = t.getAttribute("data-jenis"); STATE.rinci.akunHal = 0; gambar();
          var jb = el.querySelector('[data-jenis="' + STATE.rinci.jenis + '"]'); if (jb) jb.focus();
        } else if (t.hasAttribute("data-t-unit")) {
          STATE.target.unit = t.getAttribute("data-t-unit"); STATE.target.hariHal = null; gambar();
        } else if (t.hasAttribute("data-ke-kontrak")) {
          if (Monev.menu.kontrak && Monev.menu.kontrak.saringUnit) Monev.menu.kontrak.saringUnit(t.getAttribute("data-ke-kontrak"));
          location.hash = "#kontrak";
        } else if (t.hasAttribute("data-excel")) {
          unduhExcel(ctx.j, ta);
        } else if (t.hasAttribute("data-csv")) {
          unduh(t.getAttribute("data-csv"), ctx);
        }
      });
    }
  }

  /* Tombol aksi di judul halaman berada di luar wadah isi: Unduh Excel ditangani di sini. */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-anggaran-excel]");
    if (!t) return;
    var ta = Monev.tahun.aktif();
    muat("latest.json", ta).then(function (j) { unduhExcel(j, ta); }).catch(function () {
      alert("Data anggaran TA " + ta + " belum tersedia, Excel belum bisa dibuat.");
    });
  });

  Monev.menu = Monev.menu || {};
  Monev.menu.anggaran = {
    aksi: function (r) {
      if (r.sub && r.sub.id) return "";
      return '<a class="tombol tombol-sekunder" href="#unggah">Unggah data realisasi</a>' +
        tombolMasuk("Blokir dan tambahan hibah", false, "realisasi") +
        '<span class="tombol tombol-ppt" role="link" aria-disabled="true" title="Paparan PPT sementara dibuat di halaman kerja">Unduh paparan (PPT)</span>' +
        '<button type="button" class="tombol tombol-utama" data-anggaran-excel>Unduh Excel realisasi</button>';
    },
    isi: function (el, r) { isiTab(el, r, Monev.tahun.aktif()); },
    /* untuk uji di luar peramban (bentuk data lama dan baru) */
    _model: model,
    _mesinTarget: mesinTarget,
    /* dipakai Beranda supaya angkanya sama dengan tab asal */
    _selisihUnit: selisihUnit,
    _barBaris: barBaris,
    _legendaBar: legendaBar
  };
})();
