// app.js — Jejak Bantuan Perkebunan (versi publik, hanya data agregat).
// Data ada di data.js (MONEV_DATA), dibuat oleh tampilan.py --publik.
(function () {
"use strict";

const D = MONEV_DATA;
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const konten = $("#konten");

// ---------------------------------------------------------------- format
function formatAngka(v, desimalPaksa) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  const d = desimalPaksa !== undefined ? desimalPaksa : (Number.isInteger(n) ? 0 : 2);
  return n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function formatRupiah(v) {
  if (v === null || v === undefined || v === "") return "";
  return "Rp " + formatAngka(v, 0);
}
function formatPersen(v) {
  if (v === null || v === undefined || v === "") return "";
  return (Number(v) * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}
function isKolomKode(nama) {
  const c = String(nama).toUpperCase();
  return c.startsWith("KODE") || c.endsWith("_ID") || c === "ID" || c === "NO";
}
function formatCell(nama, nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return "";
  if (typeof nilai !== "number") return String(nilai);
  if (isKolomKode(nama)) return String(nilai);
  const c = String(nama).toUpperCase();
  if (c.startsWith("%") || c.includes("PERSEN")) return formatPersen(nilai);
  const kataUang = ["ANGGARAN", "PAGU", "REALISASI_SP2D", "SISA", "HARGA", "KELEBIHAN"];
  if (kataUang.some((k) => c.includes(k))) return formatRupiah(nilai);
  return formatAngka(nilai);
}
function kelasSel(nama, nilai) {
  return typeof nilai === "number" && !isKolomKode(nama) ? "num" : "";
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function el(tag, attrs, ...anak) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === "class") n.className = attrs[k];
    else if (k === "html") n.innerHTML = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  for (const a of anak) {
    if (a === null || a === undefined) continue;
    n.appendChild(typeof a === "string" ? document.createTextNode(a) : a);
  }
  return n;
}

function halamanJudul(judul, sub) {
  const w = el("div");
  w.appendChild(el("h1", { class: "halaman-judul", html: judul }));
  if (sub) w.appendChild(el("p", { class: "halaman-sub", html: sub }));
  return w;
}

// ---------------------------------------------------------------- halaman Jejak (beranda)
function pecah(a, b) { return b ? a / b : 0; }
function meter(label, pecahan, nilaiTeks, sub, emas) {
  const lebar = Math.min(100, Math.max(pecahan > 0 ? 1.5 : 0, pecahan * 100));
  return el("div", { class: "meter" },
    el("div", { class: "meter-head" }, el("span", {}, label), el("span", { class: "v" }, nilaiTeks)),
    el("div", { class: "track" }, el("div", { class: "fill" + (emas ? " emas" : ""), style: `width:${lebar}%` })),
    sub ? el("div", { class: "meter-sub" }, sub) : null);
}
function rupiahSingkat(v) {
  const n = Number(v) || 0;
  if (n >= 1e12) return "Rp" + formatAngka(n / 1e12, 2) + " T";
  if (n >= 1e9) return "Rp" + formatAngka(n / 1e9, 1) + " M";
  if (n >= 1e6) return "Rp" + formatAngka(n / 1e6, 1) + " jt";
  return formatRupiah(n);
}
function statusKomoditas(k) {
  if (!k.target) return { teks: "Hanya ABT", kls: "netral" };
  const tanam = pecah(k.ditanam, k.target);
  if (tanam >= 0.5) return { teks: "Berjalan baik", kls: "baik" };
  if (k.ditanam > 0 || k.realisasi > 0) return { teks: "Perlu dipercepat", kls: "" };
  return { teks: "Belum mulai", kls: "buruk" };
}
function narasiKomoditas(k) {
  const bagian = [];
  if (k.target) {
    bagian.push(`Lahan yang sudah ditanam ${formatPersen(pecah(k.ditanam, k.target))} dari sasaran, sedangkan anggaran yang sudah terbayar ${formatPersen(pecah(k.realisasi, k.pagu))} dari pagu.`);
  } else {
    bagian.push("Komoditas ini baru punya kegiatan dari sumber dana ABT, yang belum punya pelaporan fisik.");
  }
  if (k.abt && (k.abt.target || k.abt.pagu)) {
    bagian.push(`Tambahan ABT: ${formatAngka(k.abt.target)} Ha dengan pagu ${rupiahSingkat(k.abt.pagu)} (belum ada pelaporan fisik).`);
  }
  return bagian.join(" ");
}

function halamanJejak() {
  const J = D.jejak;
  const komoditas = J.komoditas;
  const st = { aktif: 0, metrik: "ditanam", provKom: "Semua" };
  const root = el("div");

  const totTarget = komoditas.reduce((a, k) => a + k.target, 0);
  const totDitanam = komoditas.reduce((a, k) => a + k.ditanam, 0);
  const totNas = D.rekap.nasional.total;

  // ---- hero
  const hero = el("section", { class: "hero" }, el("div", { class: "wrap" },
    el("div", { class: "kicker" }, `Pemantauan Bantuan Ditjenbun ${D.meta.tahun}`),
    el("h1", {}, `Jejak bantuan perkebunan ${D.meta.tahun}`),
    el("p", { class: "lede" }, "Telusuri sampai mana bantuan perkebunan sudah berjalan: berapa lahan yang sudah ditanam, berapa anggaran yang sudah terbayar, dan siapa yang mengerjakan."),
    el("div", { class: "hero-kpi" },
      el("div", {}, el("div", { class: "n" }, formatPersen(pecah(totDitanam, totTarget))), el("div", { class: "t" }, `lahan sudah ditanam: ${formatAngka(totDitanam)} dari ${formatAngka(totTarget)} Ha sasaran`)),
      el("div", {}, el("div", { class: "n" }, formatPersen(totNas.realisasiPersen)), el("div", { class: "t" }, `anggaran terbayar: ${rupiahSingkat(totNas.realisasiRp)} dari ${rupiahSingkat(totNas.pagu)}`)),
      el("div", {}, el("div", { class: "n" }, `${komoditas.length} komoditas`), el("div", { class: "t" }, `di ${D.daftarProvinsi.length} provinsi, dikerjakan ${D.jumlahSatker} satker`))
    ),
    el("div", { class: "hero-box", html: `<b>Data per ${esc(D.meta.tanggalTeks)}</b> — dari hasil integrasi Monev.` }),
    el("div", { class: "hero-act" },
      el("a", { class: "btn-hero", href: "#/rekap/nasional" }, "Rekap nasional (PDF)"),
      el("a", { class: "btn-hero garis", href: "#/rekap/provinsi" }, "Lihat per provinsi"))
  ));
  root.appendChild(hero);

  const isi = el("div", { class: "wrap" });
  root.appendChild(isi);

  function chipKomoditas(pilihan, aktifNama, saatPilih, denganSemua) {
    const w = el("div", { class: "chips" });
    const daftar = (denganSemua ? [{ nama: "Semua" }] : []).concat(pilihan);
    daftar.forEach((k) => {
      const c = el("button", { class: "chip" + (k.nama === aktifNama ? " on" : "") }, el("i"), k.nama);
      c.addEventListener("click", () => saatPilih(k.nama));
      w.appendChild(c);
    });
    return w;
  }

  function barisBar(nama, pecahan, nilaiTeks, href) {
    return el(href ? "a" : "div", href ? { class: "baris", href } : { class: "baris" },
      el("div", { class: "nm", title: nama }, nama),
      el("div", { class: "track" }, el("div", { class: "fill", style: `width:${Math.min(100, Math.max(pecahan > 0 ? 1.5 : 0, pecahan * 100))}%` })),
      el("div", { class: "nilai" }, nilaiTeks));
  }

  function seksiPilih() {
    const k = komoditas[st.aktif];
    const s = statusKomoditas(k);
    const sec = el("section", { class: "bagian" });
    sec.appendChild(el("h2", {}, "Pilih komoditas"));
    sec.appendChild(el("p", { class: "ket" }, "Ketuk salah satu komoditas untuk melihat posisinya dan siapa yang mengerjakan."));
    sec.appendChild(chipKomoditas(komoditas, k.nama, (nm) => { st.aktif = komoditas.findIndex((x) => x.nama === nm); muat(); }, false));

    const kartu = el("div", { class: "kartu" });
    kartu.appendChild(el("div", { class: "kartu-head" }, el("h3", {}, k.nama), el("span", { class: "pill " + s.kls }, s.teks)));
    kartu.appendChild(el("div", { class: "sasaran" }, k.target ? `Sasaran ${formatAngka(k.target)} Ha` : "Belum ada sasaran fisik reguler"));
    kartu.appendChild(el("p", { class: "narasi" }, narasiKomoditas(k)));

    const kiri = el("div");
    if (k.target) kiri.appendChild(meter("Lahan ditanam", pecah(k.ditanam, k.target), formatPersen(pecah(k.ditanam, k.target)), `${formatAngka(k.ditanam)} Ha dari ${formatAngka(k.target)} Ha`, true));
    kiri.appendChild(meter("Anggaran terbayar", pecah(k.realisasi, k.pagu), formatPersen(pecah(k.realisasi, k.pagu)), `${rupiahSingkat(k.realisasi)} dari ${rupiahSingkat(k.pagu)} (SP2D)`, false));

    const kanan = el("div");
    if (k.satker.length) {
      kanan.appendChild(el("div", { class: "sub-judul" }, "Siapa yang mengerjakan (Ha ditanam / sasaran)"));
      k.satker.forEach((x) => kanan.appendChild(barisBar(x.nama, pecah(x.ditanam, x.target), `${formatAngka(x.ditanam)} / ${formatAngka(x.target)} Ha`)));
    }
    kartu.appendChild(el("div", { class: "kolom2" }, kiri, kanan));

    if (k.jenis.length) {
      const j = el("div", { style: "margin-top:18px" });
      j.appendChild(el("div", { class: "sub-judul" }, "Menurut jenis kegiatan"));
      k.jenis.forEach((x) => j.appendChild(barisBar(x.nama, pecah(x.ditanam, x.target), `${formatAngka(x.ditanam)} / ${formatAngka(x.target)} Ha`)));
      kartu.appendChild(j);
    }
    sec.appendChild(kartu);
    return sec;
  }

  function seksiBandingkan() {
    const sec = el("section", { class: "bagian" });
    sec.appendChild(el("h2", {}, "Bandingkan semua komoditas"));
    sec.appendChild(el("p", { class: "ket" }, "Pilih ukuran yang ingin dibandingkan. Ketuk nama komoditas untuk membuka rinciannya."));
    const w = el("div", { class: "chips" });
    [["ditanam", "Lahan ditanam"], ["anggaran", "Anggaran terbayar"]].forEach(([kunci, label]) => {
      const c = el("button", { class: "chip" + (st.metrik === kunci ? " on" : "") }, label);
      c.addEventListener("click", () => { st.metrik = kunci; muat(); });
      w.appendChild(c);
    });
    sec.appendChild(w);
    const kartu = el("div", { class: "kartu" });
    komoditas.forEach((k, i) => {
      let pec, teks;
      if (st.metrik === "ditanam") {
        if (!k.target) return;
        pec = pecah(k.ditanam, k.target); teks = `${formatPersen(pec)} · ${formatAngka(k.ditanam)} Ha`;
      } else {
        if (!k.pagu) return;
        pec = pecah(k.realisasi, k.pagu); teks = `${formatPersen(pec)} · ${rupiahSingkat(k.realisasi)}`;
      }
      const b = barisBar(k.nama, pec, teks);
      b.style.cursor = "pointer";
      b.addEventListener("click", () => { st.aktif = i; muat(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      kartu.appendChild(b);
    });
    kartu.appendChild(el("div", { class: "catatan" }, st.metrik === "ditanam"
      ? "Lahan sudah ditanam dibanding sasaran reguler tahun ini. ABT belum punya pelaporan fisik."
      : "Realisasi SP2D dibanding pagu (akun 526) per komoditas, tanpa ABT."));
    sec.appendChild(kartu);
    return sec;
  }

  function seksiProvinsi() {
    const sec = el("section", { class: "bagian" });
    sec.appendChild(el("h2", {}, "Sebaran per provinsi"));
    sec.appendChild(el("p", { class: "ket" }, "Luas sasaran tiap provinsi. Ketuk provinsi untuk membuka rekap bantuannya dan mencetaknya sebagai PDF."));
    sec.appendChild(chipKomoditas(komoditas.filter((k) => k.target), st.provKom, (nm) => { st.provKom = nm; muat(); }, true));

    const agg = {};
    komoditas.forEach((k) => {
      if (st.provKom !== "Semua" && k.nama !== st.provKom) return;
      k.provinsi.forEach((p) => {
        const a = agg[p.nama] || (agg[p.nama] = { nama: p.nama, target: 0, ditanam: 0 });
        a.target += p.target; a.ditanam += p.ditanam;
      });
    });
    const daftar = Object.values(agg).filter((p) => p.target > 0).sort((a, b) => b.target - a.target);
    const maks = daftar.length ? daftar[0].target : 1;
    const kartu = el("div", { class: "kartu" });
    daftar.forEach((p) => kartu.appendChild(barisBar(p.nama, p.target / maks,
      `${formatAngka(p.target)} Ha · ${formatPersen(pecah(p.ditanam, p.target))}`, `#/rekap/provinsi/${encodeURIComponent(p.nama)}`)));
    if (!daftar.length) kartu.appendChild(el("p", {}, "Belum ada sasaran untuk pilihan ini."));
    kartu.appendChild(el("div", { class: "catatan" }, "Bar = luas sasaran (Ha); angka di kanan = sasaran dan persen ditanam."));
    sec.appendChild(kartu);
    return sec;
  }

  function muat() {
    isi.innerHTML = "";
    isi.appendChild(seksiPilih());
    isi.appendChild(seksiBandingkan());
    isi.appendChild(seksiProvinsi());
    if (J.pendukung && (J.pendukung.pagu || J.pendukung.target)) {
      const p = J.pendukung;
      isi.appendChild(el("p", { class: "catatan", style: "margin-top:18px" },
        `Kegiatan pendukung (kebun benih sebar, regu OPT, desa organik, dll.): pagu ${rupiahSingkat(p.pagu)}, terbayar ${rupiahSingkat(p.realisasi)} (${formatPersen(pecah(p.realisasi, p.pagu))}). Lihat rincian di Rekap Nasional.`));
    }
  }
  muat();
  return root;
}

function tabelLaporan(rekap) {
  const w = el("div", { class: "laporan area-cetak" });
  w.appendChild(el("h2", {}, rekap.judul));
  if (rekap.subjudul) w.appendChild(el("div", { class: "laporan-subjudul" }, rekap.subjudul));
  const table = el("table", { class: "laporan-tabel" });
  const thead = el("thead");
  thead.appendChild(el("tr", {},
    ...["No", "Kegiatan/Bantuan", "Volume", "Satuan", "Pagu (Rp)", "Realisasi Volume", "Realisasi Volume (%)", "Realisasi (Rp)", "Realisasi (%)"].map((h) => el("th", {}, h))
  ));
  table.appendChild(thead);
  const tbody = el("tbody");
  rekap.baris.forEach((b, i) => {
    tbody.appendChild(el("tr", {},
      el("td", { class: "num" }, String(i + 1)),
      el("td", { class: "teks" }, b.kegiatan),
      el("td", { class: "num" }, formatAngka(b.volume)),
      el("td", {}, "Hektar"),
      el("td", { class: "num" }, formatAngka(b.pagu, 0)),
      el("td", { class: "num" }, formatAngka(b.realisasiVolume)),
      el("td", { class: "num" }, formatPersen(b.realisasiVolumePersen)),
      el("td", { class: "num" }, formatAngka(b.realisasiRp, 0)),
      el("td", { class: "num" }, formatPersen(b.realisasiPersen))
    ));
  });
  table.appendChild(tbody);
  const tfoot = el("tfoot");
  tfoot.appendChild(el("tr", {},
    el("td", {}, ""),
    el("td", { class: "teks" }, D.rekap.labelTotal),
    el("td", {}, ""),
    el("td", {}, ""),
    el("td", { class: "num" }, formatAngka(rekap.total.pagu, 0)),
    el("td", {}, ""),
    el("td", {}, ""),
    el("td", { class: "num" }, formatAngka(rekap.total.realisasiRp, 0)),
    el("td", { class: "num" }, formatPersen(rekap.total.realisasiPersen))
  ));
  table.appendChild(tfoot);
  w.appendChild(table);
  w.appendChild(el("p", { class: "laporan-ket" },
    `Sumber data: Data gabungan anggaran & fisik pada hasil integrasi Monev. ` +
    `Kegiatan/Bantuan dikelompokkan per RO: "Kawasan <Komoditas>" untuk kegiatan tanam, ditambah akhiran "(ABT)" bila sumber dana ABT; kegiatan pendukung berdiri sendiri sesuai nama RO-nya. ` +
    `Volume/Realisasi Volume dalam Ha (TARGET_FISIK_HA/REALISASI_TANAM_HA). Pagu/Realisasi (Rp) dari akun 526 (ANGGARAN/REALISASI_SP2D).`
  ));
  return w;
}

function tombolCetak() {
  const btn = el("button", { class: "btn" }, "Cetak / Simpan PDF");
  btn.addEventListener("click", () => window.print());
  return btn;
}

function halamanRekapNasional() {
  const w = el("div");
  w.appendChild(halamanJudul("Rekap Nasional", "Rekap Kegiatan/Bantuan Ditjen Perkebunan seluruh Indonesia — format sama seperti laporan bantuan provinsi."));
  w.appendChild(el("div", { class: "rekap-toolbar no-print" }, tombolCetak()));
  w.appendChild(tabelLaporan(D.rekap.nasional));
  return w;
}

function halamanRekapProvinsiIndeks() {
  const w = el("div");
  w.appendChild(halamanJudul("Rekap per Provinsi", "Pilih provinsi untuk melihat rekap Kegiatan/Bantuan dan mencetaknya sebagai PDF."));
  const grid = el("div", { class: "grid-provinsi" });
  D.daftarProvinsi.forEach((nama) => {
    const r = D.rekap.provinsi[nama];
    grid.appendChild(el("div", { class: "kartu-provinsi" },
      el("div", { class: "nm" }, nama),
      el("div", { class: "stat" }, `Pagu ${formatRupiah(r.total.pagu)}`),
      el("div", { class: "stat" }, `Realisasi ${formatPersen(r.total.realisasiPersen)} · ${r.baris.length} kegiatan`),
      el("a", { href: `#/rekap/provinsi/${encodeURIComponent(nama)}` }, "Lihat rekap →")
    ));
  });
  w.appendChild(grid);
  return w;
}

function halamanRekapProvinsi(nama) {
  const rekap = D.rekap.provinsi[nama];
  const w = el("div");
  if (!rekap) { w.appendChild(halamanJudul("Provinsi tidak ditemukan")); return w; }
  w.appendChild(halamanJudul(`Rekap Provinsi ${esc(nama)}`));
  const btnKembali = el("button", { class: "btn sekunder" }, "‹ Semua provinsi");
  btnKembali.addEventListener("click", () => { location.hash = "#/rekap/provinsi"; });
  w.appendChild(el("div", { class: "rekap-toolbar no-print" }, btnKembali, tombolCetak()));
  w.appendChild(tabelLaporan(rekap));
  return w;
}

function halamanTentang() {
  const w = el("div");
  w.appendChild(halamanJudul("Tentang Data", "Dari mana angka-angka di situs ini berasal dan bagaimana cara membacanya."));
  const kartu = el("div", { class: "kartu" });
  const baris = [
    ["Data per", D.meta.tanggalTeks],
    ["Sumber", "Hasil integrasi Monev Ditjenbun: realisasi anggaran dari SAKTI dan FA16 (SP2D), target fisik dari SAT 3, realisasi tanam dari Hilirisasi."],
    ["Lahan ditanam", "Realisasi tanam (Ha) dibanding sasaran fisik tahun ini. Hanya sumber dana reguler yang punya pelaporan fisik; ABT dicatat terpisah."],
    ["Anggaran terbayar", "Realisasi SP2D dibanding pagu, khusus akun 526 (belanja yang diserahkan kepada masyarakat/pemda)."],
    ["Kegiatan/Bantuan", "Dikelompokkan per RO: \"Kawasan <Komoditas>\" untuk kegiatan tanam, ditambah akhiran (ABT) untuk sumber dana ABT; kegiatan pendukung berdiri sendiri sesuai nama RO-nya."],
    ["Cetak PDF", "Buka Rekap Nasional atau halaman provinsi, tekan Cetak / Simpan PDF, lalu pilih tujuan \"Simpan sebagai PDF\"."],
    ["Cakupan", "Ditjen Perkebunan. Situs ini hanya memuat ringkasan; data per item dan per akun tidak dipublikasikan."],
  ];
  const table = el("table", { class: "tabel-info" });
  const tbody = el("tbody");
  baris.forEach(([a, b]) => tbody.appendChild(el("tr", {}, el("td", {}, a), el("td", {}, b))));
  table.appendChild(tbody);
  kartu.appendChild(table);
  w.appendChild(kartu);
  return w;
}

// ---------------------------------------------------------------- router
function urai(hash) {
  return (hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
}

function render() {
  const b = urai(location.hash);
  let halaman, routeAktif = "jejak";

  if (b[0] === "rekap" && b[1] === "nasional") {
    halaman = halamanRekapNasional(); routeAktif = "rekap/nasional";
  } else if (b[0] === "rekap" && b[1] === "provinsi" && b[2]) {
    halaman = halamanRekapProvinsi(b[2]); routeAktif = "rekap/provinsi";
  } else if (b[0] === "rekap" && b[1] === "provinsi") {
    halaman = halamanRekapProvinsiIndeks(); routeAktif = "rekap/provinsi";
  } else if (b[0] === "tentang") {
    halaman = halamanTentang(); routeAktif = "tentang";
  } else {
    halaman = halamanJejak();
  }

  konten.innerHTML = "";
  if (routeAktif === "jejak") konten.appendChild(halaman);
  else konten.appendChild(el("div", { class: "wrap halaman" }, halaman));
  window.scrollTo(0, 0);
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === routeAktif));
}

window.addEventListener("hashchange", render);
document.addEventListener("DOMContentLoaded", () => {
  $("#brandSub").textContent = `Data per ${D.meta.tanggalTeks}`;
  render();
});
})();
