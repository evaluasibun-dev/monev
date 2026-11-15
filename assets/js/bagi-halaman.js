/* Pembagi halaman tabel/daftar yang dipakai bersama semua menu.
   Aturan tampilan (pemilik portal, 15 Nov 2026): kartu yang berdampingan sama tinggi; isi panjang
   tidak memanjang ke bawah tetapi dibagi per halaman dengan tombol Sebelumnya/Berikutnya.

   Monev.bagiHalaman.pager()            → HTML tombol halaman; taruh di dalam kartu, setelah tabel/daftar.
   Monev.bagiHalaman.pasang({
     kartu: el,          // kartu (.seksi) yang berisi baris
     baris: "tr[data-hal-baris]",   // pemilih baris yang dibagi (di dalam kartu)
     lawan: el|null,     // kartu di sebelahnya; bila berdampingan, tinggi kartu mengikuti lawan
     perHal: 10,         // jumlah baris per halaman bila tidak berdampingan (atau lawan tidak ada)
     keadaan: obj, kunci: "hal",    // tempat menyimpan nomor halaman (null = halaman awal)
     awal: fungsi(rows) → indeks baris yang harus tampil di halaman awal (opsional),
     minBaris: 1         // paling sedikit baris per halaman; bila kartu tetap lebih tinggi, lawan ikut ditinggikan
   })
   Tinggi diukur ulang saat ukuran jendela berubah. */
(function () {
  "use strict";
  var M = window.Monev = window.Monev || {};

  function pager() {
    return '<div class="pager-akun" data-bagi-pager hidden><button type="button" class="tombol tombol-sekunder tombol-kecil" data-bagi-arah="-1">‹ Sebelumnya</button>' +
      '<span aria-live="polite" data-bagi-ket></span><button type="button" class="tombol tombol-sekunder tombol-kecil" data-bagi-arah="1">Berikutnya ›</button></div>';
  }

  function hitung(o) {
    var K = o.kartu, L = o.lawan;
    if (!K || !K.isConnected) return false;
    var rows = Array.prototype.slice.call(K.querySelectorAll(o.baris));
    var pg = K.querySelector("[data-bagi-pager]");
    if (!pg) return true;
    K.style.minHeight = ""; if (L) L.style.minHeight = "";
    var batas = [0], i, per = o.perHal || 10;
    K.style.alignSelf = "start"; if (L) L.style.alignSelf = "start";
    var berdampingan = !!(L && L.offsetParent && Math.abs(K.getBoundingClientRect().top - L.getBoundingClientRect().top) < 4);
    if (!berdampingan) {
      for (i = per; i < rows.length; i += per) batas.push(i);
    } else {
      pg.hidden = false;
      rows.forEach(function (r) { r.hidden = true; });
      var target = L.offsetHeight, mulai = 0, minB = o.minBaris || 1;
      for (i = 0; i < rows.length; i++) {
        rows[i].hidden = false;
        if (K.offsetHeight > target && i - mulai >= minB) {
          for (var k = mulai; k <= i; k++) rows[k].hidden = true;
          rows[i].hidden = false; batas.push(i); mulai = i;
        }
      }
    }
    K.style.alignSelf = ""; if (L) L.style.alignSelf = "";
    var jml = batas.length, S = o.keadaan, kunci = o.kunci || "hal";
    if (S[kunci] == null) {
      var idx = o.awal ? o.awal(rows) : 0;
      S[kunci] = 0;
      for (i = 0; i < jml; i++) if (batas[i] <= idx) S[kunci] = i;
    }
    if (S[kunci] >= jml) S[kunci] = jml - 1;
    if (S[kunci] < 0) S[kunci] = 0;
    var h = S[kunci], dari = batas[h], ke = h + 1 < jml ? batas[h + 1] : rows.length;
    rows.forEach(function (r, n) { r.hidden = n < dari || n >= ke; });
    pg.hidden = jml < 2;
    pg.querySelector("[data-bagi-ket]").textContent = "Halaman " + (h + 1) + " dari " + jml + (rows.length ? " · " + (dari + 1) + "–" + ke + " dari " + rows.length : "");
    pg.querySelector('[data-bagi-arah="-1"]').disabled = h === 0;
    pg.querySelector('[data-bagi-arah="1"]').disabled = h >= jml - 1;
    // kartu yang lebih pendek ikut setinggi kartu sebelahnya
    if (berdampingan) {
      var hk = K.offsetHeight, hl = L.offsetHeight;
      if (hk < hl) K.style.minHeight = hl + "px"; else if (hl < hk) L.style.minHeight = hk + "px";
    }
    return true;
  }

  function pasang(o) {
    var K = o.kartu;
    if (!K) return;
    var pg = K.querySelector("[data-bagi-pager]");
    if (pg) {
      pg.onclick = function (ev) {
        var b = ev.target.closest("[data-bagi-arah]");
        if (!b || b.disabled) return;
        var arah = b.getAttribute("data-bagi-arah"), kunci = o.kunci || "hal";
        o.keadaan[kunci] = (o.keadaan[kunci] || 0) + (+arah);
        hitung(o);
        var f = pg.querySelector('[data-bagi-arah="' + arah + '"]');
        if (f && !f.disabled) f.focus(); else { var lain = pg.querySelector("[data-bagi-arah]:not([disabled])"); if (lain) lain.focus(); }
      };
    }
    hitung(o);
    var tunda;
    window.addEventListener("resize", function ukur() {
      if (!K.isConnected) { window.removeEventListener("resize", ukur); return; }
      clearTimeout(tunda); tunda = setTimeout(function () { hitung(o); }, 200);
    });
  }

  M.bagiHalaman = { pager: pager, pasang: pasang, hitung: hitung };
})();
