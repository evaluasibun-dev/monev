/* Data Sisbun untuk menu Bantuan › Jejak komoditas — dibaca langsung dari API publik Sisbun (CORS terbuka).
   Pindahan logika jejak.html lama (akhnoer85/monev-ditjenbun): ambil(), narasi(), muatSatker().
   Aturan angka sama dengan menu Laporan harian (LaporanInti.gs): kontrak ha = btg ÷ 110 untuk kelapa, komoditas lain
   jumlah_benih_ha; CPCL = cpcl_kawasan_ha; tanam = luas_tanam_desa_ha/_btg; jadwal salur = commodity_summary per bulan.
   Status (Keputusan 12): luas tanam ÷ jadwal salur s.d. akhir bulan lalu — ≥ 75% sesuai jadwal, 30–75% perlu dipercepat,
   < 30% tertinggal jauh. Belum ada jadwal jatuh tempo: sesuai jadwal bila CPCL dan kontrak ≥ 95%, selain itu perlu dipercepat.
   Data terakhir yang berhasil disimpan di localStorage dan dipakai bila Sisbun tidak bisa dihubungi. */
(function () {
  "use strict";

  var API = "https://hilirisasibun.sisbun.com/api/realisasi-benih/summary-kawasan/data";
  var KOM = [["Kelapa", "KELAPA"], ["Kopi", "KOPI"], ["Kakao", "KAKAO"], ["Pala", "PALA"], ["Lada", "LADA"], ["Jambu mete", "JAMBU METE"], ["Tebu", "TEBU"]];
  var BTG_PER_HA = { KELAPA: 110 };
  var SATKER = [["DKI JAKARTA", "Ditjenbun Pusat"], ["BBPPTP MEDAN", "BBPPTP Medan"], ["BBPPTP SURABAYA", "BBPPTP Surabaya"],
    ["BBPPTP AMBON", "BBPPTP Ambon"], ["BPTP PONTIANAK", "BPTP Pontianak"]];
  var TANPA_PUPUK = ["Tebu", "Kopi", "Kakao"];
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var BULAN_KEY = BULAN.map(function (b) { return b.toLowerCase(); });
  var CACHE = "monev-bantuan-sisbun-v1";
  var TAHAP = ["CPCL terdata", "SK penetapan", "Kontrak benih", "Persemaian", "Salur benih", "Tanam (HOK)"];
  var STATUS = {
    sesuai: { label: "Sesuai jadwal", chip: "ok" }, cepat: { label: "Perlu dipercepat", chip: "warn" },
    jauh: { label: "Tertinggal jauh", chip: "bad" }, kosong: { label: "Data belum ada", chip: "neutral" }
  };

  function n(v) { v = +v; return isFinite(v) ? v : 0; }
  function nf(v, d) { return new Intl.NumberFormat("id-ID", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(v); }
  function ha(v) { return nf(v, v > 0 && v < 10 && v % 1 ? 1 : 0) + " ha"; }
  function pct(v) { if (v == null || !isFinite(v)) return "–"; return v > 0 && v < 0.05 ? "< 0,1%" : nf(v, 1) + "%"; }
  function satuan(kom) { return kom === "Tebu" ? "mata" : "batang"; }
  function jml(v, sat) { return nf(Math.round(v)) + " " + sat; }
  function daftar(a) { return a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " dan " + a[a.length - 1]; }
  /** "SULAWESI SELATAN" → "Sulawesi Selatan" */
  function rapi(s) {
    return String(s || "").toLowerCase().replace(/(^|[\s(.\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\bDki\b/, "DKI").replace(/^Daerah Istimewa Yogyakarta$/, "DIY");
  }

  function url(where) {
    return API + "?" + new URLSearchParams({ where: JSON.stringify(where), fuzzy: "false", perPage: "500" });
  }
  function ambilJSON(where, batas) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, batas || 30000) : null;
    return fetch(url(where), { signal: ctl ? ctl.signal : undefined, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(function () { if (t) clearTimeout(t); });
  }

  /** Satu komoditas → {nama, kom, asof, t, c, v, vb, r, rb, provs, plan} (ha, btg/mata) */
  function ambil(nama, kom) {
    return ambilJSON({ komoditas: kom }).then(function (d) {
      var T = d.regional_summary.totals || {}, per = BTG_PER_HA[kom];
      var vol = function (x) { return per ? n(x.volume_kontrak_btg) / per : n(x.jumlah_benih_ha); };
      var cs = ((d.commodity_summary || {}).rows || []).filter(function (x) { return x.komoditas === kom; })[0] || {};
      return {
        nama: nama, kom: kom, asof: d.meta && d.meta.data_as_of,
        t: n(T.target_kawasan), c: n(T.cpcl_kawasan_ha), v: vol(T), vb: n(T.volume_kontrak_btg), r: n(T.luas_tanam_desa_ha), rb: n(T.luas_tanam_desa_btg),
        provs: (d.regional_summary.rows || []).map(function (x) {
          return { n: String(x.display_label || "").toUpperCase().trim(), t: n(x.target_kawasan), c: n(x.cpcl_kawasan_ha), v: vol(x), r: n(x.luas_tanam_desa_ha) };
        }),
        plan: BULAN_KEY.map(function (m) { return n(cs[m]); })
      };
    });
  }

  function bacaCache() { try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { return null; } }

  /** Tujuh komoditas sekaligus → {S: {Kelapa: …}, asof, diambil (ISO), lama: bool}. Gagal → cache terakhir (lama: true). */
  function ambilSemua() {
    return Promise.all(KOM.map(function (k) { return ambil(k[0], k[1]); })).then(function (hasil) {
      var S = {}; hasil.forEach(function (s) { S[s.nama] = s; });
      var o = { S: S, asof: hasil[0].asof, diambil: new Date().toISOString(), lama: false };
      try { localStorage.setItem(CACHE, JSON.stringify(o)); } catch (e) { /* penyimpanan penuh atau dimatikan */ }
      return o;
    }).catch(function (err) {
      var c = bacaCache();
      if (c && c.S) { c.lama = true; c.galat = err && err.message; return c; }
      throw err;
    });
  }

  /** Dipakai bersama Beranda dan Bantuan: hasil yang berhasil ditarik < 29 menit lalu dipakai ulang (pembaruan otomatis Jejak tiap 30 menit). */
  var bersama = null;
  function ambilBersama(paksa) {
    if (!paksa && bersama && Date.now() - bersama.waktu < 29 * 60 * 1000) return bersama.janji;
    var janji = ambilSemua();
    var catat = { janji: janji, waktu: Date.now() };
    bersama = catat;
    janji.then(function (o) { if (o.lama && bersama === catat) bersama = null; }, function () { if (bersama === catat) bersama = null; });
    return janji;
  }

  /** Siapa yang mengerjakan: CPCL dan tanam per satker kawasan → [[nama, cpcl, tanam]] + "Belum ditandai satker". */
  function ambilSatker(s) {
    return Promise.all(SATKER.map(function (x) {
      return ambilJSON({ komoditas: s.kom, satker_kawasan: x[0] }).then(function (d) {
        var t = d.regional_summary.totals || {}; return [x[1], n(t.cpcl_kawasan_ha), n(t.luas_tanam_desa_ha)];
      });
    })).then(function (rows) {
      var sc = 0, sr = 0;
      rows.forEach(function (r) { sc += r[1]; sr += r[2]; });
      rows = rows.filter(function (r) { return r[1] > 0.5 || r[2] > 0.5; });
      if (s.c - sc > 1 || s.r - sr > 1) rows.push(["Belum ditandai satker", Math.max(0, s.c - sc), Math.max(0, s.r - sr)]);
      return rows;
    });
  }

  /**
   * Status, tahap, dan narasi otomatis satu komoditas (narasi() jejak.html lama).
   * o: {prevR: luas tanam ha di laporan pembanding, prevTgl: "13 Nov 2026"}
   */
  function olah(s, o) {
    o = o || {};
    var sat = satuan(s.nama);
    var tgl = s.asof ? new Date(s.asof + "T00:00:00") : new Date(), bi = tgl.getMonth();
    var ada = s.t > 0;
    var tanam = ada ? s.r / s.t * 100 : 0, cpcl = ada ? s.c / s.t * 100 : 0, benih = ada ? s.v / s.t * 100 : 0;
    var planLalu = s.plan.slice(0, bi).reduce(function (a, b) { return a + b; }, 0);
    var planKini = s.plan.slice(0, bi + 1).reduce(function (a, b) { return a + b; }, 0);
    var depan = []; s.plan.forEach(function (v, i) { if (i >= bi && v > 0) depan.push([i, v]); });
    var rasio = planLalu > 0 ? s.rb / planLalu * 100 : null;
    var belumLapor = s.nama === "Tebu" && s.r === 0;   // Keputusan 12: tebu dihitung setelah luas tanamnya dilaporkan

    var status;
    if (!ada || belumLapor) status = "kosong";
    else if (rasio === null) status = cpcl >= 95 && benih >= 95 ? "sesuai" : "cepat";
    else status = rasio >= 75 ? "sesuai" : rasio >= 30 ? "cepat" : "jauh";

    var pos = tanam >= 50 ? 5 : (s.r > 0 || planKini > 0) ? 4 : benih >= 90 ? 3 : cpcl >= 90 ? 2 : 1;
    var fase = belumLapor ? "Belum dilaporkan" : !ada ? "Data belum ada" : ["CPCL", "Kontrak", "Persemaian", s.r > 0 ? "Penanaman" : "Salur benih", "Penanaman"][pos - 1];
    var rentang = depan.length ? (depan.length === 1 ? BULAN[depan[0][0]] : BULAN[depan[0][0]].slice(0, 3) + "–" + BULAN[depan[depan.length - 1][0]].slice(0, 3)) : "";
    var kead = function (v) { return v >= 95 ? "selesai" : v > 0 ? "berjalan" : "belum"; };
    var tahap = [
      { nama: TAHAP[0], keadaan: kead(cpcl), ket: pct(cpcl) + " dari target" },
      { nama: TAHAP[1], keadaan: "kosong", ket: "data belum ada di Sisbun" },
      { nama: TAHAP[2], keadaan: kead(benih), ket: pct(benih) + " dipesan" },
      { nama: TAHAP[3], keadaan: pos >= 4 ? "selesai" : s.v > 0 ? "berjalan" : "belum", ket: pos >= 4 ? "sebagian siap salur" : rentang ? "jadwal salur " + rentang : "benih dirawat" },
      { nama: TAHAP[4], keadaan: planKini > 0 ? (s.vb && planKini >= s.vb * 0.99 ? "selesai" : "berjalan") : "belum",
        ket: planKini > 0 && s.vb ? pct(Math.min(100, planKini / s.vb * 100)) + " terjadwal s.d. " + BULAN[bi].slice(0, 3) : rentang ? "mulai " + BULAN[depan[0][0]] : "jadwal belum ada" },
      { nama: TAHAP[5], keadaan: belumLapor ? "kosong" : kead(tanam), ket: belumLapor ? "belum dilaporkan" : pct(tanam) + " ditanam" }
    ];

    /* provinsi dengan sasaran ≥ 200 ha */
    var P = s.provs.filter(function (p) { return p.t >= 200; });
    var cpclRendah = P.filter(function (p) { return p.c / p.t < 0.8; }).sort(function (a, b) { return (b.t - b.c) - (a.t - a.c); }).slice(0, 3);
    var kontrakRendah = P.filter(function (p) { return p.v / p.t < 0.8 && p.c / p.t >= 0.8; }).sort(function (a, b) { return (b.t - b.v) - (a.t - a.v); }).slice(0, 3);
    var siapBelum = P.filter(function (p) { return p.c / p.t >= 0.9 && p.v / p.t >= 0.9 && p.r === 0; }).sort(function (a, b) { return b.t - a.t; });
    var tertanam = s.provs.filter(function (p) { return p.r > 0; }).sort(function (a, b) { return b.r - a.r; });

    var ringkas = "";
    if (ada) {
      ringkas = s.r > 0 ? "Sudah " + ha(s.r) + " lahan ditanam (" + pct(tanam) + ") dari target " + ha(s.t) : "Belum ada lahan yang tercatat ditanam";
      if (o.prevR != null && s.r - o.prevR > 0.5) ringkas += ", bertambah " + ha(s.r - o.prevR) + " sejak laporan terbit " + o.prevTgl;
      ringkas += ". ";
      if (cpcl < 90) ringkas += "Calon penerima untuk " + ha(s.t - s.c) + " lahan belum terdata.";
      else if (benih < 90) ringkas += "Benih baru dipesan untuk " + pct(benih) + " lahan; " + ha(s.t - s.v) + " belum berkontrak.";
      else if (rasio !== null && rasio < 75) ringkas += "Benih yang dijadwalkan salur sampai " + BULAN[bi - 1] + " sebanyak " + jml(planLalu, sat) + ", " +
        (s.rb > 0 ? "tetapi yang sudah tertanam baru " + pct(rasio) + " dari jadwal itu." : "tetapi belum ada yang tercatat ditanam.");
      else if (rentang && s.r === 0) ringkas += "Penerima dan benih sudah lengkap; penyaluran dijadwalkan " + (depan.length > 1 ? BULAN[depan[0][0]] + " sampai " + BULAN[depan[depan.length - 1][0]] : BULAN[depan[0][0]]) + ".";
      else ringkas += "Penerima dan benih sudah hampir lengkap; tinggal menjaga laju penyaluran dan tanam.";
    }

    var kenapa = [];
    if (cpclRendah.length) kenapa.push(daftar(cpclRendah.map(function (p) { return rapi(p.n) + " (" + nf(p.c / p.t * 100) + "%)"; })) + ": CPCL di bawah 80% sasaran.");
    if (kontrakRendah.length) kenapa.push(daftar(kontrakRendah.map(function (p) { return rapi(p.n) + " (" + nf(p.v / p.t * 100) + "%)"; })) + ": kontrak benih di bawah 80% kebutuhan.");
    if (siapBelum.length && s.r > 0) kenapa.push(daftar(siapBelum.slice(0, 3).map(function (p) { return rapi(p.n) + " (" + ha(p.t) + ")"; })) + ": CPCL dan kontrak sudah siap, tetapi belum ada luas tanam.");
    if (siapBelum.length && s.r === 0 && planLalu > 0) kenapa.push("Jadwal salur sampai " + BULAN[bi - 1] + " sudah lewat, tetapi belum ada provinsi yang mencatat tanam.");
    if (tertanam.length) kenapa.push("Tanam terbanyak di " + daftar(tertanam.slice(0, 2).map(function (p) { return rapi(p.n) + " (" + ha(p.r) + ")"; })) +
      (tertanam.length > 2 ? ", dari " + tertanam.length + " provinsi yang sudah menanam." : "."));
    if (!kenapa.length && ada) kenapa.push(rasio === null ? "Jadwal salur benih baru dimulai " + (rentang ? BULAN[depan[0][0]] : "nanti") + ", jadi belum ada tanam masih sesuai jadwal." :
      "Data Sisbun belum menunjukkan hambatan menonjol di tingkat provinsi.");

    var berikut = [];
    var sisa = s.t - s.r, akhir = new Date(tgl.getFullYear(), 11, 31), minggu = Math.max(1, Math.ceil((akhir - tgl) / (7 * 864e5)));
    if (ada && sisa > 0.5) berikut.push("Sisa " + ha(sisa) + " perlu ditanam dalam " + minggu + " minggu sampai 31 Desember, rata-rata " + ha(sisa / minggu) + " per minggu.");
    if (depan.length) berikut.push("Jadwal salur benih: " + depan.map(function (x) { return BULAN[x[0]] + " " + jml(x[1], sat); }).join(", ") + ".");
    if (cpclRendah.length) berikut.push("Prioritas: lengkapi CPCL di " + daftar(cpclRendah.slice(0, 2).map(function (p) { return rapi(p.n); })) + " atau sesuaikan target.");
    else if (siapBelum.length && planLalu > 0) berikut.push("Prioritas: percepat penyaluran dan tanam di " + daftar(siapBelum.slice(0, 3).map(function (p) { return rapi(p.n); })) + ".");
    else if (siapBelum.length && depan.length) berikut.push("Prioritas: pastikan benih lolos sertifikasi dan lubang tanam siap untuk jadwal salur " + BULAN[depan[0][0]] + ", terutama di " + daftar(siapBelum.slice(0, 2).map(function (p) { return rapi(p.n); })) + ".");
    else if (kontrakRendah.length) berikut.push("Prioritas: selesaikan kontrak benih di " + daftar(kontrakRendah.slice(0, 2).map(function (p) { return rapi(p.n); })) + ".");

    return {
      status: status, fase: fase, pos: pos, tahap: tahap, ringkas: ringkas, kenapa: kenapa, berikutnya: berikut,
      tanam: tanam, cpcl: cpcl, benih: benih, rasio: rasio, planLalu: planLalu, planKini: planKini, depan: depan, bi: bi,
      siapBelum: siapBelum, cpclRendah: cpclRendah, kontrakRendah: kontrakRendah, minggu: minggu,
      bantuan: TANPA_PUPUK.indexOf(s.nama) >= 0 ? "Benih" : "Benih dan pupuk",
      jmlProv: s.provs.filter(function (p) { return p.t > 0; }).length
    };
  }

  window.Sisbun = {
    API: API, KOM: KOM, BULAN: BULAN, TAHAP: TAHAP, STATUS: STATUS, SATKER: SATKER,
    ambilSemua: ambilSemua, ambilBersama: ambilBersama, ambilSatker: ambilSatker, bacaCache: bacaCache, olah: olah,
    ha: ha, pct: pct, nf: nf, jml: jml, satuan: satuan, daftar: daftar, rapi: rapi
  };
})();
