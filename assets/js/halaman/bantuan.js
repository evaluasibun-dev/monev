/* Menu Bantuan — #bantuan (Jejak komoditas), #bantuan-nasional (Rekap nasional), #bantuan-provinsi (Rekap per provinsi).
   Sumber: API publik Sisbun (assets/js/sisbun.js) untuk CPCL, kontrak benih, jadwal salur, dan luas tanam;
   data/<ta>/integrasi/rekap.json (RekapInti_ di monev-gas, dari hasil integrasi) untuk target fisik SAT 3, realisasi tanam
   Hilirisasi, pagu, dan anggaran terbayar; data/<ta>/bantuan/titik-pemantauan.json dan catatan-lapangan.json (admin);
   data/<ta>/laporan/terbit/ untuk pembanding dan titik tanam akhir bulan.
   Mockup: Jejak, RekapNasional, RekapProvinsi, RekapPDF. Pindahan fitur jejak.html lama (akhnoer85) dan web lama
   evaluasibun-dev/monev (rekap nasional/provinsi, cetak PDF). */
(function () {
  "use strict";

  var e = function (s) { return Monev.esc(s); };
  var F = function () { return Monev.format; };
  var R = function () { return window.RekapInti; };
  var S = function () { return window.Sisbun; };
  var KOMODITAS = ["Kelapa", "Kopi", "Kakao", "Pala", "Lada", "Jambu mete", "Tebu"];
  var UKURAN = [["tanam", "Lahan ditanam"], ["cpcl", "CPCL"], ["benih", "Benih dipesan"], ["uang", "Anggaran terbayar"]];
  var JEDA_AUTO = 30 * 60 * 1000;

  var STATE = {
    kom: "Kelapa", ukuran: "tanam", petaKom: "", prov: "", tren: "tanam",
    nas: { sumber: "", komoditas: "", bencana: false },
    pv: { provinsi: "", sumber: "", komoditas: "", kabHal: null, kabKunci: "" }
  };
  var D = { ta: null, sisbun: null, rekap: undefined, titik: null, catatan: null, lap: null, satker: {}, waktuMuat: 0 };

  /* ---------- pembantu tampilan ---------- */
  function seksi(judul, isi, opsi) {
    opsi = opsi || {};
    return '<section class="seksi' + (opsi.kelas ? " " + opsi.kelas : "") + '"' + (opsi.id ? ' id="' + opsi.id + '"' : "") + ">" +
      '<div class="seksi-kepala"><h2>' + e(judul) + "</h2>" + (opsi.kanan || "") + "</div>" + isi + "</section>";
  }
  function segmen(kunci, daftar, nilai, label) {
    return '<div class="segmen" role="group" aria-label="' + e(label) + '">' + daftar.map(function (d) {
      return '<button type="button" data-bseg="' + kunci + '" data-nilai="' + e(d[0]) + '" aria-pressed="' + (d[0] === nilai ? "true" : "false") + '">' + e(d[1]) + "</button>";
    }).join("") + "</div>";
  }
  function chip(kelas, teks) { return '<span class="chip chip-' + kelas + '">' + e(teks) + "</span>"; }
  function chipSumber(sd) { return sd === "ABT" ? chip("abt", "ABT") : sd === "REGULER" ? chip("ok", "Reguler") : '<span class="teks-redup">–</span>'; }
  function lebarBar(p) { return p > 0 && p < 1 ? 1 : Math.min(100, Math.max(0, p)); }
  function barSatu(p, kelas) { return '<div class="bar" aria-hidden="true"><div class="' + (kelas || "bar-sp2d") + '" style="width:' + lebarBar(p) + '%"></div></div>'; }
  function pct(a, b) { return b > 0 ? F().persen(a / b * 100) : "–"; }
  function fisik(v, satuan) {
    if (!v) return '<span class="teks-redup">–</span>';
    return satuan === "Hektar" ? F().hektar(v) : F().satuan(v, String(satuan || "").toLowerCase());
  }
  function namaProv(n) { return R().namaProvinsi(n); }
  function tombolCSV(id) { return '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-bantuan-csv="' + id + '">Unduh CSV</button>'; }
  function sumberRekap(j) { return j && j.data_per ? "Hasil integrasi per " + F().tanggal(j.data_per) : "Hasil integrasi belum terbit"; }

  /* ---------- muat data ---------- */
  function opsional(p) { return p.catch(function () { return null; }); }
  function muatRekap(ta) {
    return Monev.data.muatTahun("integrasi/rekap.json", ta).catch(function (err) { if (err && err.status === 404) return null; throw err; });
  }
  /** Laporan terbit: pembanding tanam (terbaru) dan titik tanam akhir bulan setelah titik tetap terakhir. */
  function muatLaporan(ta, batasTanggal) {
    return Monev.data.muatTahun("laporan/terbit/indeks.json", ta).then(function (ind) {
      var L = ((ind && ind.laporan) || []).slice().sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
      if (!L.length) return null;
      var perBulan = {};
      L.forEach(function (x) { var b = x.tanggal.slice(0, 7); if (!perBulan[b] && x.tanggal > (batasTanggal || "")) perBulan[b] = x; });
      var pilih = Object.keys(perBulan).sort().slice(-3).map(function (b) { return perBulan[b]; });
      if (pilih.indexOf(L[0]) < 0) pilih.push(L[0]);
      return Promise.all(pilih.map(function (x) {
        return opsional(Monev.data.muatTahun("laporan/terbit/" + (x.file || x.tanggal + ".json"), ta)).then(function (lap) { return lap ? { x: x, lap: lap } : null; });
      })).then(function (hasil) {
        hasil = hasil.filter(Boolean);
        var terbaru = hasil.filter(function (h) { return h.x === L[0]; })[0];
        var tanam = function (lap) { var o = {}; (lap.komoditas || []).forEach(function (k) { o[k.nama] = k; }); return o; };
        return {
          terbaru: terbaru ? { tanggal: terbaru.x.tanggal, kom: tanam(terbaru.lap) } : null,
          titik: hasil.filter(function (h) { return h.x.tanggal > (batasTanggal || ""); })
            .sort(function (a, b) { return a.x.tanggal < b.x.tanggal ? -1 : 1; })
            .map(function (h) { return { tanggal: h.x.tanggal, kom: tanam(h.lap) }; })
        };
      });
    }).catch(function () { return null; });
  }

  /* ============================== JEJAK ============================== */
  function olahSemua() {
    var O = {}, lap = D.lap && D.lap.terbaru;
    KOMODITAS.forEach(function (k) {
      var s = D.sisbun && D.sisbun.S[k];
      if (!s) return;
      var pr = lap && lap.kom[k] && lap.tanggal < (s.asof || "9999") ? lap.kom[k].tanam_ha : null;
      O[k] = S().olah(s, { prevR: pr, prevTgl: lap ? F().tanggal(lap.tanggal) : "" });
    });
    return O;
  }
  function anggaranKom() { return D.rekap ? R().perKomoditas(R().baca(D.rekap)) : {}; }

  /** Angka utama: % lahan ditanam (tebu ikut bila luas tanamnya sudah dilaporkan), rentang kontrak benih, % terbayar. */
  /* Sb = data Sisbun {S: {Kelapa: …}} (Sisbun.ambilSemua); dipakai juga Beranda. CPCL nasional memakai komoditas yang sama dengan lahan ditanam. */
  function headline(Sb, A) {
    var T = 0, Rr = 0, Cc = 0, tebuIkut = false, benih = [], P = 0, B = 0;
    KOMODITAS.forEach(function (k) {
      var s = Sb.S[k]; if (!s || !s.t) return;
      if (k === "Tebu") { if (s.r <= 0) return; tebuIkut = true; }
      T += s.t; Rr += s.r; Cc += s.c;
    });
    KOMODITAS.forEach(function (k) { var s = Sb.S[k]; if (s && s.t) benih.push(Math.min(100, s.v / s.t * 100)); });
    KOMODITAS.forEach(function (k) { if (A[k]) { P += A[k].pagu; B += A[k].terbayar; } });
    return {
      tanam: T ? Rr / T * 100 : null, T: T, R: Rr, tebuIkut: tebuIkut, cpcl: T ? Cc / T * 100 : null, C: Cc,
      benih: benih.length ? S().nf(Math.floor(Math.min.apply(null, benih))) + "–" + S().nf(Math.round(Math.max.apply(null, benih))) + "%" : "–",
      benihMin: benih.length ? Math.min.apply(null, benih) : null, benihMax: benih.length ? Math.max.apply(null, benih) : null,
      uang: P ? B / P * 100 : null, P: P, B: B
    };
  }

  function nilaiUkuran(k, ukuran, A) {
    var s = D.sisbun.S[k];
    if (ukuran === "uang") { var a = A[k]; return a && a.pagu ? { p: a.terbayar / a.pagu * 100, teks: F().rupiahM(a.terbayar) + " dari " + F().rupiahM(a.pagu) } : null; }
    if (!s || !s.t) return null;
    if (ukuran === "tanam") return k === "Tebu" && s.r <= 0 ? null : { p: s.r / s.t * 100, teks: S().ha(s.r) + " dari " + S().ha(s.t) };
    if (ukuran === "cpcl") return { p: s.c / s.t * 100, teks: S().ha(s.c) };
    return { p: s.v / s.t * 100, teks: S().jml(s.vb, S().satuan(k)) + " (" + S().ha(s.v) + ")" };
  }

  function htmlHero(O, A) {
    var H = headline(D.sisbun, A), sb = D.sisbun;
    var info = sb.lama ? '<div class="banner" role="status">Sisbun tidak bisa dihubungi. Menampilkan data terakhir per ' + e(F().tanggal(sb.asof)) +
      " (dibaca " + e(F().waktu(sb.diambil)) + ').<button type="button" class="tombol tombol-sekunder tombol-kecil" data-bantuan-aksi="perbarui">Coba lagi</button></div>' : "";
    return '<section class="seksi">' + info +
      "<h2>Jejak bantuan perkebunan " + e(D.ta) + "</h2>" +
      '<p class="paragraf-kecil">Sampai mana bantuan benih, pupuk, dan upah kerja untuk tujuh komoditas sudah berjalan, dari penetapan penerima sampai ditanam di kebun. CPCL, kontrak benih, dan luas tanam dibaca langsung dari Sisbun; anggaran terbayar dari hasil integrasi.</p>' +
      '<div class="grid-kartu grid-kartu-padat">' +
      kartuJejak(H.tanam == null ? "–" : F().persen(H.tanam), "lahan sasaran sudah dikerjakan atau ditanam " + (H.tebuIkut ? "(tujuh komoditas, termasuk tebu)" : "(di luar tebu)"), S().ha(H.R) + " dari " + S().ha(H.T)) +
      kartuJejak(H.benih, "benih sudah dipesan, sebagian besar masih dirawat di persemaian", "kontrak benih terhadap target kawasan") +
      kartuJejak(H.uang == null ? "–" : F().persen(H.uang), "anggaran kawasan dan benih tujuh komoditas sudah dibayarkan (SP2D akun 526 + produksi benih + KBD tebu)",
        H.P ? F().rupiahM(H.B) + " dari " + F().rupiahM(H.P) : "hasil integrasi belum terbit", "#bantuan-nasional") +
      "</div>" +
      '<p class="catatan">Sisbun per ' + e(F().tanggal(sb.asof)) + ", dibaca " + e(F().jam(sb.diambil)) + " · " + e(sumberRekap(D.rekap)) +
      (sb.lama ? "" : " · diperbarui otomatis tiap 30 menit") + "</p></section>";
  }
  function kartuJejak(nilai, label, ket, href) {
    return (href ? '<a class="kartu-angka" href="' + href + '">' : '<div class="kartu-angka">') +
      '<span class="kartu-nilai">' + e(nilai) + '</span><span class="paragraf-kecil">' + e(label) + '</span><span class="kartu-ket">' + e(ket) + "</span>" +
      (href ? '<span class="kartu-tautan">Rekap nasional</span></a>' : "</div>");
  }

  function htmlPilih(O) {
    return seksi("Pilih komoditas", '<div class="grid-komoditas">' + KOMODITAS.map(function (k) {
      var o = O[k], st = o ? S().STATUS[o.status] : S().STATUS.kosong;
      return '<button type="button" class="tombol-komoditas" data-bantuan-kom="' + e(k) + '" aria-pressed="' + (k === STATE.kom) + '">' +
        "<strong>" + e(k) + '</strong><span class="catatan">' + e(o ? o.fase : "Data belum ada") + "</span>" + chip(st.chip, st.label) + "</button>";
    }).join("") + "</div>");
  }

  function htmlDetail(O, A) {
    var k = STATE.kom, s = D.sisbun.S[k], o = O[k];
    if (!s || !o) return seksi(k, '<p class="paragraf-kecil">Data Sisbun untuk ' + e(k.toLowerCase()) + " belum ada.</p>");
    var st = S().STATUS[o.status];
    var KEAD = { selesai: ["ok", "Selesai"], berjalan: ["info", "Sedang berjalan"], belum: ["neutral", "Belum"], kosong: ["neutral", "Data belum ada"] };
    var tahap = '<ol class="tahapan" aria-label="Tahapan bantuan">' + o.tahap.map(function (t, i) {
      var kd = KEAD[t.keadaan];
      return '<li class="tahap tahap-' + t.keadaan + '"><span class="tahap-nomor" aria-hidden="true">' + (i + 1) + "</span>" + chip(kd[0], kd[1]) +
        "<strong>" + e(t.nama) + '</strong><span class="catatan">' + e(t.ket) + "</span></li>";
    }).join("") + "</ol>";
    var meter = '<div class="grid-meter">' + UKURAN.map(function (u) {
      var v = nilaiUkuran(k, u[0], A);
      return '<div class="meter"><div class="meter-kepala"><span>' + e(u[1]) + "</span><strong>" + (v ? F().persen(v.p) : "–") + "</strong></div>" +
        barSatu(v ? v.p : 0, u[0] === "tanam" ? "bar-sp2d" : "bar-os") + '<span class="catatan">' + e(v ? v.teks : (u[0] === "uang" ? "hasil integrasi belum terbit" : "belum dilaporkan")) + "</span></div>";
    }).join("") + "</div>";
    var a = A[k], uangKet = a ? "Anggaran terbayar " + F().rupiahM(a.terbayar) + " dari " + F().rupiahM(a.pagu) + " (kawasan " + pct(a.terbayar_kawasan, a.pagu_kawasan) +
      ", benih" + (k === "Tebu" ? " dan KBD" : "") + " " + pct(a.terbayar_benih, a.pagu_benih) + ")" + (a.pagu_abt ? "; termasuk ABT " + F().rupiahM(a.pagu_abt) + " untuk " + F().hektar(a.target_abt) + " yang belum punya realisasi fisik." : ".") : "";

    var W = D.satker[k], siapa;
    if (!W || W.memuat) siapa = Monev.data.tampil.memuat(3);
    else if (W.gagal) siapa = '<p class="paragraf-kecil">Data per satker gagal dibaca dari Sisbun. <button type="button" class="tautan-sel" data-bantuan-aksi="satker">Coba lagi</button></p>';
    else if (!W.rows.length) siapa = '<p class="paragraf-kecil">Sisbun belum mencatat CPCL per satker untuk komoditas ini.</p>';
    else siapa = '<div class="daftar-bar">' + W.rows.map(function (r) {
      return '<div class="baris-satker"><div class="baris-satker-kepala"><span>' + e(r[0]) + "</span><span>" + e(S().nf(r[2], r[2] % 1 && r[2] < 100 ? 1 : 0) + " / " + S().nf(r[1]) + " ha") + "</span></div>" +
        '<div class="bar bar-cpcl" aria-label="' + e(r[0] + ": ditanam " + S().ha(r[2]) + " dari CPCL " + S().ha(r[1])) + '"><div class="bar-sp2d" style="width:' + lebarBar(r[1] ? r[2] / r[1] * 100 : 0) + '%"></div></div></div>';
    }).join("") + "</div>";
    var cat = D.catatan && D.catatan.komoditas && D.catatan.komoditas[k];
    var lapangan = cat ? '<div class="kotak-status"><strong class="paragraf-kecil">Catatan lapangan (' + e(D.catatan.sumber || "laporan triwulan") + ", per " + e(F().tanggal(D.catatan.per)) + ")</strong>" +
      (cat.kenapa ? '<span class="paragraf-kecil">' + e(cat.kenapa) + "</span>" : "") + (cat.berikutnya ? '<span class="paragraf-kecil">' + e(cat.berikutnya) + "</span>" : "") + "</div>" : "";

    return '<section class="seksi" id="bantuan-detail"><div class="seksi-kepala"><div class="kolom-blok"><h2>' + e(k) + "</h2>" +
      '<span class="seksi-keterangan">' + e(o.bantuan + " · target " + S().ha(s.t) + " · " + o.jmlProv + " provinsi") + "</span></div>" + chip(st.chip, st.label) + "</div>" +
      (o.ringkas ? '<p class="paragraf-kecil">' + e(o.ringkas) + "</p>" : "") + tahap + meter +
      (uangKet ? '<p class="catatan">' + e(uangKet) + "</p>" : "") +
      '<div class="grid-dua"><div class="kolom-blok"><div class="seksi-kepala"><h3 class="subjudul">Siapa yang mengerjakan</h3>' +
      '<div class="legenda"><span><i class="bar-cpcl-i"></i>CPCL</span><span><i style="background:var(--brand)"></i>Ditanam</span></div></div>' + '<div class="isi-rata">' + siapa + "</div>" +
      '<span class="catatan">Dari kolom Satker Kawasan di Sisbun. Sisbun belum mencatat target per satker, jadi pembandingnya CPCL.</span></div>' +
      '<div class="kolom-blok"><h3 class="subjudul">Kenapa begini</h3><ul class="daftar-titik">' + o.kenapa.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" +
      '<h3 class="subjudul">Berikutnya</h3><ul class="daftar-titik">' + (o.berikutnya.length ? o.berikutnya : ["Tidak ada jadwal salur baru di Sisbun."]).map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" +
      lapangan +
      '<span class="catatan">Disusun otomatis dari angka: status membandingkan luas tanam dengan jadwal salur benih s.d. akhir bulan lalu (≥ 75% sesuai jadwal, 30–75% perlu dipercepat, &lt; 30% tertinggal jauh). Penyebab lapangan seperti kemarau atau SK belum terbit perlu ditambahkan manual.</span></div></div></section>';
  }

  function htmlBandingkan(O, A) {
    var u = STATE.ukuran;
    var daftar = KOMODITAS.map(function (k) { return { k: k, v: nilaiUkuran(k, u, A) }; })
      .sort(function (a, b) { return (b.v ? b.v.p : -1) - (a.v ? a.v.p : -1); });
    var catatan = { tanam: "Luas tanam desa dibanding target kawasan Sisbun.", cpcl: "CPCL dibanding target kawasan. Untuk pala, lada, dan jambu mete angka ini masih berupa usulan.",
      benih: "Kontrak benih dibanding target kawasan. Benih yang dipesan belum tentu sudah sampai ke petani.",
      uang: "Anggaran terbayar dibanding pagu kawasan dan benih per komoditas (hasil integrasi), termasuk ABT." }[u];
    return seksi("Bandingkan semua komoditas", segmen("ukuran", UKURAN, u, "Ukuran pembanding") +
      '<div class="daftar-bar">' + daftar.map(function (d) {
        var st = O[d.k] ? O[d.k].status : "kosong";
        return '<button type="button" class="baris-bar baris-bar-tombol" data-bantuan-kom="' + e(d.k) + '" aria-label="' + e(d.k + ": " + (d.v ? F().persen(d.v.p) : "belum dilaporkan") + ". Buka rincian") + '">' +
          '<span class="baris-label">' + e(d.k) + "</span>" + barSatu(d.v ? d.v.p : 0, u === "tanam" ? "bar-status-" + st : "bar-sp2d") +
          '<span class="baris-angka">' + (d.v ? F().persen(d.v.p) : "–") + "</span></button>";
      }).join("") + '</div><p class="catatan">' + e(catatan) + "</p>");
  }

  /* ---------- peta ---------- */
  function sasaranProv() {
    var t = {}, r = {}, per = {};
    KOMODITAS.forEach(function (k) {
      if (STATE.petaKom && STATE.petaKom !== k) return;
      var s = D.sisbun.S[k]; if (!s) return;
      s.provs.forEach(function (p) {
        t[p.n] = (t[p.n] || 0) + p.t; r[p.n] = (r[p.n] || 0) + p.r;
        if (p.t) (per[p.n] = per[p.n] || []).push([k, p.t, p.r]);
      });
    });
    return { t: t, r: r, per: per };
  }
  function htmlPeta() {
    var P = window.PetaProvinsi, Q = sasaranProv(), maks = 0;
    P.PROV.forEach(function (p) { maks = Math.max(maks, Q.t[p[1]] || 0); });
    var tingkat = function (v) { if (!v) return 0; var x = v / maks; return x <= 0.1 ? 1 : x <= 0.25 ? 2 : x <= 0.5 ? 3 : x <= 0.75 ? 4 : 5; };
    var urut = P.PROV.slice().sort(function (a, b) { return (a[1] === STATE.prov) - (b[1] === STATE.prov); });
    var svg = '<svg class="peta" viewBox="' + P.VIEWBOX + '" role="img" aria-label="Peta luas sasaran per provinsi">' + urut.map(function (p) {
      var v = Q.t[p[1]] || 0, lab = namaProv(p[1]) + ": " + (v ? S().ha(v) : "tidak ada sasaran");
      return '<path class="peta-prov peta-' + tingkat(v) + (p[1] === STATE.prov ? " terpilih" : "") + '" d="' + P.GEO[p[0]] + '" data-bantuan-prov="' + e(p[1]) + '" tabindex="0" role="button" aria-label="' + e(lab) + '"><title>' + e(lab) + "</title></path>";
    }).join("") + "</svg>";
    var batas = [0, 0.1, 0.25, 0.5, 0.75, 1].map(function (f) { return Math.round(maks * f); });
    var legenda = '<div class="legenda">' + [1, 2, 3, 4, 5].map(function (i) { return '<span><i class="peta-' + i + '"></i>' + e(S().nf(batas[i - 1] + 1) + "–" + S().nf(batas[i]) + " ha") + "</span>"; }).join("") +
      '<span><i class="peta-0"></i>Tidak ada sasaran</span></div>';
    var opsiKom = '<label class="sr-only" for="b-peta-kom">Komoditas di peta</label><select id="b-peta-kom" data-bantuan-pilih="petaKom"><option value="">Semua komoditas</option>' +
      KOMODITAS.map(function (k) { return '<option value="' + e(k) + '"' + (k === STATE.petaKom ? " selected" : "") + ">" + e(k) + "</option>"; }).join("") + "</select>";
    var opsiProv = '<label class="label-kecil" for="b-peta-prov">Provinsi kecil (DKI, DIY, Bali) dipilih dari daftar</label><select id="b-peta-prov" data-bantuan-pilih="prov"><option value="">Pilih provinsi</option>' +
      P.PROV.slice().sort(function (a, b) { return a[1] < b[1] ? -1 : 1; }).map(function (p) { return '<option value="' + e(p[1]) + '"' + (p[1] === STATE.prov ? " selected" : "") + ">" + e(namaProv(p[1])) + "</option>"; }).join("") + "</select>";
    return seksi("Peta sebaran per provinsi", '<div class="baris-alat">' + opsiKom + "</div>" + '<div class="wadah-peta">' + svg + "</div>" + legenda +
      '<div class="baris-alat baris-alat-kolom">' + opsiProv + "</div>" + htmlKartuProv(Q) +
      '<p class="catatan">Luas sasaran dan luas tanam per provinsi dari Sisbun. Makin gelap makin luas sasaran. Batas provinsi disederhanakan dan pulau sangat kecil tidak digambar.</p>',
      { kanan: '<a class="tautan-kecil" href="#bantuan-provinsi">Rekap per provinsi</a>', id: "bantuan-peta" });
  }
  function htmlKartuProv(Q) {
    if (!STATE.prov) return '<p class="paragraf-kecil">Ketuk provinsi di peta untuk melihat rinciannya.</p>';
    var items = (Q.per[STATE.prov] || []).sort(function (a, b) { return b[1] - a[1]; });
    var t = Q.t[STATE.prov] || 0, r = Q.r[STATE.prov] || 0;
    var kabar = (D.catatan && D.catatan.provinsi && D.catatan.provinsi[STATE.prov]) || [];
    if (STATE.petaKom) kabar = kabar.filter(function (x) { return x.toLowerCase().indexOf(STATE.petaKom.toLowerCase()) >= 0; });
    return '<div class="kotak-status"><div class="kotak-status-kepala"><strong>' + e(namaProv(STATE.prov)) + "</strong>" +
      '<button type="button" class="tautan-sel" data-bantuan-buka-prov="' + e(STATE.prov) + '">Rekap provinsi</button></div>' +
      '<span class="paragraf-kecil">' + (t ? "Sasaran " + e(S().ha(t)) + ", sudah ditanam " + e(S().ha(r)) + " (" + e(pct(r, t)) + ")" : "Tidak ada sasaran kawasan tercatat di Sisbun") + "</span>" +
      (items.length ? '<table class="tabel"><thead><tr><th scope="col">Komoditas</th><th scope="col" class="angka">Ditanam / sasaran</th></tr></thead><tbody>' + items.map(function (i) {
        return "<tr><td>" + e(i[0]) + '</td><td class="angka">' + e(S().nf(i[2], i[2] % 1 && i[2] < 100 ? 1 : 0) + " / " + S().ha(i[1])) + "</td></tr>";
      }).join("") + "</tbody></table>" : "") +
      (D.catatan ? '<strong class="paragraf-kecil">Kabar lapangan (' + e(D.catatan.sumber || "laporan triwulan") + ")</strong>" +
        (kabar.length ? '<ul class="daftar-titik">' + kabar.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" : '<span class="catatan">Belum ada kabar lapangan untuk provinsi ini.</span>') : "") +
      "</div>";
  }

  /* ---------- perkembangan ---------- */
  function kolomTren() {
    var K = [];
    ((D.titik && D.titik.titik) || []).forEach(function (t) { K.push({ label: t.label || F().tanggal(t.tanggal), sumber: t.sumber, nilai: t[STATE.tren] || null }); });
    if (STATE.tren === "tanam" && D.lap) D.lap.titik.forEach(function (t) {
      var v = {}, TT = 0, RR = 0;
      KOMODITAS.forEach(function (k) { var x = t.kom[k]; if (x && x.target_ha) { v[k] = x.tanam_ha / x.target_ha * 100; if (k !== "Tebu" || x.tanam_ha > 0) { TT += x.target_ha; RR += x.tanam_ha; } } });
      v.Jumlah = TT ? RR / TT * 100 : null;
      K.push({ label: F().tanggal(t.tanggal).replace(/ \d{4}$/, ""), sumber: "Laporan harian terbit " + F().tanggal(t.tanggal), nilai: v });
    });
    var kini = {}, T = 0, X = 0;
    KOMODITAS.forEach(function (k) {
      var s = D.sisbun.S[k]; if (!s || !s.t) return;
      var v = STATE.tren === "cpcl" ? s.c : s.r;
      if (STATE.tren === "tanam" && k === "Tebu" && s.r <= 0) return;
      kini[k] = v / s.t * 100; T += s.t; X += v;
    });
    kini.Jumlah = T ? X / T * 100 : null;
    K.push({ label: "Hari ini", sumber: "Sisbun per " + F().tanggal(D.sisbun.asof), nilai: kini });
    return K;
  }
  function htmlTren() {
    var K = kolomTren(), baris = KOMODITAS.concat(["Jumlah"]);
    var sel = function (v) { return v == null ? '<td class="angka teks-redup">–</td>' : '<td class="angka">' + F().persen(v) + "</td>"; };
    var body = baris.map(function (k) {
      var vals = K.map(function (c) { return c.nilai ? c.nilai[k] : null; });
      var mx = -Infinity, sel2 = vals.map(function (v) {
        if (v == null) return sel(null);
        if (STATE.tren === "cpcl" && v < mx - 0.05) return '<td class="angka teks-redup" title="Lebih rendah dari titik sebelumnya, tidak dipakai">' + F().persen(v) + "*</td>";
        mx = Math.max(mx, v); return sel(v);
      });
      var ada = vals.filter(function (v) { return v != null; }), arah = "–";
      if (ada.length >= 2) { var d = ada[ada.length - 1] - ada[ada.length - 2]; arah = d > 0.05 ? "Naik" : d < -0.05 ? "Turun" : "Tetap"; }
      return "<tr" + (k === "Jumlah" ? ' class="jumlah"' : "") + "><td>" + e(k === "Jumlah" ? "Semua komoditas" : k) + "</td>" + sel2.join("") + "<td>" + e(arah) + "</td></tr>";
    }).join("");
    var catatan = STATE.tren === "cpcl"
      ? "Titik tetap: " + K.slice(0, -1).map(function (c) { return c.label + " dari " + c.sumber; }).join("; ") + ". Hari ini langsung dari CPCL Sisbun. Bila suatu titik lebih rendah dari titik sebelumnya, titik itu tidak dipakai (tanda *)."
      : "Lahan ditanam hanya memakai data Sisbun (luas tanam desa), karena angka laporan triwulan memakai definisi berbeda. Titik baru tersimpan otomatis setiap laporan harian terbit (laporan terakhir tiap bulan). Persen jumlah di luar tebu selama luas tanam tebu belum dilaporkan.";
    return seksi("Perkembangan dari waktu ke waktu", segmen("tren", [["tanam", "Lahan ditanam"], ["cpcl", "CPCL"]], STATE.tren, "Ukuran perkembangan") +
      '<div class="wadah-tabel"><table class="tabel tabel-kecil"><thead><tr><th scope="col">Komoditas</th>' +
      K.map(function (c) { return '<th scope="col" class="angka" title="' + e(c.sumber || "") + '">' + e(c.label) + "</th>"; }).join("") + '<th scope="col">Arah</th></tr></thead><tbody>' + body + "</tbody></table></div>" +
      '<p class="catatan">' + e(catatan) + "</p>", { kanan: '<span class="seksi-keterangan">% lahan sasaran per titik pemantauan</span>' });
  }

  function htmlKamus() {
    var K = [["CPCL (calon penerima, calon lokasi)", "Daftar kelompok tani dan lahan yang diusulkan menerima bantuan, diperiksa berjenjang lalu ditetapkan dengan SK."],
      ["SK penetapan", "Keputusan resmi penerima bantuan. Tanpa SK, benih, pupuk, dan upah kerja belum boleh diserahkan."],
      ["HOK (hari orang kerja)", "Bantuan upah kerja petani, misalnya membuat lubang tanam dan menanam, dibayarkan ke rekening kelompok tani."],
      ["Persemaian", "Tempat benih dirawat sampai cukup umur dan diperiksa atau disertifikasi sebelum diantar."],
      ["Kontrak pengadaan", "Perjanjian dengan penyedia benih atau pupuk. Kontrak ditandatangani belum berarti barang sampai atau dibayar."],
      ["Anggaran terbayar", "Uang yang benar-benar sudah dicairkan (SP2D), berbeda dengan nilai kontrak yang baru merupakan janji bayar."]];
    var C = ["Persentase lahan keseluruhan dihitung di luar tebu selama data tebu belum dilaporkan.",
      "Anggaran terbayar memakai rumus integrasi: SP2D akun 526 + realisasi produksi benih + KBD tebu; outstanding kontrak tidak termasuk.",
      "Target pada API publik Sisbun bisa sedikit berbeda dengan menu admin Sisbun; target resmi mengikuti SAT 3 (lihat Rekap nasional).",
      "Untuk pala, lada, dan jambu mete, penerima terdata masih berupa usulan yang belum seluruhnya ditetapkan.",
      "Luas HOK tidak dihitung sebagai luas tanam.",
      "Tahap SK penetapan belum tercatat di Sisbun; tahap salur benih memakai jadwal salur Sisbun, bukan benih yang sudah diterima."];
    return '<div class="grid-dua">' + seksi("Kamus singkat", '<div class="isi-rata">' + K.map(function (x) { return '<div class="butir"><strong>' + e(x[0]) + "</strong><span>" + e(x[1]) + "</span></div>"; }).join("") + "</div>") +
      seksi("Catatan data", '<ul class="daftar-titik isi-rata">' + C.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>") + "</div>";
  }

  function gambarJejak(el) {
    if (!D.sisbun) return;
    var O = olahSemua(), A = anggaranKom();
    if (!D.sisbun.S[STATE.kom]) STATE.kom = KOMODITAS[0];
    el.innerHTML = htmlHero(O, A) + htmlPilih(O) + htmlDetail(O, A) +
      '<div class="grid-dua">' + htmlBandingkan(O, A) + htmlPeta() + "</div>" + htmlTren() + htmlKamus();
    muatSatker(el);
  }
  function muatSatker(el) {
    var k = STATE.kom, s = D.sisbun && D.sisbun.S[k];
    if (!s || D.satker[k] || D.sisbun.lama) { if (D.sisbun && D.sisbun.lama && !D.satker[k]) D.satker[k] = { gagal: true }; return; }
    D.satker[k] = { memuat: true };
    S().ambilSatker(s).then(function (rows) { D.satker[k] = { rows: rows }; }, function () { D.satker[k] = { gagal: true }; })
      .then(function () { if (el.isConnected && STATE.kom === k) gantiDetail(el); });
  }
  function gantiDetail(el) {
    var lama = el.querySelector("#bantuan-detail");
    if (!lama) return;
    var t = document.createElement("div"); t.innerHTML = htmlDetail(olahSemua(), anggaranKom());
    lama.replaceWith(t.firstChild);
  }

  var timerAuto = null;
  function isiJejak(el, segar) {
    if (!D.sisbun || segar) el.innerHTML = Monev.data.tampil.memuat(5);
    var ta = D.ta;
    var bagian = [
      S().ambilBersama(segar),
      opsional(muatRekap(ta)),
      opsional(Monev.data.muatTahun("bantuan/titik-pemantauan.json", ta)),
      opsional(Monev.data.muatTahun("bantuan/catatan-lapangan.json", ta))
    ];
    Promise.all(bagian).then(function (h) {
      D.sisbun = h[0]; D.rekap = h[1]; D.titik = h[2]; D.catatan = h[3]; D.waktuMuat = Date.now();
      if (segar) D.satker = {};
      var t = (D.titik && D.titik.titik) || [], batas = t.length ? t[t.length - 1].tanggal : "";
      return muatLaporan(ta, batas).then(function (lap) { D.lap = lap; });
    }).then(function () {
      if (!el.isConnected) return;
      gambarJejak(el);
      jadwalkan(el);
    }).catch(function () {
      if (!el.isConnected) return;
      el.innerHTML = Monev.data.tampil.gagal("Data Sisbun gagal dibaca", "") + htmlKamus();
    });
  }
  function jadwalkan(el) {
    clearTimeout(timerAuto);
    timerAuto = setTimeout(function () {
      if (!el.isConnected) return;
      if (document.visibilityState === "visible") isiJejak(el, false); else jadwalkan(el);
    }, JEDA_AUTO);
  }

  /* ---------- mode slide (jejak.html lama) ---------- */
  function slideData() {
    var O = olahSemua(), A = anggaranKom(), H = headline(D.sisbun, A), Sb = D.sisbun.S, BL = S().BULAN;
    var ids = KOMODITAS.filter(function (k) { return Sb[k] && Sb[k].t; });
    var kecil = function (k) { return k.toLowerCase(); };
    var rng = function (arr) { var a = arr.map(function (v) { return Math.min(v, 100); }); return S().nf(Math.floor(Math.min.apply(null, a))) + "–" + S().nf(Math.round(Math.max.apply(null, a))) + "%"; };
    var bi = O[ids[0]] ? O[ids[0]].bi : new Date().getMonth();
    var lowCp = ids.filter(function (k) { return O[k].cpcl < 95; }), lowBn = ids.filter(function (k) { return O[k].benih < 90; });
    var tunggu = ids.filter(function (k) { return O[k].planLalu === 0 && Sb[k].r === 0; });
    var jalan = ids.filter(function (k) { return O[k].planLalu > 0; }), lag = jalan.filter(function (k) { return O[k].rasio < 30; });
    var blnPertama = function (k) { var i = Sb[k].plan.findIndex(function (v, j) { return j >= bi && v > 0; }); return i >= 0 ? BL[i] : "nanti"; };
    var T = 0, Rr = 0; ids.forEach(function (k) { if (k !== "Tebu" || Sb[k].r > 0) { T += Sb[k].t; Rr += Sb[k].r; } });
    var sisa = T - Rr, minggu = O[ids[0]] ? O[ids[0]].minggu : 1;
    var txt = [
      "CPCL " + rng(ids.map(function (k) { return O[k].cpcl; })) + (lowCp.length ? "; " + S().daftar(lowCp.map(function (k) { return kecil(k) + " " + S().nf(O[k].cpcl) + "%"; })) : "; semua komoditas lengkap"),
      "Kontrak benih " + rng(ids.map(function (k) { return O[k].benih; })) + (lowBn.length ? "; " + S().daftar(lowBn.map(function (k) { return kecil(k) + " " + S().nf(O[k].benih) + "%"; })) : "; semua hampir penuh"),
      tunggu.length ? "Benih " + S().daftar(tunggu.map(kecil)) + " menunggu jadwal salur (mulai " + blnPertama(tunggu[0]) + ")" : "Benih sebagian besar sudah memasuki jadwal salur",
      jalan.length ? "Jadwal salur sudah berjalan untuk " + jalan.length + " komoditas" + (lag.length ? "; " + S().daftar(lag.map(kecil)) + " tanamnya di bawah 30% jadwal" : "") : "Belum ada jadwal salur yang jatuh tempo",
      (H.tanam == null ? "–" : F().persen(H.tanam)) + " lahan (" + S().ha(Rr) + ") ditanam; sisa " + S().ha(sisa) + " dalam " + minggu + " minggu"
    ];
    var hit = [0, 0, 0, 0, 0]; ids.forEach(function (k) { hit[O[k].pos - 1]++; });
    var modus = hit.indexOf(Math.max.apply(null, hit));
    var namaTahap = ["penetapan penerima", "pemesanan benih", "persemaian", "penyaluran dan awal tanam", "penanaman"][modus];
    var cand = [];
    var lagAll = jalan.filter(function (k) { return O[k].rasio < 75; });
    if (lagAll.length) cand.push({ w: lagAll.reduce(function (a, k) { return a + Sb[k].t - Sb[k].r; }, 0), t: "Tanam tertinggal dari jadwal salur",
      p: "Sampai " + BL[Math.max(0, bi - 1)] + ", yang tertanam baru " + S().daftar(lagAll.map(function (k) { return kecil(k) + " " + S().pct(O[k].rasio); })) + " dari benih yang dijadwalkan salur." });
    if (lowCp.length) {
      var gap = []; lowCp.forEach(function (k) { Sb[k].provs.forEach(function (p) { if (p.t >= 200 && p.c / p.t < 0.8) gap.push([S().rapi(p.n), kecil(k), p.t - p.c]); }); });
      gap.sort(function (a, b) { return b[2] - a[2]; });
      var kurang = lowCp.reduce(function (a, k) { return a + Sb[k].t - Sb[k].c; }, 0);
      cand.push({ w: kurang, t: "Data penerima belum lengkap", p: "Calon penerima untuk " + S().ha(kurang) + " belum terdata, terutama " + S().daftar(lowCp.map(kecil)) +
        (gap.length ? "; terbesar di " + S().daftar(gap.slice(0, 3).map(function (g) { return g[0] + " (" + g[1] + ")"; })) + "." : ".") });
    }
    if (lowBn.length) { var bk = lowBn.reduce(function (a, k) { return a + Sb[k].t - Sb[k].v; }, 0); cand.push({ w: bk, t: "Kontrak benih belum penuh", p: "Benih untuk " + S().ha(bk) + " lahan belum berkontrak: " + S().daftar(lowBn.map(function (k) { return kecil(k) + " " + S().nf(O[k].benih) + "%"; })) + "." }); }
    var siap = []; jalan.forEach(function (k) { Sb[k].provs.forEach(function (p) { if (p.t >= 200 && p.c / p.t >= 0.9 && p.v / p.t >= 0.9 && p.r === 0) siap.push([S().rapi(p.n), kecil(k), p.t]); }); });
    siap.sort(function (a, b) { return b[2] - a[2]; });
    if (siap.length) { var sw = siap.reduce(function (a, x) { return a + x[2]; }, 0); cand.push({ w: sw, t: "Sudah siap, belum ditanam", p: S().ha(sw) + " lahan sudah lengkap penerima dan benihnya tetapi belum ada tanam; terbesar " + S().daftar(siap.slice(0, 3).map(function (x) { return x[0] + " (" + x[1] + ")"; })) + "." }); }
    if (tunggu.length) cand.push({ w: 1, t: "Jadwal salur belum tiba", p: "Benih " + S().daftar(tunggu.map(kecil)) + " memang baru dijadwalkan salur mulai " + blnPertama(tunggu[0]) + ", jadi belum ada tanam masih sesuai jadwal." });
    cand.sort(function (a, b) { return b.w - a.w; });
    var bulan = []; for (var m = bi; m <= 11 && bulan.length < 3; m++) bulan.push(m);
    var prio = [];
    var cpK = ids.filter(function (k) { return O[k].cpcl < 90; });
    if (cpK.length) prio.push("lengkapi CPCL " + S().daftar(cpK.map(kecil)));
    if (lowBn.length) prio.push("tuntaskan kontrak benih " + S().daftar(lowBn.map(kecil)));
    if (siap.length) prio.push("percepat tanam di " + S().daftar(siap.slice(0, 2).map(function (x) { return x[0]; })));
    var kartu = bulan.map(function (mm, i) {
      var sal = ids.filter(function (k) { return Sb[k].plan[mm] > 0; }).map(function (k) { return kecil(k) + " " + S().jml(Sb[k].plan[mm], S().satuan(k)); });
      var p = sal.length ? "Jadwal salur: " + S().daftar(sal) + "." : "Tidak ada jadwal salur baru.";
      if (i === 0 && prio.length) p += " Prioritas: " + prio.slice(0, 2).join("; ") + ".";
      if (mm === 11) p += " Batas tanam 31 Desember" + (H.P ? "; sisa anggaran kawasan dan benih " + F().rupiahM(H.P - H.B) + " perlu dibayarkan." : ".");
      return [BL[mm], p];
    });
    var top = sasaranTop();
    var status = { sesuai: 0, cepat: 0, jauh: 0 }; ids.forEach(function (k) { if (status[O[k].status] != null) status[O[k].status]++; });
    var st = []; if (status.sesuai) st.push(status.sesuai + " sesuai jadwal"); if (status.cepat) st.push(status.cepat + " perlu dipercepat"); if (status.jauh) st.push(status.jauh + " tertinggal jauh");
    return { O: O, A: A, H: H, ids: ids, txt: txt, modus: modus, judul2: hit[modus] + " dari " + ids.length + " komoditas berada di tahap " + namaTahap,
      cand: cand.slice(0, 3), kartu: kartu, judul7: "Sisa " + S().ha(sisa) + " harus ditanam sampai Desember", rata: "Perlu tanam rata-rata " + S().ha(sisa / minggu) + " per minggu selama " + minggu + " minggu tersisa.",
      top: top, judul3: st.join(", ").replace(/^./, function (x) { return x.toUpperCase(); }) || "Kabar tiap komoditas" };
  }
  function sasaranTop() {
    var simpan = STATE.petaKom; STATE.petaKom = "";
    var Q = sasaranProv(); STATE.petaKom = simpan;
    return Object.keys(Q.t).map(function (n) { return [n, Q.t[n]]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
  }
  function slides() {
    var X = slideData(), sb = D.sisbun, BL5 = ["Penerima ditetapkan", "Benih (dan pupuk) dipesan", "Benih dirawat di persemaian", "Diantar ke petani", "Ditanam di kebun"];
    var simpanProv = STATE.prov; STATE.prov = "";
    var peta = htmlPeta().match(/<svg[\s\S]*<\/svg>/)[0].replace(/ tabindex="0" role="button"/g, "").replace(/ data-bantuan-prov="[^"]*"/g, "");
    STATE.prov = simpanProv;
    var titik = (D.titik && D.titik.titik) || [];
    var trCols = titik.map(function (t) { return t.label; }).concat(["Hari ini"]);
    var trRows = KOMODITAS.map(function (k) {
      var s = sb.S[k];
      return "<tr><td>" + e(k) + "</td>" + titik.map(function (t) { return '<td class="angka">' + (t.cpcl && t.cpcl[k] != null ? F().persen(t.cpcl[k]) : "–") + "</td>"; }).join("") +
        '<td class="angka">' + (s && s.t ? F().persen(s.c / s.t * 100) : "–") + "</td></tr>";
    }).join("");
    return [
      '<div class="slide slide-sampul"><span class="slide-kicker">Pemantauan bantuan perkebunan TA ' + e(D.ta) + '</span><h2>Sejauh mana bantuan perkebunan sudah berjalan?</h2>' +
        "<p>Data Sisbun per " + e(F().tanggal(sb.asof)) + " · " + e(sumberRekap(D.rekap)) + '</p><div class="slide-tiga">' +
        "<div><b>" + e(X.H.tanam == null ? "–" : F().persen(X.H.tanam)) + "</b><span>lahan sasaran sudah ditanam" + (X.H.tebuIkut ? "" : " (di luar tebu)") + "</span></div>" +
        "<div><b>" + e(X.H.benih) + "</b><span>benih sudah dipesan</span></div>" +
        "<div><b>" + e(X.H.uang == null ? "–" : F().persen(X.H.uang)) + "</b><span>anggaran kawasan dan benih sudah dibayarkan</span></div></div></div>",
      '<div class="slide"><span class="slide-kicker">Perjalanan bantuan</span><h2>' + e(X.judul2) + '</h2><ol class="slide-tahap">' + BL5.map(function (n, i) {
        return '<li class="' + (i < X.modus ? "selesai" : i === X.modus ? "kini" : "") + '"><b>' + (i + 1) + "</b><strong>" + e(n) + "</strong><small>" + e(X.txt[i]) + "</small></li>";
      }).join("") + "</ol><p>Benih baru boleh diantar setelah cukup umur dan lolos sertifikasi; penanaman mengikuti musim hujan.</p></div>",
      '<div class="slide"><span class="slide-kicker">Kabar tiap komoditas</span><h2>' + e(X.judul3) + '</h2><div class="slide-grid">' + KOMODITAS.map(function (k) {
        var o = X.O[k], s = sb.S[k], st = S().STATUS[o ? o.status : "kosong"], v = s && s.t && !(k === "Tebu" && s.r <= 0) ? s.r / s.t * 100 : null;
        return '<div class="slide-kartu"><div class="slide-kartu-kepala"><b>' + e(k) + "</b>" + chip(st.chip, st.label) + "</div>" + barSatu(v || 0, "bar-status-" + (o ? o.status : "kosong")) +
          "<span>" + e(v == null ? "Tanam belum dilaporkan" : F().persen(v) + " lahan ditanam") + "</span><small>Target " + e(s ? S().ha(s.t) : "–") + "</small></div>";
      }).join("") + "</div></div>",
      '<div class="slide"><span class="slide-kicker">Peta sebaran</span><h2>Sasaran terbesar di ' + e(S().daftar(X.top.slice(0, 3).map(function (x) { return namaProv(x[0]); }))) + '</h2><div class="slide-dua"><div class="wadah-peta">' + peta + "</div>" +
        '<ol class="slide-daftar">' + X.top.map(function (x) { return "<li>" + e(namaProv(x[0])) + ": <b>" + e(S().ha(x[1])) + "</b></li>"; }).join("") + "</ol></div></div>",
      '<div class="slide"><span class="slide-kicker">Perkembangan</span><h2>CPCL per titik pemantauan</h2><table class="tabel slide-tabel"><thead><tr><th scope="col">Komoditas</th>' +
        trCols.map(function (c) { return '<th scope="col" class="angka">' + e(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + trRows + "</tbody></table>" +
        "<p>" + e(titik.map(function (t) { return t.label + ": " + t.sumber; }).join("; ")) + "; Hari ini: CPCL Sisbun.</p></div>",
      '<div class="slide"><span class="slide-kicker">Hambatan utama</span><h2>Kenapa masih lambat?</h2><div class="slide-kolom">' +
        (X.cand.length ? X.cand : [{ t: "Belum ada hambatan menonjol", p: "Data Sisbun belum menunjukkan hambatan menonjol." }]).map(function (c) { return "<div><b>" + e(c.t) + "</b><p>" + e(c.p) + "</p></div>"; }).join("") + "</div>" +
        (D.catatan && D.catatan.komoditas ? "<p><b>Catatan lapangan " + e(D.catatan.sumber || "") + ".</b> " + e(X.ids.filter(function (k) { return X.O[k].status === "jauh" || X.O[k].status === "cepat"; }).slice(0, 3)
          .map(function (k) { var c = D.catatan.komoditas[k]; return c && c.kenapa ? k + ": " + (c.kenapa.match(/^.*?[.!?](\s|$)/) || [c.kenapa])[0].trim() : ""; }).filter(Boolean).join(" ")) + "</p>" : "") + "</div>",
      '<div class="slide"><span class="slide-kicker">Langkah berikutnya</span><h2>' + e(X.judul7) + '</h2><div class="slide-kolom">' +
        X.kartu.map(function (c) { return "<div><b>" + e(c[0]) + "</b><p>" + e(c[1]) + "</p></div>"; }).join("") + "</div><p><b>" + e(X.rata) + "</b></p></div>",
      '<div class="slide"><span class="slide-kicker">Catatan</span><h2>Tentang data ini</h2><p>Target kawasan, CPCL, kontrak benih, jadwal salur, luas tanam, sebaran provinsi, dan satker kawasan diambil langsung dari API Sisbun. ' +
        "Anggaran terbayar dari hasil integrasi (SP2D akun 526 + realisasi produksi benih + KBD tebu). Titik perkembangan dari pemantauan harian Ditjenbun dan laporan triwulan. " +
        "Status membandingkan luas tanam dengan jadwal salur benih s.d. akhir bulan lalu (≥ 75% sesuai jadwal, 30–75% perlu dipercepat, &lt; 30% tertinggal jauh).</p></div>"
    ];
  }
  var slideIdx = 0, fokusAwal = null;
  function bukaSlide() {
    if (!D.sisbun) return;
    fokusAwal = document.activeElement;
    var w = document.createElement("div");
    w.className = "slide-latar"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "Jejak bantuan sebagai slide");
    w.innerHTML = '<div class="slide-panggung" id="slide-panggung">' + slides().join("") + "</div>" +
      '<div class="slide-kendali"><button type="button" class="tombol tombol-sekunder tombol-kecil" data-slide="mundur">Sebelumnya</button>' +
      '<span id="slide-hitung" aria-live="polite"></span><button type="button" class="tombol tombol-utama tombol-kecil" data-slide="maju">Berikutnya</button>' +
      '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-slide="tutup">Tutup</button></div>';
    document.body.appendChild(w); document.body.style.overflow = "hidden";
    slideIdx = 0; tampilSlide(0);
    w.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-slide]"); if (!b) return;
      var a = b.getAttribute("data-slide");
      if (a === "tutup") tutupSlide(); else tampilSlide(slideIdx + (a === "maju" ? 1 : -1));
    });
    document.addEventListener("keydown", kunciSlide);
    w.querySelector('[data-slide="maju"]').focus();
  }
  function tampilSlide(i) {
    var s = document.querySelectorAll(".slide-latar .slide"); if (!s.length) return;
    slideIdx = Math.max(0, Math.min(s.length - 1, i));
    s.forEach(function (x, j) { x.hidden = j !== slideIdx; });
    document.getElementById("slide-hitung").textContent = (slideIdx + 1) + " / " + s.length;
  }
  function kunciSlide(ev) {
    if (!document.querySelector(".slide-latar")) return;
    if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); tampilSlide(slideIdx + 1); }
    else if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); tampilSlide(slideIdx - 1); }
    else if (ev.key === "Escape") tutupSlide();
  }
  function tutupSlide() {
    var w = document.querySelector(".slide-latar"); if (w) w.remove();
    document.body.style.overflow = ""; document.removeEventListener("keydown", kunciSlide);
    if (fokusAwal && fokusAwal.focus) fokusAwal.focus();
  }

  /* ============================== REKAP NASIONAL ============================== */
  function opsiSumber(nilai, panjang) {
    return [["", panjang ? "Reguler dan ABT (baris terpisah)" : "Reguler dan ABT"], ["REGULER", "Reguler"], ["ABT", "ABT"]].map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === nilai ? " selected" : "") + ">" + e(o[1]) + "</option>";
    }).join("");
  }
  function opsiKomoditas(rows, nilai) {
    var ada = R().daftarKomoditas(rows).sort(Monev.istilah.urutKomoditas);
    return '<option value="">Semua komoditas</option>' + ada.map(function (k) { return '<option value="' + e(k) + '"' + (k === nilai ? " selected" : "") + ">" + e(k) + "</option>"; }).join("");
  }
  function kartuRekap(label, nilai, ket) {
    return '<div class="kartu-angka"><span class="kartu-label">' + e(label) + '</span><span class="kartu-nilai">' + e(nilai) + '</span><span class="kartu-ket">' + e(ket) + "</span></div>";
  }
  function tabelKegiatan(rows, lingkup, bencana) {
    var keg = R().perKegiatan(rows), t = R().jumlah(keg, rows), nas = lingkup === "nasional";
    var kepala = '<thead><tr><th scope="col" rowspan="2">Komoditas / sub-komponen</th><th scope="col" rowspan="2">Sumber dana</th>' +
      (nas ? '<th scope="col" rowspan="2" class="angka">Provinsi</th>' : "") + '<th scope="col" rowspan="2" class="angka">Kab/kota</th>' +
      '<th scope="colgroup" colspan="3" class="kelompok">Fisik</th><th scope="colgroup" colspan="' + (bencana ? 5 : 3) + '" class="kelompok">Anggaran</th></tr>' +
      '<tr><th scope="col" class="angka">Target</th><th scope="col" class="angka">Realisasi</th><th scope="col" class="angka">%</th>' +
      '<th scope="col" class="angka">Pagu</th><th scope="col" class="angka">Terbayar</th><th scope="col" class="angka">%</th>' +
      (bencana ? '<th scope="col" class="angka">Pagu bencana</th><th scope="col" class="angka">Terbayar bencana</th>' : "") + "</tr></thead>";
    var sel = function (x, satuan, grup) {
      var fp = satuan === "Hektar" && grup <= 1 ? pct(x.realisasi, x.target) : "–";
      return '<td class="angka">' + fisik(x.target, satuan) + '</td><td class="angka">' + fisik(x.realisasi, satuan) + '</td><td class="angka">' + fp + "</td>" +
        '<td class="angka">' + F().rupiahM(x.pagu) + '</td><td class="angka">' + F().rupiahM(x.terbayar) + '</td><td class="angka">' + pct(x.terbayar, x.pagu) + "</td>" +
        (bencana ? '<td class="angka">' + (x.pagu_b ? F().rupiahM(x.pagu_b) : "–") + '</td><td class="angka">' + (x.terbayar_b ? F().rupiahM(x.terbayar_b) : "–") + "</td>" : "");
    };
    var body = keg.map(function (x) {
      return '<tr class="tingkat-0"><td>' + e(x.kegiatan) + "</td><td>" + chipSumber(x.sumber_dana) + "</td>" + (nas ? '<td class="angka">' + x.jml_prov + "</td>" : "") +
        '<td class="angka">' + x.jml_kab + "</td>" + sel(x, x.satuan, x.grup) + "</tr>" +
        x.sub.map(function (s) {
          return '<tr class="baris-sub"><td><span class="indentasi">' + e(s.nama) + "</span></td><td></td>" + (nas ? "<td></td>" : "") + "<td></td>" + sel(s, x.satuan, x.grup) + "</tr>";
        }).join("");
    }).join("");
    var jml = '<tr class="jumlah"><td>' + (nas ? "Jumlah nasional" : "Jumlah provinsi") + "</td><td></td>" + (nas ? '<td class="angka">' + t.jml_prov + "</td>" : "") + '<td class="angka">' + t.jml_kab + "</td>" + sel(t, "Hektar", 0) + "</tr>";
    return '<div class="wadah-tabel"><table class="tabel tabel-rekap">' + kepala + "<tbody>" + (keg.length ? body + jml : '<tr><td colspan="12">Tidak ada baris untuk pilihan ini.</td></tr>') + "</tbody></table></div>";
  }
  function filterNasional(rows, j) {
    var N = STATE.nas;
    return '<div class="filter-bar">' +
      '<label class="sr-only" for="b-nas-sd">Sumber dana</label><select id="b-nas-sd" data-bantuan-filter="nas.sumber">' + opsiSumber(N.sumber, true) + "</select>" +
      '<label class="sr-only" for="b-nas-km">Komoditas</label><select id="b-nas-km" data-bantuan-filter="nas.komoditas">' + opsiKomoditas(rows, N.komoditas) + "</select>" +
      '<label class="centang"><input type="checkbox" data-bantuan-filter="nas.bencana"' + (N.bencana ? " checked" : "") + "> Rincian bencana</label>" +
      '<span class="sumber">Data per ' + e(F().tanggal(j.data_per)) + " · hasil integrasi SAKTI, FA16, SAT 3, dan Hilirisasi</span></div>";
  }
  function gambarNasional(el) {
    var j = D.rekap, semua = R().baca(j), N = STATE.nas, rows = R().saring(semua, { sumber: N.sumber, komoditas: N.komoditas });
    var k = R().kartu(rows);
    el.innerHTML = filterNasional(semua, j) +
      '<section class="grid-kartu grid-kartu-padat" aria-label="Angka nasional">' +
      kartuRekap("Target fisik", F().hektar(k.target), N.sumber === "ABT" ? "ABT" : N.sumber === "REGULER" ? "reguler" : "reguler + ABT") +
      kartuRekap("Realisasi tanam", F().hektar(k.realisasi_reg), "reguler, dari Hilirisasi") +
      kartuRekap("Capaian fisik", pct(k.realisasi_reg, k.target_reg), "dari target reguler") +
      kartuRekap("Pagu bantuan", F().rupiahM(k.pagu), "akun 526 + produksi benih + KBD tebu") +
      kartuRekap("Anggaran terbayar", F().rupiahM(k.terbayar), pct(k.terbayar, k.pagu) + " · SP2D + produksi benih + KBD tebu") +
      kartuRekap("Cakupan", k.jml_prov + " provinsi", k.jml_kab + " kabupaten/kota") + "</section>" +
      seksi("Rekap nasional per komoditas", tabelKegiatan(rows, "nasional", N.bencana) +
        '<p class="catatan">Reguler dan ABT selalu baris terpisah; ABT belum punya realisasi fisik di Hilirisasi. Sub-komponen tebu tidak digabung. Luas HOK tidak dihitung sebagai realisasi tanam. ' +
        "Jumlah fisik hanya menjumlah baris kawasan (ha). Volume KBD Tebu tercatat \"Hektar\" di sumber tetapi bernilai ratusan juta, kemungkinan satuannya mata." +
        (j.ada_produksi_benih ? "" : " Baris Produksi Benih dan KBD Tebu belum ada: sheet Produksi Benih tidak ikut diunggah.") +
        (N.bencana ? " Bencana = sumber dana ABT serta kegiatan reguler di kabupaten terdampak bencana." : "") + "</p>",
        { kanan: '<div class="baris-alat"><span class="seksi-keterangan">Target fisik dari SAT 3 · realisasi tanam dari Hilirisasi · anggaran dari SAKTI</span>' + tombolCSV("nasional") + "</div>" }) +
      seksi("Isi file unduhan", '<div class="grid-ekspor"><div class="kotak-ekspor"><h3>PDF (A4 lanskap)</h3><p class="paragraf-kecil">Kop Kementerian Pertanian RI, judul dan tanggal data, rekap nasional (dengan rincian bencana), lalu satu tabel per provinsi. Nomor halaman di kaki dan catatan sumber data di halaman terakhir.</p>' +
        '<div class="baris-alat"><button type="button" class="tombol tombol-pdf" data-bantuan-aksi="pdf-nasional">Unduh PDF</button></div></div>' +
        '<div class="kotak-ekspor"><h3>Excel (.xlsx)</h3><p class="paragraf-kecil">Sheet Nasional, Per Provinsi, Per Kabupaten, dan Catatan Data. Persentase dan jumlah memakai rumus, sehingga tetap benar bila baris disaring atau diubah.</p>' +
        '<div class="baris-alat"><button type="button" class="tombol tombol-utama" data-bantuan-aksi="excel">Unduh Excel</button></div></div></div>' +
        '<p class="catatan" id="bantuan-pesan" role="status">Unduhan mengikuti pilihan sumber dana dan komoditas di atas.</p>');
  }

  /* ============================== REKAP PROVINSI ============================== */
  function gambarProvinsi(el) {
    var j = D.rekap, semua = R().baca(j), V = STATE.pv;
    var dasar = R().saring(semua, { sumber: V.sumber, komoditas: V.komoditas });
    var prov = R().daftarProvinsi(dasar);
    if (!prov.length) { V.provinsi = ""; }
    else if (!prov.some(function (p) { return p.nama === V.provinsi; })) V.provinsi = prov.slice().sort(function (a, b) { return b.pagu - a.pagu; })[0].nama;
    var opsiProv = prov.map(function (p) { return '<option value="' + e(p.nama) + '"' + (p.nama === V.provinsi ? " selected" : "") + ">" + e(namaProv(p.nama)) + "</option>"; }).join("");
    var filter = '<div class="filter-bar">' +
      '<label class="sr-only" for="b-pv-prov">Provinsi</label><select id="b-pv-prov" data-bantuan-filter="pv.provinsi">' + opsiProv + "</select>" +
      '<label class="sr-only" for="b-pv-sd">Sumber dana</label><select id="b-pv-sd" data-bantuan-filter="pv.sumber">' + opsiSumber(V.sumber) + "</select>" +
      '<label class="sr-only" for="b-pv-km">Komoditas</label><select id="b-pv-km" data-bantuan-filter="pv.komoditas">' + opsiKomoditas(semua, V.komoditas) + "</select>" +
      '<span class="sumber">Data per ' + e(F().tanggal(j.data_per)) + " · wilayah mengikuti Master Lokus</span></div>";
    var daftar = '<div class="wadah-tabel"><table class="tabel"><thead><tr><th scope="col">Provinsi</th><th scope="col" class="angka">Target (ha)</th><th scope="col" class="angka">Fisik</th><th scope="col" class="angka">Anggaran</th></tr></thead><tbody>' +
      prov.map(function (p) {
        return "<tr" + (p.nama === V.provinsi ? ' class="terpilih"' : "") + '><td><button type="button" class="tautan-sel" data-bantuan-buka-prov="' + e(p.nama) + '"' + (p.nama === V.provinsi ? ' aria-current="true"' : "") + ">" + e(namaProv(p.nama)) + "</button></td>" +
          '<td class="angka">' + (p.target_fisik ? S().nf(p.target_fisik) : "–") + '</td><td class="angka">' + pct(p.realisasi_fisik, p.target_reg) + '</td><td class="angka">' + pct(p.terbayar, p.pagu) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    var kiri = seksi("Semua provinsi", daftar + '<p class="catatan">Fisik = realisasi tanam dibanding target reguler. Anggaran = terbayar dibanding pagu.</p>', { kanan: '<span class="seksi-keterangan">Klik nama provinsi untuk membuka rinciannya</span>' });
    var kanan = V.provinsi ? rincianProvinsi(dasar, V.provinsi, j) : seksi("Rincian provinsi", '<p class="paragraf-kecil">Tidak ada provinsi untuk pilihan ini.</p>');
    el.innerHTML = filter + '<div class="grid-rekap-prov">' + kiri + kanan + "</div>" + '<p class="catatan" id="bantuan-pesan" role="status"></p>';
    // tabel kabupaten/kota dibagi per halaman supaya rincian setinggi daftar Semua provinsi
    var kunciKab = [V.provinsi, V.sumber, V.komoditas].join("|");
    if (V.kabKunci !== kunciKab) { V.kabKunci = kunciKab; V.kabHal = null; }
    var g = el.querySelector(".grid-rekap-prov");
    Monev.bagiHalaman.pasang({ kartu: el.querySelector(".seksi-rincian-prov"), lawan: g && g.firstElementChild, baris: "tr[data-hal-baris]",
      perHal: 15, minBaris: 10, keadaan: V, kunci: "kabHal" });
  }
  function rincianProvinsi(dasar, nama, j) {
    var rows = R().saring(dasar, { provinsi: nama }), k = R().kartu(rows), ben = (j.provinsi_bencana || []).indexOf(nama) >= 0;
    var kab = R().perKabupaten(rows, nama).sort(function (a, b) { return a.grup - b.grup || b.pagu - a.pagu || (a.kabupaten < b.kabupaten ? -1 : 1); });
    var kabTabel = '<div class="wadah-tabel"><table class="tabel tabel-sedang"><thead><tr><th scope="col">Kabupaten/kota</th><th scope="col">Komoditas / kegiatan</th><th scope="col" class="angka">Target</th><th scope="col" class="angka">Realisasi</th><th scope="col" class="angka">%</th><th scope="col" class="angka">Pagu</th><th scope="col" class="angka">Terbayar</th></tr></thead><tbody>' +
      kab.map(function (x) {
        return "<tr data-hal-baris><td>" + e(x.kabupaten) + "</td><td>" + e(x.kegiatan) + (x.sumber_dana === "ABT" ? " " + chip("abt", "ABT") : "") + '</td><td class="angka">' + fisik(x.target, x.satuan) + '</td><td class="angka">' + fisik(x.realisasi, x.satuan) +
          '</td><td class="angka">' + (x.satuan === "Hektar" && x.grup <= 1 ? pct(x.realisasi, x.target) : "–") + '</td><td class="angka">' + F().rupiahM(x.pagu) + '</td><td class="angka">' + F().rupiahM(x.terbayar) + "</td></tr>";
      }).join("") + "</tbody></table></div>" + Monev.bagiHalaman.pager();
    return '<section class="seksi seksi-rincian-prov"><div class="seksi-kepala"><div class="kolom-blok"><span class="label-kecil">RINCIAN PROVINSI</span><h2>' + e(namaProv(nama)) + "</h2></div>" +
      (ben ? chip("abt", "Provinsi terdampak bencana") : "") + "</div>" +
      '<div class="grid-kartu grid-kartu-padat grid-kartu-empat">' + kartuRekap("Target fisik", F().hektar(k.target), "kawasan") + kartuRekap("Realisasi tanam", F().hektar(k.realisasi_reg), pct(k.realisasi_reg, k.target_reg) + " dari target reguler") +
      kartuRekap("Pagu", F().rupiahM(k.pagu), "kawasan, pendukung, benih, KBD") + kartuRekap("Terbayar", F().rupiahM(k.terbayar), pct(k.terbayar, k.pagu) + " dari pagu") + "</div>" +
      '<div class="seksi-kepala"><h3 class="subjudul">Per komoditas</h3>' + tombolCSV("prov-kegiatan") + "</div>" + tabelKegiatan(rows, "provinsi", ben) +
      '<div class="seksi-kepala"><h3 class="subjudul">Per kabupaten/kota</h3>' + tombolCSV("prov-kab") + "</div>" + kabTabel +
      '<p class="catatan">Baris yang lokusnya tingkat provinsi (bukan kabupaten tertentu) tampil sebagai "' + e(R().TANPA_KAB) + '". Baris yang lokusnya satker balai mengikuti lokasi DIPA satker itu.</p></section>';
  }

  /* ============================== CSV ============================== */
  function csv(id) {
    var j = D.rekap, semua = R().baca(j), tgl = String(j.data_per || "").slice(0, 10);
    var kepala = ["Kegiatan/Bantuan", "Sub-komponen", "Sumber dana", "Satuan", "Jumlah provinsi", "Jumlah kab/kota", "Target", "Realisasi fisik", "Pagu (Rp)", "Terbayar (Rp)", "Pagu bencana (Rp)", "Terbayar bencana (Rp)"];
    var baris = function (keg) {
      var out = [];
      keg.forEach(function (x) {
        out.push([x.kegiatan, "", x.sumber_dana || "", x.satuan, x.jml_prov, x.jml_kab, x.target, x.realisasi, x.pagu, x.terbayar, x.pagu_b, x.terbayar_b]);
        x.sub.forEach(function (s) { out.push([x.kegiatan, s.nama, x.sumber_dana || "", x.satuan, "", "", s.target, s.realisasi, s.pagu, s.terbayar, s.pagu_b, s.terbayar_b]); });
      });
      return out;
    };
    if (id === "nasional") {
      var N = STATE.nas; Monev.unduhCSV("rekap-bantuan-nasional-" + tgl + ".csv", kepala, baris(R().perKegiatan(R().saring(semua, { sumber: N.sumber, komoditas: N.komoditas }))));
      return;
    }
    var V = STATE.pv, rows = R().saring(semua, { sumber: V.sumber, komoditas: V.komoditas, provinsi: V.provinsi });
    if (id === "prov-kegiatan") Monev.unduhCSV("rekap-bantuan-" + V.provinsi.toLowerCase().replace(/\s+/g, "-") + "-" + tgl + ".csv", kepala, baris(R().perKegiatan(rows)));
    else Monev.unduhCSV("rekap-bantuan-" + V.provinsi.toLowerCase().replace(/\s+/g, "-") + "-kabupaten-" + tgl + ".csv",
      ["Kabupaten/kota", "Kegiatan/Bantuan", "Sumber dana", "Satuan", "Target", "Realisasi fisik", "Pagu (Rp)", "Terbayar (Rp)"],
      R().perKabupaten(rows, V.provinsi).map(function (x) { return [x.kabupaten, x.kegiatan, x.sumber_dana || "", x.satuan, x.target, x.realisasi, x.pagu, x.terbayar]; }));
  }

  /* ============================== MODUL ============================== */
  function tabDari(r) { return r.sub && r.sub.id ? r.sub.id : "jejak"; }

  function aksi(r) {
    var t = tabDari(r);
    if (t === "jejak" && !Monev.tahun.berjalan()) return "";
    if (t === "jejak") return '<button type="button" class="tombol tombol-sekunder" data-bantuan-aksi="perbarui">Perbarui dari Sisbun</button>' +
      '<button type="button" class="tombol tombol-utama" data-bantuan-aksi="slide">Tampilkan sebagai slide</button>';
    if (t === "nasional") return '<button type="button" class="tombol tombol-pdf" data-bantuan-aksi="pdf-nasional">Unduh PDF</button>' +
      '<button type="button" class="tombol tombol-utama" data-bantuan-aksi="excel">Unduh Excel</button>';
    return '<button type="button" class="tombol tombol-pdf" data-bantuan-aksi="pdf-provinsi">PDF provinsi ini</button>' +
      '<button type="button" class="tombol tombol-sekunder" data-bantuan-aksi="pdf-semua">PDF semua provinsi</button>' +
      '<button type="button" class="tombol tombol-utama" data-bantuan-aksi="excel">Unduh Excel</button>';
  }

  function pesan(t) { var p = document.getElementById("bantuan-pesan"); if (p) p.textContent = t; }
  function unduh(jenis, tombol) {
    if (!D.rekap) { pesan("Rekap belum terbit; belum ada yang bisa diunduh."); return; }
    var Dk = window.RekapDokumen, lama = tombol ? tombol.textContent : "";
    if (tombol) { tombol.disabled = true; tombol.textContent = "Menyiapkan…"; }
    var s = jenis === "excel" ? (location.hash.indexOf("provinsi") >= 0 ? STATE.pv : STATE.nas) : jenis === "pdf-nasional" ? STATE.nas : STATE.pv;
    var p = jenis === "excel" ? Dk.unduhExcel(D.rekap, s) : Dk.unduhPDF(jenis.replace("pdf-", ""), D.rekap, s);
    p.then(function () { pesan(jenis === "excel" ? "Excel diunduh." : "PDF diunduh."); }, function (err) { pesan((err && err.message || "Unduhan gagal") + ". Periksa sambungan internet lalu coba lagi."); })
      .then(function () { if (tombol) { tombol.disabled = false; tombol.textContent = lama; } });
  }

  var elAktif = null, rAktif = null, terpasang = false;
  function pasangSekali() {
    if (terpasang) return; terpasang = true;
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-bantuan-aksi], [data-bantuan-kom], [data-bseg], [data-bantuan-prov], [data-bantuan-buka-prov], [data-bantuan-csv]");
      if (!t || !elAktif || !document.body.contains(elAktif)) return;
      if (t.hasAttribute("data-bantuan-aksi")) {
        var a = t.getAttribute("data-bantuan-aksi");
        if (a === "perbarui") { isiJejak(elAktif, true); }
        else if (a === "slide") {
          if (D.sisbun) bukaSlide();
          else { var asli = t.textContent; t.textContent = "Data Sisbun masih dimuat…"; setTimeout(function () { t.textContent = asli; }, 2500); }
        }
        else if (a === "satker") { delete D.satker[STATE.kom]; gantiDetail(elAktif); muatSatker(elAktif); }
        else unduh(a, t);
      } else if (t.hasAttribute("data-bantuan-kom")) {
        STATE.kom = t.getAttribute("data-bantuan-kom");
        gambarJejak(elAktif);
        var d = elAktif.querySelector("#bantuan-detail");
        if (t.classList.contains("baris-bar-tombol") && d) d.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        var f = elAktif.querySelector('[data-bantuan-kom="' + STATE.kom + '"]'); if (f && !t.classList.contains("baris-bar-tombol")) f.focus();
      } else if (t.hasAttribute("data-bseg")) {
        var k = t.getAttribute("data-bseg"), v = t.getAttribute("data-nilai");
        if (k === "ukuran") STATE.ukuran = v; else if (k === "tren") STATE.tren = v;
        gambarJejak(elAktif);
        var b = elAktif.querySelector('[data-bseg="' + k + '"][data-nilai="' + v + '"]'); if (b) b.focus();
      } else if (t.hasAttribute("data-bantuan-prov")) {
        pilihProvPeta(t.getAttribute("data-bantuan-prov"));
      } else if (t.hasAttribute("data-bantuan-buka-prov")) {
        STATE.pv.provinsi = t.getAttribute("data-bantuan-buka-prov");
        if (location.hash === "#bantuan-provinsi") { gambarProvinsi(elAktif); var x = elAktif.querySelector("#b-pv-prov"); if (x) x.focus(); }
        else location.hash = "#bantuan-provinsi";
      } else if (t.hasAttribute("data-bantuan-csv")) csv(t.getAttribute("data-bantuan-csv"));
    });
    document.addEventListener("keydown", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-bantuan-prov]");
      if (!t || (ev.key !== "Enter" && ev.key !== " ")) return;
      ev.preventDefault(); pilihProvPeta(t.getAttribute("data-bantuan-prov"));
    });
    document.addEventListener("change", function (ev) {
      var t = ev.target;
      if (!elAktif || !document.body.contains(elAktif)) return;
      if (t.hasAttribute("data-bantuan-pilih")) {
        var k = t.getAttribute("data-bantuan-pilih");
        if (k === "prov") { pilihProvPeta(t.value); var s = elAktif.querySelector("#b-peta-prov"); if (s) s.focus(); }
        else { STATE.petaKom = t.value; gantiPeta(); var s2 = elAktif.querySelector("#b-peta-kom"); if (s2) s2.focus(); }
      } else if (t.hasAttribute("data-bantuan-filter")) {
        var p = t.getAttribute("data-bantuan-filter").split("."), id = t.id;
        STATE[p[0]][p[1]] = t.type === "checkbox" ? t.checked : t.value;
        if (p[0] === "nas") gambarNasional(elAktif); else gambarProvinsi(elAktif);
        var f = document.getElementById(id); if (f) f.focus();
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && elAktif && document.body.contains(elAktif) && rAktif && tabDari(rAktif) === "jejak" &&
        D.waktuMuat && Date.now() - D.waktuMuat > JEDA_AUTO) isiJejak(elAktif, false);
    });
  }
  function pilihProvPeta(n) {
    STATE.prov = n; gantiPeta();
    var p = elAktif.querySelector('[data-bantuan-prov="' + n + '"]'); if (p && document.activeElement && document.activeElement.hasAttribute("data-bantuan-prov")) p.focus();
  }
  function gantiPeta() {
    var lama = elAktif.querySelector("#bantuan-peta"); if (!lama) return;
    var t = document.createElement("div"); t.innerHTML = htmlPeta(); lama.replaceWith(t.firstChild);
  }

  function isi(el, r) {
    elAktif = el; rAktif = r; pasangSekali();
    var ta = Monev.tahun.aktif(), tab = tabDari(r);
    if (D.ta !== ta) { D = { ta: ta, sisbun: null, rekap: undefined, titik: null, catatan: null, lap: null, satker: {}, waktuMuat: 0 }; }
    if (tab === "jejak" && !Monev.tahun.berjalan(ta)) {
      /* API Sisbun tidak punya pilihan tahun: Jejak hanya untuk tahun berjalan (keputusan Pilih tahun 15 Nov 2026). */
      clearTimeout(timerAuto);
      el.innerHTML = Monev.data.tampil.kosong("Jejak komoditas hanya untuk tahun berjalan",
        "Data Sisbun selalu memuat program tahun berjalan, jadi tidak dipakai untuk TA " + ta + ". Capaian fisik TA " + ta + " ada di Rekap nasional dari hasil integrasi.",
        { label: "Buka Rekap nasional", href: "#bantuan-nasional" });
      return;
    }
    if (tab === "jejak") { if (D.sisbun) { gambarJejak(el); jadwalkan(el); } else isiJejak(el, false); return; }
    clearTimeout(timerAuto);
    el.innerHTML = Monev.data.tampil.memuat(4);
    (D.rekap !== undefined ? Promise.resolve(D.rekap) : muatRekap(ta)).then(function (j) {
      D.rekap = j;
      if (!el.isConnected) return;
      if (!j) {
        el.innerHTML = Monev.data.tampil.kosong("Rekap bantuan TA " + ta + " belum terbit",
          "Rekap nasional dan per provinsi tampil setelah admin mengunggah hasil aplikasi integrasi di menu Unggah data.",
          null, "Sumbernya hasil integrasi SAKTI, FA16 Segmen, SAT 3, Hilirisasi, dan Produksi Benih.");
        return;
      }
      if (tab === "nasional") gambarNasional(el); else gambarProvinsi(el);
    }).catch(function () {
      if (el.isConnected) el.innerHTML = Monev.data.tampil.gagal("Rekap bantuan gagal dimuat", "");
    });
  }

  Monev.menu = Monev.menu || {};
  Monev.menu.bantuan = {
    aksi: aksi, isi: isi,
    /* dipakai Beranda: angka utama Jejak dan pilihan komoditas sebelum pindah ke #bantuan */
    _headline: headline, KOMODITAS: KOMODITAS,
    pilihKomoditas: function (k) { if (KOMODITAS.indexOf(k) >= 0) STATE.kom = k; }
  };
})();
