/* Pengaturan portal. Tidak boleh berisi token, PIN, atau ID Spreadsheet (repo ini publik). */
window.Monev = window.Monev || {};

Monev.config = {
  /* Alamat web app Apps Script deployment KEDUA (login akun Google), diisi setelah Tahap 4.
     Selama kosong, tombol Masuk tampil nonaktif. */
  MASUK_URL: "",

  /* Kunci localStorage untuk tahun pilihan pengguna. */
  KUNCI_TAHUN: "monev.ta",

  /* Data dianggap lama (titik oranye) bila lebih dari sekian hari. DESIGN.md §5.8 */
  BATAS_HARI_BASI: 2
};
