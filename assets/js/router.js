/* Navigasi alamat #menu dan #menu-subtab — DESIGN.md §4 */
(function () {
  "use strict";

  /* Menu atas dan sub-tab (DESIGN.md §4.1–4.3). sub.id "" = sub-tab pertama (#menu).
     login: true → halaman kerja di web app Apps Script, tidak dibangun di portal publik. */
  var MENU = [
    { id: "beranda", nama: "Beranda", bawah: "Beranda", tahap: 7,
      penanda: "Beranda", judul: "Posisi bantuan dan anggaran hari ini",
      ket: "Dari pagu sampai bibit tertanam, dalam satu layar." },
    { id: "anggaran", nama: "Anggaran", bawah: "Anggaran", tahap: 2, judul: "Anggaran",
      ket: "Realisasi SP2D, outstanding kontrak, dan sisa anggaran per kegiatan dan unit kerja.",
      sub: [
        { id: "", nama: "Realisasi anggaran" },
        { id: "rincian", nama: "Rincian RO dan akun" },
        { id: "harian", nama: "Perbandingan harian" },
        { id: "target", nama: "Target serapan" }
      ] },
    { id: "kontrak", nama: "Kontrak", bawah: "Kontrak", tahap: 1, judul: "Kontrak",
      ket: "Ringkasan kontrak MyIntress dan manual, temuan validasi, dan peringatan jatuh tempo.",
      sub: [
        { id: "", nama: "Ringkasan" },
        { id: "validasi", nama: "Validasi data", login: true },
        { id: "temuan", nama: "Temuan" },
        { id: "peringatan", nama: "Peringatan" },
        { id: "database", nama: "Database kontrak", login: true },
        { id: "aktivitas", nama: "Aktivitas", login: true }
      ] },
    { id: "bantuan", nama: "Bantuan", bawah: "Bantuan", tahap: 5, judul: "Bantuan",
      ket: "Jejak tujuh komoditas dari CPCL sampai tanam, rekap nasional, dan rekap per provinsi.",
      sub: [
        { id: "", nama: "Jejak komoditas" },
        { id: "nasional", nama: "Rekap nasional" },
        { id: "provinsi", nama: "Rekap per provinsi" }
      ] },
    { id: "laporan", nama: "Laporan harian", bawah: "Laporan", tahap: 4, judul: "Laporan harian",
      ket: "Laporan yang sudah terbit dan dikunci sebagai pembanding Narasi PM esok hari.",
      sub: [
        { id: "", nama: "Laporan internal (A3)" },
        { id: "menteri", nama: "Laporan Menteri (16:9)" },
        { id: "narasi", nama: "Narasi PM" }
      ] },
    { id: "unggah", nama: "Unggah data", tahap: 3, judul: "Unggah data", login: true,
      ket: "Tujuh jenis file, satu jalur unggah per jenis: LOLOS langsung terbit, PERINGATAN terbit dengan catatan, GAGAL menunggu admin." }
  ];

  /* Halaman di luar menu atas. */
  var LAIN = [
    { id: "tentang", judul: "Tentang data dan rumus", halaman: "tentang", tanpaTahun: true },
    { id: "tahun", judul: "Pilih tahun anggaran", halaman: "tahun", tanpaTahun: true }
  ];

  var elIsi, sudahMuat = false;

  function cariMenu(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return null;
  }

  /** "#kontrak-temuan" → {menu, sub} atau null */
  function urai(hash) {
    var h = (hash || "").replace(/^#/, "").toLowerCase();
    if (!/^[a-z0-9-]*$/.test(h)) return null;
    for (var i = 0; i < LAIN.length; i++) if (LAIN[i].id === h) return { lain: LAIN[i] };
    var bagian = h.split("-"), menu = cariMenu(bagian[0]);
    if (!menu) return null;
    var subId = bagian.slice(1).join("-");
    if (!menu.sub) return subId ? null : { menu: menu, sub: null };
    for (var j = 0; j < menu.sub.length; j++) if (menu.sub[j].id === subId) return { menu: menu, sub: menu.sub[j] };
    return null;
  }

  function alamat(menu, sub) { return "#" + menu.id + (sub && sub.id ? "-" + sub.id : ""); }

  function gambarMenu(aktifId) {
    var atas = "", bawah = "";
    MENU.forEach(function (m) {
      var cur = m.id === aktifId ? ' aria-current="page"' : "";
      atas += '<a href="#' + m.id + '"' + cur + ">" + Monev.esc(m.nama) + "</a>";
      if (m.bawah) bawah += '<a href="#' + m.id + '"' + cur + ">" + Monev.esc(m.bawah) + "</a>";
    });
    document.getElementById("menu-atas").innerHTML = atas;
    document.getElementById("menu-bawah").innerHTML = bawah;
  }

  function render() {
    var r = urai(location.hash);
    if (!r) { location.replace("#beranda"); return; }

    var judul, isi = "";
    if (r.lain) {
      gambarMenu(null);
      judul = r.lain.judul;
      isi = Monev.halaman[r.lain.halaman](r);
    } else {
      gambarMenu(r.menu.id);
      judul = r.sub && r.sub.id ? r.sub.nama + " · " + r.menu.nama : r.menu.nama;
      isi = Monev.halaman.placeholder(r, { alamat: alamat });
    }

    document.title = judul + " · Monev Ditjenbun";
    elIsi.innerHTML = isi;

    var wadah = document.getElementById("isi-menu");
    if (wadah && r.menu && Monev.menu && Monev.menu[r.menu.id]) Monev.menu[r.menu.id].isi(wadah, r);

    if (sudahMuat) {
      window.scrollTo(0, 0);
      elIsi.focus({ preventScroll: true });
    }
    sudahMuat = true;
  }

  /* ---------- Status data di header (§5.8) ---------- */
  function perbaruiStatusData() {
    var el = document.getElementById("status-data");
    var teks = document.getElementById("status-data-teks");
    var ta = Monev.tahun.aktif();

    function set(kelas, isi) { el.className = "status-data " + kelas; teks.textContent = isi; }

    if (Monev.tahun.belumDibuka(ta)) { set("kosong", "TA " + ta + " belum dibuka"); return; }

    Monev.data.muatTahun("anggaran/latest.json").then(function (j) {
      /* data_per (bentuk baru) atau tanggal (latest.json bentuk lama, tanpa jam) */
      var per = j && (j.data_per || j.tanggal);
      if (!per) { set("kosong", "Waktu data belum tercatat"); return; }
      var basi = Monev.format.umurHari(j.data_per || per + "T00:00:00+07:00") > Monev.config.BATAS_HARI_BASI;
      set(basi ? "basi" : "", "Data per " + (j.data_per ? Monev.format.waktu(j.data_per) : Monev.format.tanggal(per)));
    }).catch(function (e) {
      set("kosong", e.status === 404 ? "Data TA " + ta + " belum tersedia" : "Waktu data gagal dimuat");
    });
  }

  /* ---------- Tombol Halaman kerja (dulu "Masuk") ---------- */
  function siapkanMasuk() {
    var a = document.getElementById("tombol-masuk");
    var url = Monev.urlMasuk("unggah");
    if (url) {
      a.href = url;
      a.rel = "noopener";
    } else {
      a.removeAttribute("href");
      a.setAttribute("role", "link");
      a.setAttribute("aria-disabled", "true");
      a.title = "Halaman kerja belum tersedia";
      a.setAttribute("aria-label", "Halaman kerja belum tersedia");
    }
  }

  /* ---------- Mulai ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    elIsi = document.getElementById("isi");
    siapkanMasuk();

    document.addEventListener("click", function (e) {
      var lompat = e.target.closest("[data-lompat]");
      if (lompat) { e.preventDefault(); elIsi.focus(); return; }
      var pilih = e.target.closest("[data-pilih-tahun]");
      if (pilih) { Monev.tahun.pilih(parseInt(pilih.getAttribute("data-pilih-tahun"), 10)); return; }
      if (e.target.closest("[data-coba-lagi]")) { location.reload(); }
    });

    Monev.tahun.siapkan().then(function () {
      perbaruiStatusData();
      Monev.tahun.saatBerubah(function () { perbaruiStatusData(); render(); });
      window.addEventListener("hashchange", render);
      render();
    }).catch(function () {
      gambarMenu(null);
      document.getElementById("label-tahun").textContent = "Setditjenbun · TA –";
      document.getElementById("status-data").className = "status-data kosong";
      document.getElementById("status-data-teks").textContent = "Daftar tahun gagal dimuat";
      elIsi.innerHTML = Monev.data.tampil.gagal("Daftar tahun anggaran (data/tahun.json) gagal dimuat", "");
    });
  });

  Monev.router = { MENU: MENU, urai: urai, alamat: alamat };
})();
