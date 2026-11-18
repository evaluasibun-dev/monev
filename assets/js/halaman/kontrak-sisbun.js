/* Menu Kontrak › Sandingan Sisbun — kontrak yang belum masuk Sisbun Hilirisasi.
   Disetujui pemilik portal 18 Nov 2026 (mockup monev-gas/docs/mockup/KontrakSisbunBelum.html).
   Cakupan: kontrak aktif kode kegiatan 5888 akun 526115 dan 5890 akun 521822 (akun = segmen ke-3 KRO).
   Sisbun tidak memuat nomor kontrak, jadi status ditentukan dari komoditas × jenis bantuan × lokasi:
   benih (Produksi Benih, Pengadaan Benih, Bongkar Ratoon, Perluasan Tebu) vs volume_kontrak_btg Sisbun
   (tebu: jumlah_benih_ha); pupuk (ha) vs cpcl_pupuk_ha Sisbun. Kontrak bersatuan ha → batang (Keputusan 11).
   Data Sisbun dibaca dari API publik per provinsi (tingkat kab/kota); nama penyedia tidak dibaca ke layar.
   Hanya tahun anggaran berjalan (API Sisbun tanpa pilihan tahun). */
(function () {
  "use strict";

  var API = "https://hilirisasibun.sisbun.com/api/realisasi-benih/summary-kawasan/data";
  var KOM = { Kelapa: "KELAPA", Kopi: "KOPI", Kakao: "KAKAO", Pala: "PALA", Lada: "LADA", "Jambu mete": "JAMBU METE", Tebu: "TEBU" };
  var NAMA = { KELAPA: "Kelapa", KOPI: "Kopi", KAKAO: "Kakao", PALA: "Pala", LADA: "Lada", "JAMBU METE": "Jambu mete", TEBU: "Tebu" };
  var BTG_HA = { KELAPA: 110, "JAMBU METE": 110, KOPI: 1000, KAKAO: 1000, PALA: 120, LADA: 1600 };   // Keputusan 11
  var CAKUPAN = [["5888", "526115"], ["5890", "521822"]];
  var CACHE = "monev-kontrak-sisbun-v1", UMUR = 29 * 60 * 1000;
  var ST = [
    ["belum", "Belum masuk Sisbun", "bad"], ["kurang", "Volume Sisbun kurang", "warn"], ["cek", "Perlu dicek", "neutral"],
    ["tercatat", "Tercatat di Sisbun", "ok"], ["luar", "Di luar cakupan Sisbun", "neutral"]
  ];
  var STM = {}; ST.forEach(function (s) { STM[s[0]] = s; });

  var F = function () { return Monev.format; };
  var e = function (s) { return Monev.esc(s); };
  var nf = function (v) { return F().ribuan(v); };

  /* ---------- nama wilayah ---------- */
  function nProv(p) {
    p = String(p || "").toUpperCase().replace(/[.]/g, " ").replace(/\s+/g, " ").trim();
    if (/YOGYA/.test(p)) return "DI YOGYAKARTA";
    if (p === "BANGKA BELITUNG" || p === "KEP BANGKA BELITUNG") return "KEPULAUAN BANGKA BELITUNG";
    return p;
  }
  /** "KAB. KEP. SANGIHE" → "KEPULAUANSANGIHE"; "KOTA BITUNG" → "KOTA:BITUNG" */
  function nKab(k) {
    var s = String(k || "").toUpperCase().trim();
    var kota = /^KOTA\s/.test(s);
    s = s.replace(/^(KAB(UPATEN)?\.?|KOTA)\s*/, "").replace(/\bKEP\.\s*/g, "KEPULAUAN ").replace(/[^A-Z]/g, "");
    return s ? (kota ? "KOTA:" : "") + s : "";
  }
  function rapi(s) {
    return String(s || "").toLowerCase().replace(/(^|[\s(.\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/^Kab\.\s*/, "").replace(/\bDki\b/, "DKI").replace(/^Di Yogyakarta$/, "DI Yogyakarta");
  }

  /* ---------- Sisbun ---------- */
  function url(where, lengkap) {
    var q = { where: JSON.stringify(where), fuzzy: "false", perPage: "500" };
    if (lengkap) q.compact = "false";
    return API + "?" + new URLSearchParams(q);
  }
  function ambil(where, lengkap) {
    var coba = function (n) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = ctl ? setTimeout(function () { ctl.abort(); }, 45000) : null;
      return fetch(url(where, lengkap), { signal: ctl ? ctl.signal : undefined, headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .finally(function () { if (t) clearTimeout(t); })
        .catch(function (err) { if (n > 0) return coba(n - 1); throw err; });
    };
    return coba(2);
  }
  /** Jalankan tugas (fungsi → Promise) paling banyak `n` sekaligus. */
  function antre(tugas, n, kemajuan) {
    var i = 0, selesai = 0, hasil = new Array(tugas.length);
    return new Promise(function (ok, gagal) {
      if (!tugas.length) { ok(hasil); return; }
      var berhenti = false;
      function jalan() {
        if (berhenti || i >= tugas.length) return;
        var k = i++;
        tugas[k]().then(function (h) {
          hasil[k] = h; selesai++; if (kemajuan) kemajuan(selesai, tugas.length);
          if (selesai === tugas.length) ok(hasil); else jalan();
        }, function (err) { berhenti = true; gagal(err); });
      }
      for (var w = 0; w < n; w++) jalan();
    });
  }
  function angka(v) { v = +v; return isFinite(v) ? v : 0; }

  /** Indeks Sisbun: {asof, diambil, K: {provKey: {nama, benih, pupuk, kab: {kabKey: {nama, benih, pupuk}}}}} */
  function muatSisbun(kemajuan, paksa) {
    if (!paksa) {
      try {
        var c = JSON.parse(localStorage.getItem(CACHE) || "null");
        if (c && c.K && Date.now() - new Date(c.diambil).getTime() < UMUR) return Promise.resolve(c);
      } catch (er) { /* abaikan */ }
    }
    var daftar = Object.keys(NAMA);
    return Promise.all(daftar.map(function (K) { return ambil({ komoditas: K }); })).then(function (nas) {
      var out = { asof: nas[0].meta && nas[0].meta.data_as_of, diambil: new Date().toISOString(), K: {} }, tugas = [];
      nas.forEach(function (d, i) {
        var K = daftar[i], adaPupuk = angka((d.regional_summary.totals || {}).volume_pupuk_kg) > 0;
        out.K[K] = {};
        (d.regional_summary.rows || []).forEach(function (r) {
          var pk = nProv(r.display_label);
          var P = out.K[K][pk] = { nama: r.display_label, benih: K === "TEBU" ? angka(r.jumlah_benih_ha) : angka(r.volume_kontrak_btg), pupuk: 0, pupukKg: angka(r.volume_pupuk_kg), kab: {} };
          tugas.push(function () {
            return ambil({ komoditas: K, provinsi_kawasan: r.display_label }, adaPupuk).then(function (dk) {
              (dk.regional_summary.rows || []).forEach(function (k) {
                var kk = nKab(k.display_label); if (!kk) return;
                var b = { nama: k.display_label, benih: K === "TEBU" ? angka(k.jumlah_benih_ha) : angka(k.volume_kontrak_btg), pupuk: angka(k.cpcl_pupuk_ha), pupukKg: angka(k.volume_pupuk_kg) };
                P.kab[kk] = b; P.pupuk += b.pupuk;
              });
            });
          });
        });
      });
      return antre(tugas, 6, kemajuan).then(function () {
        try { localStorage.setItem(CACHE, JSON.stringify(out)); } catch (er) { /* penyimpanan penuh */ }
        return out;
      });
    });
  }

  /* ---------- klasifikasi ---------- */
  function akun(c) { return String(c.kro || "").split(".")[2] || ""; }
  function dalamCakupan(c) {
    return c.aktif && CAKUPAN.some(function (x) { return c.kode_keg === x[0] && akun(c) === x[1]; });
  }
  function jenis(c) {
    var k = c.kegiatan || "";
    if (/pupuk/i.test(k)) return ["pupuk"];
    if (/KBD/i.test(k)) return ["luar", "Kegiatan KBD tebu tidak dicatat Sisbun"];
    if (/^(Produksi Benih|Pengadaan Benih|Bongkar Ratoon|Perluasan Tebu)/i.test(k)) return ["benih"];
    return ["luar", "Kegiatan \"" + k + "\" tidak dicatat Sisbun"];
  }
  function volume(c, K, jn) {
    var v = +c.volume;
    if (!(v > 0)) return { v: null };
    if (jn === "pupuk" || K === "TEBU") return c.satuan === "Ha" ? { v: v } : { v: null };
    if (c.satuan === "Batang") return { v: v };
    if (c.satuan === "Ha") return v > 20000 ? { v: v, cat: "Satuan Ha, angka batang" } : { v: v * BTG_HA[K], cat: nf(v) + " ha × " + nf(BTG_HA[K]) + " btg" };
    return { v: null };
  }
  function pecahKab(k) {
    return String(k || "").split(/,|;|&|\s+dan\s+/i).map(nKab).filter(Boolean);
  }

  function klasifikasi(j, S) {
    var namaKab = {};   // kabKey → {provKey: 1} dari semua komoditas Sisbun
    Object.keys(S.K).forEach(function (K) {
      Object.keys(S.K[K]).forEach(function (pk) {
        Object.keys(S.K[K][pk].kab).forEach(function (kk) { (namaKab[kk] = namaKab[kk] || {})[pk] = 1; });
      });
    });
    var nasional = {};
    Object.keys(S.K).forEach(function (K) {
      nasional[K] = { benih: 0, pupuk: 0 };
      Object.keys(S.K[K]).forEach(function (pk) { var P = S.K[K][pk]; nasional[K].benih += P.benih; nasional[K].pupuk += P.pupuk + (P.pupukKg > 0 ? 1 : 0); });
    });
    var rows = [];
    j.kontrak.filter(dalamCakupan).forEach(function (c) {
      var K = KOM[c.komBaku] || null, jn = jenis(c);
      var r = { c: c, no: c.no, kg: c.kode_keg, ak: akun(c), K: K, komN: K ? NAMA[K] : (c.komBaku || "(kosong)"),
        jn: jn[0], prov: c.provinsi ? rapi(nProv(c.provinsi)) : "", kab: c.kab && !/^[-–\s]+$/.test(c.kab) ? c.kab : "" };
      r.jnN = r.jn === "pupuk" ? "Pupuk" : r.jn === "benih" ? "Benih" : "KBD dan lainnya";
      rows.push(r);
      if (!c.komBaku) { r.g = "cek"; r.ket = "Komoditas kontrak kosong"; return; }
      if (!K) { r.g = "luar"; r.ket = "Komoditas " + c.komBaku + " tidak dicatat Sisbun"; return; }
      if (jn[0] === "luar") { r.g = "luar"; r.ket = jn[1]; return; }
      var m = volume(c, K, r.jn); r.v = m.v; r.cat = m.cat;
      var ukur = function (o) { return r.jn === "pupuk" ? (o.pupuk > 0 ? o.pupuk : o.pupukKg > 0 ? 1e-9 : 0) : o.benih; };
      var label = (r.jn === "pupuk" ? "pupuk " : "benih ") + NAMA[K].toLowerCase();
      if (!c.provinsi) { r.g = "cek"; r.ket = "Provinsi dan kab/kota kontrak kosong — lokasi tidak bisa dicocokkan"; return; }
      var pk = nProv(c.provinsi), P = S.K[K][pk];
      if (!((r.jn === "pupuk" ? nasional[K].pupuk : nasional[K].benih) > 0)) { r.g = "belum"; r.ket = "Sisbun belum mencatat " + label + " di provinsi mana pun"; return; }
      if (!P || !(ukur(P) > 0)) { r.g = "belum"; r.ket = "Sisbun belum mencatat " + label + " di provinsi ini"; return; }
      var ks = pecahKab(r.kab);
      if (!ks.length) { r.lok = K + "|" + r.jn + "|" + pk + "|*"; r.prov1 = true; r.sis = ukur(P); r.pk = pk; return; }
      ks = ks.map(function (k) { return !P.kab[k] && P.kab["KOTA:" + k] ? "KOTA:" + k : k; });
      var ada = ks.filter(function (k) { return P.kab[k] && ukur(P.kab[k]) > 0; });
      var dikenal = function (k) { return namaKab[k] || namaKab["KOTA:" + k]; };
      var provLain = ks.filter(function (k) { var o = dikenal(k); return o && !o[pk]; });
      if (!ada.length && provLain.length) { r.g = "cek"; r.ket = "Di Sisbun, " + r.kab + " ada di provinsi lain, bukan " + r.prov + " — cek provinsi kontrak"; return; }
      if (!ada.length) {
        if (ks.every(dikenal)) { r.g = "belum"; r.ket = "Sisbun belum mencatat " + label + " di " + r.kab; }
        else { r.g = "cek"; r.ket = "Nama kab/kota \"" + r.kab + "\" tidak dikenali di Sisbun — cek ejaan atau provinsi"; }
        return;
      }
      if (ada.length < ks.length) { r.g = "cek"; r.ket = "Sebagian kab/kota kontrak belum ada di Sisbun"; return; }
      r.lok = K + "|" + r.jn + "|" + pk + "|" + ada.slice().sort().join("+");
      r.sis = ada.reduce(function (a, k) { return a + ukur(P.kab[k]); }, 0);
      r.pk = pk;
    });

    /* Bandingkan volume per lokasi. Kontrak tanpa kab/kota dibandingkan dengan total provinsi (semua kontrak di provinsi itu). */
    var L = {}, PV = {};
    rows.forEach(function (r) {
      if (r.lok) (L[r.lok] = L[r.lok] || []).push(r);
      if (r.K && r.jn !== "luar" && r.pk) { var k = r.K + "|" + r.jn + "|" + r.pk; (PV[k] = PV[k] || []).push(r); }
    });
    Object.keys(L).forEach(function (lk) {
      var g0 = L[lk], r0 = g0[0], prov = r0.prov1;
      var g = prov ? PV[r0.K + "|" + r0.jn + "|" + r0.pk] : g0;
      var s = r0.sis, kos = g.filter(function (r) { return r.v == null; }).length;
      var v = g.reduce(function (a, r) { return a + (r.v || 0); }, 0);
      var sat = r0.jn === "pupuk" || r0.K === "TEBU" ? "ha" : "btg";
      var di = prov ? "Kab/kota tidak disebut; di provinsi ini " : "";
      g0.forEach(function (r) {
        r.lokN = g.length; r.lokSis = s; r.lokDb = v; r.lokSat = sat;
        if (v > s * 1.01) { r.g = "kurang"; r.ket = di + "Sisbun " + nf(s) + " " + sat + ", database " + nf(v) + " " + sat + " (" + g.length + " kontrak) — kurang " + nf(v - s) + " " + sat; }
        else { r.g = "tercatat"; r.ket = (prov ? "Tingkat provinsi: " : "") + "Sisbun " + nf(s) + " " + sat + " ≥ database " + nf(v) + " " + sat + (kos ? "; " + kos + " kontrak tanpa volume" : ""); }
      });
    });
    /* Lokasi kurang: bila satu kelompok (kode kegiatan, lalu nama kegiatan) jumlahnya = Sisbun (±1%), sisanya diduga belum masuk. */
    var LK = {};
    rows.forEach(function (r) { if (r.g === "kurang") (LK[r.lok] = LK[r.lok] || []).push(r); });
    Object.keys(LK).forEach(function (lk) {
      var g = LK[lk], s = g[0].lokSis, pas = null;
      [function (r) { return r.kg; }, function (r) { return r.c.kegiatan; }].some(function (fn) {
        var grp = {};
        g.forEach(function (r) { (grp[fn(r)] = grp[fn(r)] || []).push(r); });
        return Object.keys(grp).some(function (k) {
          var v = grp[k].reduce(function (a, r) { return a + (r.v || 0); }, 0);
          if (grp[k].length < g.length && Math.abs(v - s) <= 0.01 * s && !grp[k].some(function (r) { return r.v == null; })) { pas = { k: k, fn: fn }; return true; }
          return false;
        });
      });
      if (pas) g.forEach(function (r) { if (pas.fn(r) === pas.k) r.cocok = true; else r.duga = true; });
    });
    return rows;
  }

  /* ---------- tampilan ---------- */
  var STATE = { status: "belum", keg: "", unit: "", kom: "", cari: "", kunci: "", batas: 50 };
  var simpan = { j: null, S: null, rows: null };

  function lolos(r) {
    return (!STATE.keg || r.kg === STATE.keg) && (!STATE.unit || r.c.unitBaku === STATE.unit) && (!STATE.kom || r.komN === STATE.kom);
  }
  function hitung(rows) {
    var h = { n: 0, nil: 0, duga: 0 };
    ST.forEach(function (s) { h[s[0]] = 0; h[s[0] + "Rp"] = 0; });
    rows.forEach(function (r) { h.n++; h.nil += r.c.nilai; h[r.g]++; h[r.g + "Rp"] += r.c.nilai; if (r.duga) h.duga++; });
    return h;
  }
  function chip(s) { var x = STM[s]; return '<span class="chip chip-' + x[2] + '">' + e(x[1]) + "</span>"; }
  function opsi(v, label, pilih) { return '<option value="' + e(v) + '"' + (v === pilih ? " selected" : "") + ">" + e(label) + "</option>"; }
  function sel(n, st, kunci) {
    return n ? '<button type="button" class="tautan-sel" data-sb-status="' + st + '" data-sb-kunci="' + e(kunci) + '">' + nf(n) + "</button>" : '<span class="redup">–</span>';
  }
  function cocokKunci(r) {
    if (!STATE.kunci) return true;
    var i = STATE.kunci.indexOf(":"), t = STATE.kunci.slice(0, i), v = STATE.kunci.slice(i + 1);
    if (t === "keg") return r.kg === v;
    if (t === "kom") { var p = v.split("|"); return r.kg === p[0] && r.jnN === p[1] && r.komN === p[2]; }
    if (t === "unit") return r.c.unitBaku === v;
    return true;
  }
  function labelKunci() {
    if (!STATE.kunci) return "";
    var v = STATE.kunci.slice(STATE.kunci.indexOf(":") + 1);
    return STATE.kunci.indexOf("kom:") === 0 ? v.split("|").join(" · ").replace(/· (Benih|Pupuk|KBD dan lainnya) ·/, function (m, a) { return "· " + a.toLowerCase(); }) : v;
  }

  function tgl(iso) { return iso ? F().waktu(iso) : "–"; }

  function gambar(el) {
    var j = simpan.j, S = simpan.S, semua = simpan.rows, R = semua.filter(lolos), h = hitung(R);
    var I = Monev.istilah;
    var units = Object.keys(semua.reduce(function (o, r) { o[r.c.unitBaku] = 1; return o; }, {})).sort(I.urutUnit);
    var koms = Object.keys(semua.reduce(function (o, r) { o[r.komN] = 1; return o; }, {})).sort(I.urutKomoditas);
    var lokKurang = {}; R.forEach(function (r) { if (r.g === "kurang") lokKurang[r.lok] = 1; });

    var html = '<div class="filter-bar" role="group" aria-label="Saring sandingan">' +
      '<label class="sr-only" for="sb-keg">Kegiatan dan akun</label><select id="sb-keg" data-sb-filter="keg">' +
        opsi("", "5888 · 526115 dan 5890 · 521822", STATE.keg) + opsi("5888", "5888 · akun 526115", STATE.keg) + opsi("5890", "5890 · akun 521822", STATE.keg) + "</select>" +
      '<label class="sr-only" for="sb-unit">Unit kerja</label><select id="sb-unit" data-sb-filter="unit">' + opsi("", "Semua unit kerja", STATE.unit) + units.map(function (u) { return opsi(u, u, STATE.unit); }).join("") + "</select>" +
      '<label class="sr-only" for="sb-kom">Komoditas</label><select id="sb-kom" data-sb-filter="kom">' + opsi("", "Semua komoditas", STATE.kom) + koms.map(function (k) { return opsi(k, k, STATE.kom); }).join("") + "</select>" +
      '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-sb-segar>Muat ulang Sisbun</button>' +
      '<span class="sumber">Sisbun per ' + e(F().tanggal(S.asof)) + " (diambil " + e(F().jam(S.diambil)) + ") · Database kontrak per " + e(tgl(j.data_per)) + "</span></div>";

    function kartu(s, nilai, ket) {
      var x = STM[s];
      return '<button type="button" class="kartu-angka kartu-tombol" data-sb-status="' + s + '" aria-pressed="' + (STATE.status === s) + '"><span class="kartu-label">' + chip(s) + '</span><span class="kartu-nilai">' + e(nilai) + '</span><span class="kartu-ket">' + e(ket) + "</span></button>";
    }
    html += '<section class="grid-kartu grid-kartu-empat" aria-label="Status kontrak terhadap Sisbun">' +
      kartu("belum", nf(h.belum) + " kontrak", F().rupiah(h.belumRp) + " · lokasinya belum dicatat Sisbun") +
      kartu("kurang", nf(h.kurang) + " kontrak", Object.keys(lokKurang).length + " lokasi · " + F().rupiah(h.kurangRp) + " · " + h.duga + " diduga belum masuk") +
      kartu("cek", nf(h.cek) + " kontrak", F().rupiah(h.cekRp) + " · lokasi kosong, tidak dikenali, atau di provinsi lain") +
      kartu("tercatat", nf(h.tercatat) + " kontrak", F().rupiah(h.tercatatRp)) + "</section>" +
      '<p class="catatan">Dari ' + nf(h.n) + " kontrak aktif dalam cakupan (" + e(F().rupiah(h.nil)) + "); " + h.luar + ' kontrak (' + e(F().rupiah(h.luarRp)) +
      ') <button type="button" class="tautan-sel" data-sb-status="luar">di luar cakupan Sisbun</button>. Klik kartu atau angka untuk membuka daftarnya.</p>';

    /* rekap per kegiatan · jenis · komoditas */
    var grup = {};
    R.forEach(function (r) { var k = r.kg + "|" + r.jnN + "|" + r.komN; (grup[k] = grup[k] || []).push(r); });
    var kepala = '<th scope="col" class="angka">Kontrak</th><th scope="col" class="angka">Belum masuk</th><th scope="col" class="angka">Belum masuk (Rp)</th><th scope="col" class="angka">Kurang</th><th scope="col" class="angka">Diduga belum masuk</th><th scope="col" class="angka">Perlu dicek</th><th scope="col" class="angka">Tercatat</th><th scope="col" class="angka">Di luar</th>';
    function baris(label, x, kunci, kelas) {
      return "<tr" + (kelas ? ' class="' + kelas + '"' : "") + "><td>" + label + '</td><td class="angka">' + nf(x.n) + '</td><td class="angka">' + sel(x.belum, "belum", kunci) + '</td><td class="angka">' + (x.belumRp ? nf(x.belumRp) : '<span class="redup">–</span>') +
        '</td><td class="angka">' + sel(x.kurang, "kurang", kunci) + '</td><td class="angka">' + (x.duga ? nf(x.duga) : '<span class="redup">–</span>') + '</td><td class="angka">' + sel(x.cek, "cek", kunci) + '</td><td class="angka">' + sel(x.tercatat, "tercatat", kunci) + '</td><td class="angka">' + sel(x.luar, "luar", kunci) + "</td></tr>";
    }
    var badan = "";
    CAKUPAN.forEach(function (ca) {
      var ks = Object.keys(grup).filter(function (k) { return k.indexOf(ca[0] + "|") === 0; }).sort();
      if (!ks.length) return;
      var isi = []; ks.forEach(function (k) { isi = isi.concat(grup[k]); });
      badan += baris(ca[0] + " · akun " + ca[1], hitung(isi), "keg:" + ca[0], "tingkat-0");
      ks.forEach(function (k) {
        var q = k.split("|");
        badan += baris('<span class="sb-indent">' + e(q[1]) + " " + e(q[2].toLowerCase()) + "</span>", hitung(grup[k]), "kom:" + k);
      });
    });
    var T = h;
    html += '<section class="seksi"><div class="seksi-kepala"><h2>Rekap per kegiatan dan komoditas</h2><button type="button" class="tombol tombol-sekunder tombol-kecil" data-sb-csv="rekap">Unduh CSV</button></div>' +
      '<div class="wadah-tabel"><table class="tabel tabel-rapat"><thead><tr><th scope="col">Kegiatan · jenis · komoditas</th>' + kepala + "</tr></thead><tbody>" +
      (badan || '<tr><td colspan="9">Tidak ada kontrak untuk saringan ini.</td></tr>') + "</tbody>" +
      '<tfoot><tr class="jumlah"><td>Jumlah</td><td class="angka">' + nf(T.n) + '</td><td class="angka">' + nf(T.belum) + '</td><td class="angka">' + nf(T.belumRp) + '</td><td class="angka">' + nf(T.kurang) + '</td><td class="angka">' + nf(T.duga) + '</td><td class="angka">' + nf(T.cek) + '</td><td class="angka">' + nf(T.tercatat) + '</td><td class="angka">' + nf(T.luar) + "</td></tr></tfoot></table></div>" +
      '<p class="catatan">Angka = jumlah kontrak. Klik angka untuk membuka daftarnya di bawah.</p></section>';

    /* rekap per unit kerja */
    var gu = {};
    R.forEach(function (r) { (gu[r.c.unitBaku] = gu[r.c.unitBaku] || []).push(r); });
    html += '<section class="seksi"><div class="seksi-kepala"><h2>Rekap per unit kerja</h2><button type="button" class="tombol tombol-sekunder tombol-kecil" data-sb-csv="unit">Unduh CSV</button></div>' +
      '<div class="wadah-tabel"><table class="tabel tabel-rapat"><thead><tr><th scope="col">Unit kerja</th>' + kepala + "</tr></thead><tbody>" +
      Object.keys(gu).sort(I.urutUnit).map(function (u) { return baris(e(u), hitung(gu[u]), "unit:" + u); }).join("") + "</tbody></table></div>" +
      '<p class="catatan">Untuk tindak lanjut: unit kerja meminta operator Sisbun memasukkan kontrak yang belum tercatat, atau memperbaiki lokasi kontrak di database.</p></section>';

    /* daftar kontrak */
    var cari = STATE.cari.trim().toLowerCase();
    var daftar = R.filter(function (r) {
      return r.g === STATE.status && cocokKunci(r) &&
        (!cari || (r.no + " " + r.c.uraian + " " + r.prov + " " + r.kab).toLowerCase().indexOf(cari) >= 0);
    }).sort(urut);
    var x = STM[STATE.status];
    var seg = '<div class="segmen" role="group" aria-label="Status">' + ST.map(function (s) {
      return '<button type="button" data-sb-status="' + s[0] + '" data-sb-tetap aria-pressed="' + (STATE.status === s[0]) + '">' + e(s[1]) + " (" + nf(h[s[0]]) + ")</button>";
    }).join("") + "</div>";
    var tb = "", lokLalu = "";
    daftar.slice(0, STATE.batas).forEach(function (r) {
      var lok = r.lok || r.no;
      if (STATE.status === "kurang" && lok !== lokLalu) {
        var adaDuga = daftar.some(function (q) { return q.lok === lok && q.duga; });
        tb += '<tr class="sb-lokasi"><td colspan="8"><b>' + e(r.prov) + " · " + e(r.prov1 ? "kab/kota tidak disebut" : r.kab) + "</b> — " + e(r.jnN.toLowerCase() + " " + r.komN.toLowerCase()) + ": " +
          e(r.ket.replace(/^.*?Sisbun/, "Sisbun")) + (adaDuga ? ". Volume Sisbun sama dengan jumlah kontrak bertanda hijau, jadi kontrak bertanda merah diduga belum masuk." : "") + "</td></tr>";
      }
      lokLalu = lok;
      var vol = r.c.volume ? nf(r.c.volume) + " " + e(r.c.satuan || "") : '<span class="chip chip-neutral">Volume kosong</span>';
      var ket = STATE.status === "kurang"
        ? (r.duga ? '<span class="chip chip-bad">Diduga belum masuk</span>' : r.cocok ? '<span class="chip chip-ok">Jumlahnya = Sisbun</span>' : '<span class="sb-sub">' + r.lokN + " kontrak di lokasi ini; belum bisa ditentukan yang mana</span>")
        : e(r.ket);
      tb += '<tr><td><span class="mono">' + e(r.no) + '</span><span class="sb-sub sb-uraian" title="' + e(r.c.uraian) + '">' + e(r.c.uraian) + "</span></td><td>" + e(r.c.unitBaku) +
        "</td><td>" + e(r.c.kegiatan || "–") + '<span class="sb-sub">' + r.kg + " · " + r.ak + "</span></td><td>" + e(r.c.komoditas || "–") +
        "</td><td>" + e(r.prov || "–") + '<span class="sb-sub">' + e(r.kab || "–") + '</span></td><td class="angka">' + vol + (r.cat ? '<span class="sb-sub">' + e(r.cat) + "</span>" : "") +
        '</td><td class="angka">' + nf(r.c.nilai) + "</td><td>" + ket + "</td></tr>";
    });
    var nil = daftar.reduce(function (a, r) { return a + r.c.nilai; }, 0);
    html += '<section class="seksi" id="sb-daftar"><div class="seksi-kepala"><h2>Daftar kontrak — ' + e(x[1]) + (STATE.kunci ? " · " + e(labelKunci()) : "") + "</h2>" +
      '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-sb-csv="daftar">Unduh CSV</button></div>' +
      '<div class="baris-alat">' + seg + '<label class="sr-only" for="sb-cari">Cari kontrak</label><input type="search" id="sb-cari" class="input-cari" placeholder="Cari nomor kontrak, uraian, provinsi, kab/kota…" value="' + e(STATE.cari) + '">' +
      (STATE.kunci ? '<button type="button" class="tombol tombol-sekunder tombol-kecil" data-sb-lepas>Lepas saringan rekap</button>' : "") + "</div>" +
      '<div class="wadah-tabel"><table class="tabel tabel-rapat sb-daftar"><thead><tr><th scope="col">Nomor kontrak dan uraian</th><th scope="col">Unit kerja</th><th scope="col">Kegiatan</th><th scope="col">Komoditas</th><th scope="col">Provinsi · kab/kota</th><th scope="col" class="angka">Volume</th><th scope="col" class="angka">Nilai (Rp)</th><th scope="col">Keterangan</th></tr></thead><tbody>' +
      (tb || '<tr><td colspan="8">Tidak ada kontrak dengan status ini untuk saringan yang dipilih.</td></tr>') + "</tbody></table></div>" +
      (daftar.length > STATE.batas ? '<button type="button" class="tombol tombol-sekunder" data-sb-lebih>Tampilkan ' + Math.min(50, daftar.length - STATE.batas) + " lagi dari " + nf(daftar.length - STATE.batas) + "</button>" : "") +
      '<p class="catatan">' + nf(daftar.length) + " kontrak · " + e(F().rupiah(nil)) + " · urut provinsi, kab/kota, komoditas</p></section>";

    html += '<section class="seksi"><div class="seksi-kepala"><h2>Cara menentukan status</h2></div><ul class="sb-aturan">' +
      "<li><b>Cakupan</b>: kontrak aktif kode kegiatan 5888 akun 526115 dan kode kegiatan 5890 akun 521822. Sisbun tidak memuat nomor kontrak, jadi status ditentukan dari <b>komoditas × jenis bantuan × lokasi</b>.</li>" +
      "<li><b>Jenis bantuan</b>: benih (Produksi Benih, Pengadaan Benih, Bongkar Ratoon, Perluasan Tebu) dibandingkan dengan volume kontrak benih Sisbun (batang; tebu = ha benih). Pupuk dibandingkan dengan luas CPCL pupuk Sisbun (ha). Kontrak bersatuan ha dikonversi ke batang dengan Keputusan 11 (kelapa dan jambu mete 110, kopi dan kakao 1.000, pala 120, lada 1.600 batang/ha); bila angkanya di atas 20.000 dianggap batang yang salah satuan.</li>" +
      "<li>" + chip("belum") + " kab/kota kontrak ada di daftar wilayah Sisbun, tetapi Sisbun belum mencatat benih/pupuk komoditas itu di sana, di provinsinya, atau sama sekali.</li>" +
      "<li>" + chip("kurang") + " lokasinya ada di Sisbun, tetapi jumlah volume semua kontrak di lokasi itu lebih besar dari Sisbun (> 1%). Bila jumlah satu kelompok kontrak (kode kegiatan atau nama kegiatan) sama dengan volume Sisbun, kontrak lainnya diberi tanda <span class=\"chip chip-bad\">Diduga belum masuk</span>.</li>" +
      "<li>" + chip("cek") + " provinsi kosong, sebagian kab/kota belum ada di Sisbun, nama kab/kota tidak dikenali, atau kab/kota tercatat Sisbun di provinsi lain.</li>" +
      "<li>" + chip("tercatat") + " volume Sisbun di lokasi itu ≥ volume database. Kontrak tanpa kab/kota dibandingkan di tingkat provinsi.</li>" +
      "<li>" + chip("luar") + " komoditas atau kegiatan yang tidak dicatat Sisbun (karet, pembangunan/pemeliharaan KBD tebu, persediaan nursery).</li></ul></section>";

    var fokus = document.activeElement && document.activeElement.id, posisi = fokus && document.activeElement.selectionStart;
    el.innerHTML = html;
    if (fokus && document.getElementById(fokus)) {
      var f = document.getElementById(fokus); f.focus();
      if (posisi != null && f.setSelectionRange) try { f.setSelectionRange(posisi, posisi); } catch (er) { /* abaikan */ }
    }
  }
  function urut(a, b) {
    return (a.prov || "~").localeCompare(b.prov || "~") || (a.lok || a.kab || "").localeCompare(b.lok || b.kab || "") ||
      a.komN.localeCompare(b.komN) || (a.cocok ? 0 : 1) - (b.cocok ? 0 : 1) || b.c.nilai - a.c.nilai;
  }

  function unduh(jenis) {
    var R = simpan.rows.filter(lolos), ta = simpan.j.ta, f = Monev.unduhCSV;
    var kolomH = ["Kontrak", "Belum masuk", "Belum masuk (Rp)", "Volume Sisbun kurang", "Diduga belum masuk", "Perlu dicek", "Tercatat", "Di luar cakupan"];
    var nilaiH = function (x) { return [x.n, x.belum, x.belumRp, x.kurang, x.duga, x.cek, x.tercatat, x.luar]; };
    if (jenis === "rekap") {
      var g = {};
      R.forEach(function (r) { var k = r.kg + "|" + r.ak + "|" + r.jnN + "|" + r.komN; (g[k] = g[k] || []).push(r); });
      f("kontrak-sisbun-rekap-" + ta + ".csv", ["Kode kegiatan", "Akun", "Jenis", "Komoditas"].concat(kolomH),
        Object.keys(g).sort().map(function (k) { return k.split("|").concat(nilaiH(hitung(g[k]))); }));
    } else if (jenis === "unit") {
      var gu = {};
      R.forEach(function (r) { (gu[r.c.unitBaku] = gu[r.c.unitBaku] || []).push(r); });
      f("kontrak-sisbun-unit-" + ta + ".csv", ["Unit kerja"].concat(kolomH),
        Object.keys(gu).sort(Monev.istilah.urutUnit).map(function (u) { return [u].concat(nilaiH(hitung(gu[u]))); }));
    } else {
      f("kontrak-sisbun-" + STATE.status + "-" + ta + ".csv",
        ["Status", "Diduga belum masuk", "Nomor kontrak", "Uraian", "Unit kerja", "Kode kegiatan", "Akun", "Kegiatan", "Komoditas", "Jenis", "Provinsi", "Kab/kota", "Volume", "Satuan", "Volume dibandingkan", "Nilai (Rp)", "Sisbun di lokasi", "Database di lokasi", "Satuan banding", "Keterangan"],
        R.filter(function (r) { return r.g === STATE.status && cocokKunci(r); }).sort(urut).map(function (r) {
          return [STM[r.g][1], r.duga ? "Ya" : "", r.no, r.c.uraian, r.c.unitBaku, r.kg, r.ak, r.c.kegiatan, r.c.komoditas, r.jnN, r.prov, r.kab, r.c.volume, r.c.satuan,
            r.v == null ? "" : Math.round(r.v), r.c.nilai, r.lokSis == null ? "" : Math.round(r.lokSis * 100) / 100, r.lokDb == null ? "" : Math.round(r.lokDb), r.lokSat || "", r.ket];
        }));
    }
  }

  function pasang(el) {
    var ulang = function () { gambar(el); };
    el.addEventListener("change", function (ev) {
      var k = ev.target.getAttribute("data-sb-filter");
      if (k) { STATE[k] = ev.target.value; STATE.kunci = ""; STATE.batas = 50; ulang(); }
    });
    el.addEventListener("input", function (ev) {
      if (ev.target.id === "sb-cari") { STATE.cari = ev.target.value; STATE.batas = 50; ulang(); }
    });
    el.addEventListener("click", function (ev) {
      var t = ev.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-sb-status")) {
        STATE.status = t.getAttribute("data-sb-status"); STATE.batas = 50;
        if (!t.hasAttribute("data-sb-tetap")) STATE.kunci = t.getAttribute("data-sb-kunci") || "";
        ulang();
        if (!t.hasAttribute("data-sb-tetap")) { var d = document.getElementById("sb-daftar"); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" }); }
      } else if (t.hasAttribute("data-sb-lebih")) { STATE.batas += 50; ulang(); }
      else if (t.hasAttribute("data-sb-lepas")) { STATE.kunci = ""; ulang(); }
      else if (t.hasAttribute("data-sb-csv")) unduh(t.getAttribute("data-sb-csv"));
      else if (t.hasAttribute("data-sb-segar")) muatDanGambar(el, simpan.j, true);
    });
  }

  function muatDanGambar(el, j, paksa) {
    el.innerHTML = '<div class="seksi" aria-busy="true"><p class="catatan" id="sb-kemajuan">Mengambil data Sisbun per kab/kota…</p>' + Monev.data.tampil.memuat(4) + "</div>";
    muatSisbun(function (n, total) {
      var p = document.getElementById("sb-kemajuan");
      if (p) p.textContent = "Mengambil data Sisbun per kab/kota… " + n + " dari " + total + " provinsi-komoditas";
    }, paksa).then(function (S) {
      if (!el.isConnected) return;
      simpan = { j: j, S: S, rows: klasifikasi(j, S) };
      gambar(el);
    }).catch(function () {
      if (!el.isConnected) return;
      el.innerHTML = Monev.data.tampil.gagal("Data Sisbun gagal diambil", "");
      var b = el.querySelector("[data-coba-lagi]");
      if (b) b.addEventListener("click", function () { muatDanGambar(el, j, true); });
    });
  }

  Monev.kontrakSisbun = {
    /** Dipanggil kontrak.js untuk tab #kontrak-sisbun. j = kontrak.json yang sudah disiapkan (komBaku, unitBaku). */
    isi: function (el, j) {
      var ta = Monev.tahun.aktif();
      if (!Monev.tahun.berjalan(ta)) {
        el.innerHTML = Monev.data.tampil.kosong("Sandingan Sisbun hanya untuk tahun berjalan",
          "Sisbun Hilirisasi hanya menyediakan data tahun berjalan, jadi kontrak TA " + ta + " tidak bisa disandingkan.");
        return;
      }
      if (!el.dataset.sbPasang) { pasang(el); el.dataset.sbPasang = "1"; }
      if (simpan.j === j && simpan.rows) { gambar(el); return; }
      muatDanGambar(el, j, false);
    },
    /* untuk uji */
    _klasifikasi: klasifikasi, _nKab: nKab, _nProv: nProv
  };
})();
