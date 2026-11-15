# Portal Monev Ditjenbun

Portal monitoring dan evaluasi Direktorat Jenderal Perkebunan, Kementerian Pertanian: anggaran, kontrak, bantuan, dan laporan harian dalam satu alamat.

Alamat: https://evaluasibun-dev.github.io/monev/

- Halaman statis (HTML, CSS, JavaScript) tanpa server; navigasi dengan alamat `#menu` atau `#menu-subtab`.
- Data ringkas per tahun anggaran di `data/<tahun>/`, ditulis otomatis oleh Apps Script setelah data diunggah dan diperiksa. Fisik bantuan dibaca langsung dari API publik Sisbun.
- Daftar tahun dan statusnya di `data/tahun.json`.
- Repo ini publik: tidak memuat nama penyedia, NRK, file mentah, token, PIN, atau ID Spreadsheet. Acuan tampilan di `DESIGN.md`.

Web sebelumnya di alamat ini (Jejak dan rekap bantuan dari hasil integrasi) tetap tersimpan di riwayat git, commit sebelum penggantian portal.
