/* Menu Laporan harian — laporan TERBIT (publik, hanya baca).
   Data: data/<tahun>/laporan/terbit/indeks.json + YYYY-MM-DD.json, ditulis Apps Script saat laporan diterbitkan
   (pubLaporanJson_ di monev-gas/gas/Laporan.gs). Laporan terbit dikunci; menyusun dan memverifikasi ada di halaman kerja.
   Dokumen (A3, 16:9, PNG, PPTX, cetak) digambar assets/js/laporan-dokumen.js, sama persis dengan halaman kerja.
   Mockup: LaporanHarian, LaporanMenteri, LaporanNarasi. */
(function () {
  "use strict";

  var e = function (s) { return Monev.esc(s); };
  var F = function () { return Monev.format; };
  var D = function () { return window.LaporanDokumen; };
  var LOGO = "assets/ikon/kementan.png";
  var STATE = { tanggal: "", butirHal: 0 };

  function muatIndeks(ta) { return Monev.data.muatTahun("laporan/terbit/indeks.json", ta); }
  function muatLaporan(ta, file) { return Monev.data.muatTahun("laporan/terbit/" + file, ta); }

  function tombolMasuk(label) {
    var url = Monev.urlMasuk("laporan");
    return url
      ? '<a class="tombol tombol-sekunder" href="' + e(url) + '" rel="noopener">' + e(label) + "</a>"
      : '<span class="tombol tombol-sekunder" role="link" aria-disabled="true" title="Halaman kerja belum tersedia (Tahap 4)">' + e(label) + "</span>";
  }
  function seksi(judul, isi, kanan) {
    return '<section class="seksi"><div class="seksi-kepala"><h2>' + e(judul) + "</h2>" + (kanan || "") + "</div>" + isi + "</section>";
  }
  function chipHasil(h) {
    var k = { LOLOS: "ok", PERINGATAN: "warn", INFO: "info" }[h] || "neutral";
    return '<span class="chip chip-' + k + '">' + e(h) + "</span>";
  }

  /* ---------- bilah alat ---------- */
  function bilah(ind, lap, tab) {
    var opsi = ind.map(function (x) {
      return '<option value="' + e(x.tanggal) + '"' + (x.tanggal === lap.tanggal_laporan ? " selected" : "") + ">" +
        e(F().tanggal(x.tanggal)) + (x.diterbitkan ? ", terbit " + e(F().jam(x.diterbitkan)) : "") + "</option>";
    }).join("");
    var dok = tab !== "narasi";
    return '<section class="seksi bilah-laporan">' +
      '<div class="baris-alat">' +
      '<label class="label-pilih" for="lap-tanggal">Tanggal laporan terbit<select id="lap-tanggal" data-lap-tanggal>' + opsi + "</select></label>" +
      '<p class="paragraf-kecil">' + (lap.pembanding ? "Kenaikan dibanding laporan terbit " + e(F().tanggal(lap.pembanding)) + "." : "Belum ada laporan pembanding.") +
      ' <span class="chip chip-ok">Terbit, terkunci</span></p></div>' +
      '<div class="baris-alat">' +
      (dok ? '<button type="button" class="tombol tombol-utama" data-lap-aksi="png">Unduh PNG</button>' +
        '<button type="button" class="tombol tombol-ppt" data-lap-aksi="pptx">Unduh PPTX</button>' +
        '<button type="button" class="tombol tombol-sekunder" data-lap-aksi="cetak">Cetak / simpan PDF</button>' : "") +
      tombolMasuk("Susun dan verifikasi laporan") +
      '<span class="catatan" id="lap-pesan" role="status"></span></div></section>';
  }

  /* ---------- panel samping ---------- */
  function panelStatus(lap) {
    var s = lap.sumber || {}, P = lap.pemeriksaan || [];
    var war = P.filter(function (c) { return c.hasil === "PERINGATAN"; }).length;
    var koreksi = [];
    (lap.komoditas || []).forEach(function (k) {
      (k.koreksi || []).forEach(function (c) {
        koreksi.push(k.nama + ": " + c.kolom.replace(/_/g, " ") + " Sisbun " + D().nf(c.nilai_sisbun) + ", dipakai " + D().nf(c.nilai_dipakai) + " — " + c.alasan);
      });
      if (k.alasan) koreksi.push(k.nama + ": " + k.alasan);
    });
    var isi =
      '<div class="kotak-status"><div class="kotak-status-kepala"><strong>Realisasi per unit kerja</strong>' +
        (war ? "" : '<span class="chip chip-ok">Terverifikasi</span>') + "</div>" +
        '<span class="catatan">Dari menu Anggaran · MyIntress ' + e(s.myintress_unduh ? F().waktu(s.myintress_unduh) : "–") + "</span>" +
        '<span class="paragraf-kecil">Angka sama dengan slide 5 paparan realisasi.</span></div>' +
      '<div class="kotak-status"><div class="kotak-status-kepala"><strong>Perbenihan dan tanam</strong>' +
        (koreksi.length ? '<span class="chip chip-warn">' + koreksi.length + " catatan</span>" : '<span class="chip chip-ok">Sesuai Sisbun</span>') + "</div>" +
        '<span class="catatan">Sisbun per ' + e(s.sisbun_per ? F().tanggal(s.sisbun_per) : "–") + (s.sisbun_ditarik ? ", ditarik " + e(F().jam(s.sisbun_ditarik)) : "") + "</span>" +
        (koreksi.length ? '<ul class="daftar-catatan">' + koreksi.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      (P.length ? '<details class="rincian-periksa"><summary>Pemeriksaan otomatis (' + P.length + ")</summary><ul>" + P.map(function (c) {
        return "<li>" + chipHasil(c.hasil) + ' <span class="mono">' + e(c.kode) + "</span> " + e(c.judul) +
          ((c.rincian || []).length ? '<span class="catatan">' + e(c.rincian.join(" ")) + "</span>" : "") + "</li>";
      }).join("") + "</ul></details>" : "") +
      (lap.catatan_terbit ? '<p class="paragraf-kecil"><strong>Catatan penerbitan:</strong> ' + e(lap.catatan_terbit) + "</p>" : "") +
      '<p class="catatan">Diterbitkan ' + e(lap.diterbitkan ? F().waktu(lap.diterbitkan) : "–") + ". Laporan terbit dikunci sebagai pembanding Narasi PM esok hari.</p>";
    return seksi("Status data", isi);
  }
  function panelKenaikan(lap) {
    var bag = [], cur = null;
    String(lap.narasi || "").split("\n").forEach(function (x) {
      if (/^Perkembangan|^Realisasi Tanam/.test(x)) { cur = { judul: x, isi: [] }; bag.push(cur); }
      else if (cur && /^\d+\. /.test(x)) cur.isi.push(x.replace(/^\d+\. /, ""));
    });
    if (!lap.pembanding || !bag.length) return seksi("Kenaikan", '<p class="paragraf-kecil">Belum ada laporan pembanding.</p>');
    return seksi("Kenaikan dibanding " + F().tanggal(lap.pembanding), bag.map(function (b) {
      return '<div class="butir"><strong>' + e(b.judul) + "</strong><span>" + (b.isi.length ? b.isi.map(e).join("<br>") : "Belum ada kenaikan") + "</span></div>";
    }).join("") + '<a class="tautan-kecil" href="#laporan-narasi">Teks lengkap ada di tab Narasi PM, siap disalin ke WhatsApp.</a>');
  }
  function panelKeterangan(lap) {
    return seksi("Keterangan per komoditas", (lap.komoditas || []).map(function (k) {
      return '<div class="butir" data-butir><strong>' + e(k.nama) + "</strong><span>" + e(k.keterangan || "–") + "</span></div>";
    }).join("") +
      '<div class="pager-akun" data-pager-butir hidden><button type="button" class="tombol tombol-sekunder tombol-kecil" data-butir-hal="-1">‹ Sebelumnya</button>' +
      '<span aria-live="polite" data-butir-ket></span><button type="button" class="tombol tombol-sekunder tombol-kecil" data-butir-hal="1">Berikutnya ›</button></div>' +
      '<p class="catatan">Keterangan disusun otomatis dari angka Sisbun dan bisa diubah operator sebelum laporan diterbitkan.</p>');
  }

  /*
   * Kolom samping setinggi pratinjau dokumen: keterangan per komoditas dibagi per halaman supaya
   * kolom samping tidak lebih tinggi dari pratinjau. Bila bertumpuk (layar sempit), 3 komoditas per halaman.
   */
  var BUTIR_PER_HAL = 3;
  function halamanButir(el) {
    var A = el.querySelector(".kolom-samping"), P = el.querySelector(".lap-pratinjau");
    if (!A || !P) return;
    var rows = Array.prototype.slice.call(A.querySelectorAll("[data-butir]"));
    var pager = A.querySelector("[data-pager-butir]");
    if (!rows.length || !pager) return;
    var batas = [0], i;
    A.style.minHeight = "";
    A.style.alignSelf = "start"; P.style.alignSelf = "start";
    var berdampingan = Math.abs(A.offsetTop - P.offsetTop) < 4;
    if (!berdampingan) {
      for (i = BUTIR_PER_HAL; i < rows.length; i += BUTIR_PER_HAL) batas.push(i);
    } else {
      pager.hidden = false;
      rows.forEach(function (r) { r.hidden = true; });
      var target = P.offsetHeight, mulai = 0;
      for (i = 0; i < rows.length; i++) {
        rows[i].hidden = false;
        if (A.offsetHeight > target && i > mulai) {
          for (var k = mulai; k <= i; k++) rows[k].hidden = true;
          rows[i].hidden = false; batas.push(i); mulai = i;
        }
      }
    }
    A.style.alignSelf = ""; P.style.alignSelf = "";
    if (berdampingan) A.style.minHeight = P.offsetHeight + "px";
    var jml = batas.length;
    if (STATE.butirHal >= jml) STATE.butirHal = jml - 1;
    if (STATE.butirHal < 0) STATE.butirHal = 0;
    var dari = batas[STATE.butirHal], ke = STATE.butirHal + 1 < jml ? batas[STATE.butirHal + 1] : rows.length;
    rows.forEach(function (r, n) { r.hidden = n < dari || n >= ke; });
    pager.hidden = jml < 2;
    A.querySelector("[data-butir-ket]").textContent = "Halaman " + (STATE.butirHal + 1) + " dari " + jml;
    pager.querySelector('[data-butir-hal="-1"]').disabled = STATE.butirHal === 0;
    pager.querySelector('[data-butir-hal="1"]').disabled = STATE.butirHal >= jml - 1;
  }
  function panelAturan() {
    return seksi("Aturan penyusunan", '<ul class="daftar-titik">' + [
      "Tahap terakhir yang sudah berjalan disebut lebih dulu (persemaian, salur, tanam).",
      "Provinsi dengan CPCL atau kontrak di bawah 80% disebut sebagai penyebab keterlambatan.",
      "Bila angka turun dari data pembanding, keterangan memakai catatan koreksi dari verifikasi.",
      "Keterangan yang diubah manual tidak ditimpa saat data diperbarui, kecuali tombol \"Susun ulang\" ditekan."
    ].map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>");
  }
  function panelCara(lap) {
    return seksi("Cara penyusunan", '<ul class="daftar-titik">' + [
      "Pembanding: laporan terbit terakhir sebelum tanggal laporan" + (lap.pembanding ? " (" + F().tanggal(lap.pembanding) + ")" : "") + ".",
      "Tiga bagian tetap: Perkembangan Kontrak Benih, Perkembangan CPCL, Realisasi Tanam. Hanya item yang naik yang dimunculkan.",
      "Kontrak dan tanam ditulis dalam batang/mata disertai \"atau equivalent dengan X ha\"; CPCL ditulis dalam ha saja.",
      "Angka diambil dari data yang sudah diverifikasi, termasuk koreksi yang disimpan di layar verifikasi.",
      "Pembuka dan penutup mengikuti format baku laporan PM."
    ].map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>");
  }
  function panelKonversi() {
    var K = D().KONVERSI;
    return seksi("Konversi ke hektar", '<table class="tabel tabel-konversi"><tbody>' + Object.keys(K).map(function (n) {
      return "<tr><td>" + e(n) + '</td><td class="angka">' + e(D().nf(K[n].per) + " " + K[n].satuan + "/ha") + "</td></tr>";
    }).join("") + "</tbody></table>");
  }

  /* ---------- isi tab ---------- */
  function gambar(el, ind, lap, tab) {
    var html = bilah(ind, lap, tab);
    if (tab === "narasi") {
      html += '<div class="grid-laporan"><section class="seksi"><div class="seksi-kepala"><h2>Narasi laporan harian PM</h2>' +
        '<div class="baris-alat"><button type="button" class="tombol tombol-utama" data-lap-aksi="salin">Salin teks</button>' +
        '<button type="button" class="tombol tombol-sekunder" data-lap-aksi="txt">Unduh .txt</button></div></div>' +
        '<p class="catatan">' + (lap.pembanding ? "Dibandingkan terhadap laporan terbit " + e(F().tanggal(lap.pembanding)) + ". " : "") +
        "Hanya item yang naik yang dimunculkan; item tetap atau turun diabaikan.</p>" +
        '<label class="sr-only" for="lap-narasi">Teks narasi</label><textarea id="lap-narasi" class="area-narasi" rows="18">' + e(lap.narasi || "") + "</textarea>" +
        '<p class="catatan">Teks bisa diubah sebelum disalin ke WhatsApp atau surel. Perubahan di sini tidak disimpan dan tidak mengubah laporan terbit.</p></section>' +
        '<aside class="kolom-samping">' + panelCara(lap) + panelKonversi() + "</aside></div>";
    } else {
      var label = tab === "menteri" ? "Pratinjau Laporan Menteri 16:9" : "Pratinjau laporan internal A3";
      html += '<div class="grid-laporan"><section class="lap-pratinjau" aria-label="' + e(label) + '"><div class="lap-skala" id="lap-skala">' +
        (tab === "menteri" ? D().htmlMenteri(lap, { logo: LOGO }) : D().htmlA3(lap, { logo: LOGO })) + "</div></section>" +
        '<aside class="kolom-samping">' + (tab === "menteri" ? panelKeterangan(lap) : panelStatus(lap) + panelKenaikan(lap)) + "</aside></div>" +
        (tab === "menteri" ? panelAturan() : "");
    }
    el.innerHTML = html;
    skalakan(el);
  }

  /* Pratinjau: lembar ukuran asli diperkecil mengikuti lebar wadah. */
  function skalakan(el) {
    var sk = el.querySelector("#lap-skala");
    if (!sk) return;
    var lembar = sk.firstChild, wadah = sk.parentNode;
    var atur = function () {
      if (!lembar.isConnected) return;
      var gaya = getComputedStyle(wadah);
      var lebar = wadah.clientWidth - parseFloat(gaya.paddingLeft) - parseFloat(gaya.paddingRight);
      var s = Math.min(1, lebar / lembar.offsetWidth);
      sk.style.transform = "scale(" + s + ")";
      sk.style.width = lembar.offsetWidth + "px";
      sk.style.height = lembar.offsetHeight + "px";
      sk.style.marginBottom = (lembar.offsetHeight * (s - 1)) + "px";
      sk.style.marginRight = (lembar.offsetWidth * (s - 1)) + "px";
      halamanButir(el);
    };
    atur();
    if (window.ResizeObserver) new ResizeObserver(atur).observe(wadah);
    else window.addEventListener("resize", atur);
  }

  function pesan(el, t) { var p = el.querySelector("#lap-pesan"); if (p) p.textContent = t || ""; }

  function isi(el, r) {
    var ta = Monev.tahun.aktif(), tab = r.sub && r.sub.id ? r.sub.id : "a3";
    D().pasangGaya();
    el.innerHTML = Monev.data.tampil.memuat(4);
    muatIndeks(ta).then(function (j) {
      var ind = (j && j.laporan || []).slice().sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
      if (!ind.length) throw { status: 404 };
      var pilih = ind.filter(function (x) { return x.tanggal === STATE.tanggal; })[0] || ind[0];
      STATE.tanggal = pilih.tanggal;
      return muatLaporan(ta, pilih.file || pilih.tanggal + ".json").then(function (lap) {
        if (!el.isConnected) return;
        var ctx = { ind: ind, lap: lap };
        gambar(el, ind, lap, tab);
        pasang(el, ctx, ta, tab);
      });
    }).catch(function (err) {
      if (!el.isConnected) return;
      if (err && err.status === 404) {
        el.innerHTML = Monev.data.tampil.kosong("Belum ada laporan terbit TA " + ta,
          "Laporan harian tampil di sini setelah operator menyusun, memverifikasi, dan menerbitkannya dari halaman kerja.",
          null, "Laporan yang sudah terbit dikunci dan menjadi pembanding Narasi PM esok hari.");
      } else {
        el.innerHTML = Monev.data.tampil.gagal("Laporan harian gagal dimuat", "");
      }
    });
  }

  function pasang(el, ctx, ta, tab) {
    el.addEventListener("change", function (ev) {
      if (!ev.target.hasAttribute("data-lap-tanggal")) return;
      var x = ctx.ind.filter(function (i) { return i.tanggal === ev.target.value; })[0];
      if (!x) return;
      STATE.tanggal = x.tanggal; STATE.butirHal = 0;
      pesan(el, "Memuat laporan " + F().tanggal(x.tanggal) + "…");
      muatLaporan(ta, x.file || x.tanggal + ".json").then(function (lap) {
        ctx.lap = lap; gambar(el, ctx.ind, lap, tab);
        var s = el.querySelector("#lap-tanggal"); if (s) s.focus();
      }).catch(function () { pesan(el, "Laporan " + F().tanggal(x.tanggal) + " gagal dimuat."); });
    });
    el.addEventListener("click", function (ev) {
      var hb = ev.target.closest("[data-butir-hal]");
      if (hb && el.contains(hb)) {
        var arah = hb.getAttribute("data-butir-hal");
        STATE.butirHal += +arah; halamanButir(el);
        var fb = el.querySelector('[data-butir-hal="' + arah + '"]');
        if (fb && !fb.disabled) fb.focus(); else { var lb = el.querySelector("[data-butir-hal]:not([disabled])"); if (lb) lb.focus(); }
        return;
      }
      var t = ev.target.closest("[data-lap-aksi]");
      if (!t || !el.contains(t)) return;
      var aksi = t.getAttribute("data-lap-aksi"), jenis = tab === "menteri" ? "menteri" : "a3", lap = ctx.lap;
      if (aksi === "png") {
        pesan(el, "Menyiapkan PNG…");
        D().unduhPNG(jenis, lap, { logo: LOGO }).then(function () { pesan(el, "PNG diunduh."); }, function (x) { pesan(el, x.message || "PNG gagal dibuat."); });
      } else if (aksi === "pptx") {
        pesan(el, "Menyiapkan PPTX…");
        D().keDataURL(LOGO).then(function (logo) { return D().unduhPPTX(jenis, lap, logo); })
          .then(function () { pesan(el, "PPTX diunduh."); }, function (x) { pesan(el, x.message || "PPTX gagal dibuat."); });
      } else if (aksi === "cetak") {
        D().cetak(jenis, lap, { logo: LOGO });
      } else if (aksi === "salin") {
        var ta2 = el.querySelector("#lap-narasi");
        var ok = function () { pesan(el, "Teks disalin ke papan klip."); };
        if (navigator.clipboard) navigator.clipboard.writeText(ta2.value).then(ok, function () { ta2.select(); document.execCommand("copy"); ok(); });
        else { ta2.select(); document.execCommand("copy"); ok(); }
      } else if (aksi === "txt") {
        var b = new Blob([el.querySelector("#lap-narasi").value], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(b); a.download = "narasi-laporan-PM-" + lap.tanggal_laporan + ".txt";
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      }
    });
  }

  Monev.menu = Monev.menu || {};
  Monev.menu.laporan = { isi: isi };
})();
