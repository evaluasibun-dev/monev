/* Pilih tahun anggaran dan lintas tahun — alamat #tahun. Mockup: Tahun.
   Daftar tahun dan statusnya dari data/tahun.json (berjalan · ditutup · belum_dimulai); TA baru dibuka tanpa mengubah kode.
   Angka kartu dan tabel antartahun dihitung dengan fungsi menu asal:
   - Anggaran: Monev.menu.anggaran._model (kartu Realisasi anggaran)
   - Kontrak: Monev.menu.kontrak._ringkas (kartu Ringkasan, kontrak aktif)
   - Bantuan: RekapInti.kartu (kartu Rekap nasional) dan Monev.menu.bantuan._headline (angka utama Jejak, hanya tahun berjalan)
   Tahun belum dimulai tidak dimuat datanya (tampil "–"). */
(function () {
  "use strict";

  var e = function (s) { return Monev.esc(s); };
  var F = function () { return Monev.format; };

  var STATUS = {
    berjalan: { teks: "Berjalan", kelas: "chip-ok" },
    ditutup: { teks: "Ditutup", kelas: "chip-neutral" },
    belum_dimulai: { teks: "Belum dimulai", kelas: "chip-neutral" }
  };
  /* Per tahun: undefined = memuat; {j, K, rekap, Sb} (null = belum terbit, {gagal} = gagal). */
  var DATA = {};

  function siap(x) { return x && !x.gagal && !x.nonaktif; }
  function opsional(p) { return p.then(function (v) { return v; }, function (err) { return err && err.status === 404 ? null : { gagal: true }; }); }
  function persen(p) { return p == null || !isFinite(p) ? "–" : F().persen(p); }

  /* ---------------- angka per tahun ---------------- */
  function ukuran(ta) {
    var d = DATA[ta] || {}, o = {};
    if (siap(d.j)) {
      var m = Monev.menu.anggaran._model(d.j);
      o.pagu = m.total.pagu; o.sp2d = m.total.pct; o.sp2dOs = m.total.pct2; o.dataPer = m.dataPer;
    }
    if (siap(d.K)) { var a = Monev.menu.kontrak._ringkas(d.K, "").a; o.kontrak = a.n; o.nilaiKontrak = a.nilai; o.kontrakPer = d.K.data_per; }
    if (siap(d.rekap)) {
      var R = window.RekapInti, k = R.kartu(R.baca(d.rekap));
      o.paguBantuan = k.pagu; o.terbayar = k.pagu ? k.terbayar / k.pagu * 100 : null;
      o.fisik = k.target_reg > 0 ? k.realisasi_reg / k.target_reg * 100 : null; o.rekapPer = d.rekap.data_per;
    }
    if (siap(d.Sb)) {
      var A = siap(d.rekap) ? window.RekapInti.perKomoditas(window.RekapInti.baca(d.rekap)) : {};
      o.tanam = Monev.menu.bantuan._headline(d.Sb, A).tanam;
    }
    return o;
  }

  function muat(daftar, segar) {
    daftar.forEach(function (t) {
      if (t.status === "belum_dimulai" || (DATA[t.ta] && !segar)) return;
      var d = DATA[t.ta] = { j: undefined, K: undefined, rekap: undefined, Sb: t.status === "berjalan" ? undefined : { nonaktif: true } };
      var set = function (k) { return function (v) { d[k] = v; gambarUlang(); }; };
      opsional(Monev.data.muatTahun("anggaran/latest.json", t.ta)).then(set("j"));
      opsional(Monev.menu.kontrak._muat(t.ta)).then(set("K"));
      opsional(Monev.data.muatTahun("integrasi/rekap.json", t.ta)).then(set("rekap"));
      if (t.status === "berjalan") window.Sisbun.ambilBersama(false).then(function (o) { return o; }, function () { return { gagal: true }; }).then(set("Sb"));
    });
  }

  /* ---------------- tampilan ---------------- */
  function mini(label, nilai, memuat) {
    return '<div class="tahun-mini"><span class="kartu-label">' + e(label) + "</span>" +
      (memuat ? '<span class="kerangka-muat" aria-hidden="true"><span></span></span><span class="sr-only">Memuat…</span>' : '<strong>' + e(nilai) + "</strong>") + "</div>";
  }

  function kartuTahun(t, aktif, persiapan) {
    var st = STATUS[t.status] || { teks: t.status, kelas: "chip-neutral" };
    var d = DATA[t.ta], o = ukuran(t.ta), angka, aksi;
    if (t.status === "berjalan") {
      angka = mini("Realisasi SP2D", persen(o.sp2d), d && d.j === undefined) + mini("Lahan ditanam", persen(o.tanam), d && (d.Sb === undefined || (siap(d.Sb) && d.rekap === undefined)));
    } else if (t.status === "ditutup") {
      angka = mini("Realisasi SP2D", persen(o.sp2d), d && d.j === undefined) + mini("Capaian fisik", persen(o.fisik), d && d.rekap === undefined);
    } else {
      angka = mini("Pagu", "–") + mini("Kontrak", "–");
    }
    if (t.status === "belum_dimulai") {
      aksi = t.ta === persiapan
        ? '<button type="button" class="tautan-sel kartu-tautan" data-tahun-gulir="tahun-baru">Lihat persiapan</button>'
        : '<span class="kartu-tautan teks-redup">Belum tersedia</span>';
    } else {
      aksi = '<button type="button" class="tautan-sel kartu-tautan" data-tahun-buka="' + t.ta + '">' +
        (t.ta === aktif ? "Buka Beranda TA " + t.ta : "Buka TA " + t.ta + (t.status === "ditutup" ? " (arsip)" : "")) + "</button>";
    }
    var ket = t.keterangan || (t.status === "belum_dimulai" ? "Dibuka admin setelah DIPA " + t.ta + " terbit." : t.status === "ditutup" ? "Angka akhir tahun, dibuka sebagai arsip." : "");
    return '<article class="kartu-tahun"' + (t.ta === aktif ? ' aria-current="true"' : "") + ">" +
      '<div class="kartu-tahun-kepala"><span class="ta">TA ' + t.ta + '</span><span class="chip ' + st.kelas + '">' + e(st.teks) + "</span></div>" +
      '<span class="ket">' + e(ket) + "</span>" +
      '<div class="tahun-angka">' + angka + "</div>" +
      (t.ta === aktif ? '<span class="chip chip-ok">Sedang dipakai</span>' : "") + aksi + "</article>";
  }

  var BARIS = [
    ["Pagu", "pagu", function (v) { return F().rupiahM(v); }, "anggaran"],
    ["Realisasi SP2D", "sp2d", persen, "anggaran"],
    ["SP2D + outstanding", "sp2dOs", persen, "anggaran"],
    ["Kontrak aktif", "kontrak", function (v) { return F().satuan(v, "").trim(); }, "kontrak"],
    ["Nilai kontrak aktif", "nilaiKontrak", function (v) { return F().rupiahM(v); }, "kontrak"],
    ["Pagu bantuan", "paguBantuan", function (v) { return F().rupiahM(v); }, "rekap"],
    ["Anggaran bantuan terbayar", "terbayar", persen, "rekap"],
    ["Capaian fisik (reguler)", "fisik", persen, "rekap"]
  ];
  var MUAT = { anggaran: "j", kontrak: "K", rekap: "rekap" };

  function tabelLintas(daftar) {
    var U = {};
    daftar.forEach(function (t) { U[t.ta] = ukuran(t.ta); });
    var kepala = '<thead><tr><th scope="col">Ukuran</th>' + daftar.map(function (t) { return '<th scope="col" class="angka">' + t.ta + "</th>"; }).join("") + "</tr></thead>";
    var badan = BARIS.map(function (b) {
      return "<tr><td>" + e(b[0]) + "</td>" + daftar.map(function (t) {
        var d = DATA[t.ta], v = U[t.ta][b[1]];
        if (d && d[MUAT[b[3]]] === undefined) return '<td class="angka teks-redup">…</td>';
        return '<td class="angka' + (v == null ? " teks-redup" : "") + '">' + (v == null ? "–" : e(b[2](v))) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    var per = '<tr><td>Data per</td>' + daftar.map(function (t) {
      var x = U[t.ta].dataPer;
      return '<td class="angka teks-redup">' + (x ? e(F().tanggal(x)) : "–") + "</td>";
    }).join("") + "</tr>";
    return '<div class="wadah-tabel"><table class="tabel">' + kepala + "<tbody>" + badan + per + "</tbody></table></div>";
  }

  /* Penyiapan tahun baru belum punya halaman kerja: langkahnya dikerjakan admin manual (RENCANA Tahap 8). */
  function tombolMasuk(label) {
    return '<span class="tombol tombol-utama" role="link" aria-disabled="true" title="Dikerjakan admin manual sesuai langkah di atas">' + e(label) + "</span>";
  }

  function langkahBaru(daftar) {
    var berjalan = daftar.filter(function (t) { return t.status === "berjalan"; })[0];
    var baru = daftar.filter(function (t) { return t.status === "belum_dimulai"; })[0];
    if (!baru) return seksiPolos("Membuka tahun baru (admin)", '<p class="paragraf-kecil">Semua tahun di data/tahun.json sudah dibuka.</p>');
    var n = baru.ta, lama = berjalan ? berjalan.ta : n - 1;
    var L = [
      "Buat folder data TA " + n + " di repo monev (data/" + n + ") dan di Shared Drive.",
      "Buat Spreadsheet database kontrak TA " + n + " dari templat yang sama, dimulai kosong.",
      "Isi target serapan, blokir, dan daftar kegiatan atau unit kerja bila ada perubahan struktur.",
      "Master Lokus, pengguna, dan peran dipakai bersama, tidak perlu diisi ulang.",
      "Di data/tahun.json: ubah status TA " + n + " menjadi \"berjalan\" dan jadikan " + n + " tahun bawaan (\"bawaan\": " + n + ").",
      "Tutup TA " + lama + ": ubah statusnya menjadi \"ditutup\". Unggahan berikutnya ditolak; data tetap bisa dibuka sebagai arsip."
    ];
    return '<section class="seksi" id="tahun-baru" tabindex="-1"><h2>Membuka tahun baru (admin)</h2><ol class="langkah-tahun">' +
      L.map(function (x, i) { return '<li><span class="langkah-nomor" aria-hidden="true">' + (i + 1) + "</span><span>" + e(x) + "</span></li>"; }).join("") + "</ol>" +
      '<div class="baris-alat">' + tombolMasuk("Siapkan TA " + n) + '<span class="catatan">Langkah di atas dikerjakan admin secara manual (RENCANA Tahap 8); belum ada tombol otomatis di halaman kerja.</span></div></section>';
  }
  function seksiPolos(judul, isi) { return '<section class="seksi"><h2>' + e(judul) + "</h2>" + isi + "</section>"; }

  function isiHalaman() {
    var daftar = Monev.tahun.daftar(), aktif = Monev.tahun.aktif();
    var persiapan = (daftar.filter(function (t) { return t.status === "belum_dimulai"; })[0] || {}).ta;
    var awal = daftar.length ? daftar[0].ta : "", akhir = daftar.length ? daftar[daftar.length - 1].ta : "";
    return '<section class="daftar-tahun" aria-label="Daftar tahun anggaran">' + daftar.map(function (t) { return kartuTahun(t, aktif, persiapan); }).join("") + "</section>" +
      '<div class="pita-lintas"><span class="pita-lintas-teks"><strong>Lintas tahun ' + e(awal + "–" + akhir) + "</strong>" +
      "<span>Bandingkan realisasi akhir tahun, capaian fisik, dan nilai kontrak antartahun, sejalan dengan periode Pedoman Monev 2025–2029.</span></span>" +
      '<button type="button" class="tombol tombol-sekunder" data-tahun-gulir="lintas">Buka perbandingan</button></div>' +
      '<div class="grid-dua">' +
      '<section class="seksi" id="lintas" tabindex="-1"><div class="seksi-kepala"><h2>Perbandingan antartahun</h2>' +
      '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-tahun-csv>Unduh CSV</button></div>' + tabelLintas(daftar) +
      '<p class="catatan">Angka tahun berjalan berubah sampai tahun ditutup; setelah itu menjadi angka akhir tahun. Pagu, SP2D, dan outstanding dari menu Anggaran; kontrak aktif dari menu Kontrak; bantuan dan capaian fisik dari Rekap nasional (hasil integrasi). Tahun yang belum dimulai belum punya data.</p></section>' +
      langkahBaru(daftar) + "</div>";
  }

  function gambarUlang() {
    var el = document.getElementById("isi-tahun");
    if (!el) return;
    var fokus = document.activeElement && document.activeElement.getAttribute && (document.activeElement.getAttribute("data-tahun-buka") || document.activeElement.getAttribute("data-tahun-gulir"));
    el.innerHTML = isiHalaman();
    if (fokus) { var x = el.querySelector('[data-tahun-buka="' + fokus + '"], [data-tahun-gulir="' + fokus + '"]'); if (x) x.focus(); }
  }

  function unduhCSV() {
    var daftar = Monev.tahun.daftar(), U = {};
    daftar.forEach(function (t) { U[t.ta] = ukuran(t.ta); });
    var bulat = function (v, k) { return v == null ? "" : /sp2d|terbayar|fisik/i.test(k) ? +v.toFixed(1) : v; };
    Monev.unduhCSV("perbandingan-antartahun.csv", ["Ukuran"].concat(daftar.map(function (t) { return "TA " + t.ta; })),
      BARIS.map(function (b) {
        var satuan = /pagu|nilai/i.test(b[1]) ? " (Rp)" : b[1] === "kontrak" ? "" : " (%)";
        return [b[0] + satuan].concat(daftar.map(function (t) { return bulat(U[t.ta][b[1]], b[1]); }));
      }).concat([["Data per"].concat(daftar.map(function (t) { return U[t.ta].dataPer || ""; }))]));
  }

  var terpasang = false;
  function pasangSekali() {
    if (terpasang) return; terpasang = true;
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-tahun-buka], [data-tahun-gulir], [data-tahun-csv]");
      if (!t || !document.getElementById("isi-tahun")) return;
      if (t.hasAttribute("data-tahun-buka")) {
        var ta = parseInt(t.getAttribute("data-tahun-buka"), 10);
        location.hash = "#beranda";
        Monev.tahun.pilih(ta);
      } else if (t.hasAttribute("data-tahun-gulir")) {
        var s = document.getElementById(t.getAttribute("data-tahun-gulir"));
        if (s) { s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); s.focus({ preventScroll: true }); }
      } else unduhCSV();
    });
  }

  Monev.halaman = Monev.halaman || {};

  Monev.halaman.tahun = function () {
    pasangSekali();
    var daftar = Monev.tahun.daftar();
    setTimeout(function () { muat(daftar, false); gambarUlang(); }, 0);
    return '<div class="judul-halaman"><div class="judul-halaman-teks">' +
      "<h1>Pilih tahun anggaran</h1>" +
      "<p>Setiap tahun punya data, database kontrak, target, dan laporan sendiri. Menu dan tampilan sama untuk semua tahun. Tahun yang sudah selesai tetap bisa dibuka sebagai arsip. Pilihan tahun disimpan di peramban ini.</p>" +
      "</div></div>" + '<div id="isi-tahun">' + Monev.data.tampil.memuat(4) + "</div>";
  };
})();
