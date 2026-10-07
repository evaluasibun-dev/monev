# Jejak Bantuan Perkebunan — Monev Ditjenbun

Situs statis (HTML/CSS/JS) berisi ringkasan bantuan perkebunan: lahan ditanam, anggaran terbayar,
rekap Nasional dan per Provinsi (bisa dicetak sebagai PDF). Hanya memuat data agregat.

Berkas: `index.html`, `style.css`, `app.js`, `data.js`.
`data.js` dibuat otomatis dari hasil integrasi Monev (`python tampilan.py --publik`);
untuk memperbarui data, cukup unggah ulang `data.js` saja.
