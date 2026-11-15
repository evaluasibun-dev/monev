/* Halaman sementara untuk menu yang dibangun di Tahap 6. Tidak menampilkan angka contoh (DESIGN.md §9). */
(function () {
  "use strict";

  var URUTAN = ["", "Kontrak", "Anggaran", "Unggah data", "Laporan harian", "Bantuan", "Panel admin", "Beranda"];

  function judulHalaman(menu, aksi) {
    var e = Monev.esc;
    return '<div class="judul-halaman"><div class="judul-halaman-teks">' +
      (menu.penanda ? '<span class="penanda">' + e(menu.penanda) + "</span>" : "") +
      "<h1>" + e(menu.judul) + "</h1>" +
      (menu.ket ? "<p>" + e(menu.ket) + "</p>" : "") +
      "</div>" + (aksi ? '<div class="judul-halaman-aksi">' + aksi + "</div>" : "") + "</div>";
  }

  function subTab(menu, aktif, alamat) {
    if (!menu.sub) return "";
    var s = menu.sub.map(function (sb) {
      var cur = sb === aktif ? ' aria-current="page"' : "";
      var kunci = sb.login ? '<span class="sr-only">(perlu masuk)</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : "";
      return '<a href="' + alamat(menu, sb) + '"' + cur + ">" + Monev.esc(sb.nama) + kunci + "</a>";
    }).join("");
    return '<nav class="subtab" aria-label="Sub-menu ' + Monev.esc(menu.nama) + '">' + s + "</nav>";
  }

  function halamanLogin(nama, page) {
    var url = Monev.urlMasuk(page);
    return '<section class="keadaan">' +
      "<h2>" + Monev.esc(nama) + " ada di halaman kerja</h2>" +
      "<p>Halaman ini untuk operator dan admin, dibuka lewat tombol Masuk dengan akun Google kantor.</p>" +
      (url
        ? '<a class="tombol tombol-utama" href="' + Monev.esc(url) + '" rel="noopener">Masuk ke halaman kerja</a>'
        : '<p class="tambahan">Halaman kerja belum tersedia. Alamatnya dipasang setelah Apps Script deployment kedua siap (Tahap 4).</p>') +
      "</section>";
  }

  Monev.halaman = Monev.halaman || {};

  Monev.halaman.placeholder = function (r, alat) {
    var menu = r.menu, sub = r.sub;
    var ta = Monev.tahun.aktif();
    var modul = Monev.menu && Monev.menu[menu.id];
    var bisaIsi = modul && !menu.login && !(sub && sub.login) && !Monev.tahun.belumDibuka(ta);
    var html = judulHalaman(menu, bisaIsi && modul.aksi ? modul.aksi(r) : "") + subTab(menu, sub, alat.alamat);

    /* Menu yang sudah dibangun: router memanggil modul.isi(el, r) setelah kerangka ini dipasang. */
    if (bisaIsi) {
      var arsip = Monev.tahun.ditutup(ta)
        ? '<div class="banner" role="status"><span>TA ' + ta + " sudah ditutup; angka di halaman ini angka akhir tahun.</span>" +
          '<a class="tombol tombol-sekunder tombol-kecil" href="#tahun">Pilih tahun lain</a></div>' : "";
      return html + arsip + '<div class="isi-menu" id="isi-menu">' + Monev.data.tampil.memuat(4) + "</div>";
    }

    if (menu.login || (sub && sub.login)) {
      return html + halamanLogin(sub && sub.login ? sub.nama : menu.nama, menu.id === "unggah" ? "unggah" : "");
    }

    if (Monev.tahun.belumDibuka(ta)) {
      var info = Monev.tahun.info(ta);
      return html + Monev.data.tampil.kosong(
        "TA " + ta + " belum dibuka",
        "TA " + ta + " dibuka setelah DIPA terbit.",
        { label: "Pilih tahun anggaran", href: "#tahun" },
        info && info.keterangan ? info.keterangan : ""
      );
    }

    var namaHal = sub ? sub.nama : menu.nama;
    return html + Monev.data.tampil.kosong(
      namaHal + " sedang dibangun",
      "Halaman ini dibangun di Tahap 6, urutan " + menu.tahap + " (" + URUTAN[menu.tahap] + "). Sampai saat itu angka resmi tetap dibaca dari web lama.",
      { label: "Lihat sumber data dan rumus", href: "#tentang" }
    );
  };
})();
