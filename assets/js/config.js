/* Pengaturan portal. Tidak boleh berisi token, PIN, atau ID Spreadsheet (repo ini publik). */
window.Monev = window.Monev || {};

Monev.config = {
  /* Alamat web app Apps Script deployment KEDUA (login akun Google; hanya akun di sheet PENGGUNA yang bisa masuk).
     Dipasang 15 Nov 2026. Kosong = tombol Masuk tampil nonaktif. */
  MASUK_URL: "https://script.google.com/macros/s/AKfycbxa83oMFBm_EHu1h5xtmJGPbvtlXIKk_kBlmlRGSPTyHCFJ3ahdGZVr6BZTV2QMNSmq/exec",

  /* Kunci localStorage untuk tahun pilihan pengguna. */
  KUNCI_TAHUN: "monev.ta",

  /* Data dianggap lama (titik oranye) bila lebih dari sekian hari. DESIGN.md §5.8 */
  BATAS_HARI_BASI: 2
};

/** Alamat halaman kerja: page = "unggah" | "laporan" | "admin" | "realisasi" | "" (dashboard kontrak). "" bila MASUK_URL kosong. */
Monev.urlMasuk = function (page) {
  var u = Monev.config.MASUK_URL;
  return u ? u + (page ? "?page=" + encodeURIComponent(page) : "") : "";
};
