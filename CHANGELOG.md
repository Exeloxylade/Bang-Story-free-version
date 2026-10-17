# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan nomor versi mengikuti [Semantic Versioning](https://semver.org/lang/id/): **mayor** untuk perubahan yang merusak
data atau alur lama, **minor** untuk fitur baru, **patch** untuk perbaikan.

Cara menaikkan versi ada di [docs/pengembangan.md](docs/pengembangan.md#versi-dan-rilis).

## [Belum dirilis]

### Ditambahkan
- Jumlah gambar Flow paralel dapat diatur 1–8 (bawaan 2). Kegagalan verifikasi menjeda antrean yang belum mulai, dengan tombol lanjutkan di Storyboard. Job yang sedang berjalan tetap menyelesaikan permintaannya.
- Connector 1.1.4 membedakan kegagalan jaringan loader, pembatasan kebijakan halaman, API CAPTCHA yang tidak tersedia, dan penolakan token. Koneksi dan kredit yang berhasil belum membuktikan CAPTCHA siap.
- Kegagalan pairing dibedakan dari penolakan sesi Google, jaringan, atau penyimpanan lokal; pesan error tidak lagi dihapus oleh pemeriksaan akun berkala. Pendaftaran akun terverifikasi tidak menunggu kueri kredit atau pembuatan proyek.
- Pairing Flow Account Connector dari Chrome/Edge milik pengguna: login normal, kode sekali pakai, pembatalan dan reconnect terikat identitas, serta panduan pemasangan extension. Alur koneksi baru menggantikan popup login otomatis yang dapat ditolak Google.
- Integrasi bersama fork Flow2API: helper login berada di server dan registrasi sesi memakai endpoint admin khusus yang memverifikasi identitas akun Google sebelum menyimpan sesi.
- Pemasangan dan startup layanan Flow otomatis, serta pendaftaran sesi tanpa menyalin cookie. Akun dapat ditambah, dihubungkan ulang, atau dihapus dari Bang Story.
- Pengujian regresi untuk isolasi profil, duplikat akun, pembatalan, identitas login, penyaringan cookie, dan pendaftaran API lokal.
- Preset **Stickman minimalist**: karakter garis sederhana dengan wajah dan aksesori minimal, serta latar
  berwarna yang lebih sederhana.
- Pilihan Flow2API untuk gambar dan video, terpisah dari Higgsfield: alamat server, kunci API, daftar model
  langsung dari server, dan model custom.
- Flow2API lokal opsional di Pengaturan untuk Windows 64-bit: pemasangan Python, server dan browser otomatis,
  kontrol jalankan/hentikan, panel akun, panduan login Google Flow, dan pemeriksaan akun tanpa generasi media.
- Pilihan penyedia gambar/video bawaan untuk proyek baru. Proyek yang sudah ada bisa mengganti penyedia
  dan model di langkah Ide cerita.

### Catatan
- Flow2API memakai sesi akun dan kuota Google Flow pengguna. Pemeriksaan akun tidak memastikan bahwa
  generasi media akan berhasil; sesi, kuota, dan layanan Google tetap memengaruhi hasil.
- Perubahan Flow2API dan preset ditinjau pada kode; pengujian aplikasi dan build diserahkan kepada pengguna.


### Diperbaiki
- Pemasangan lokal dan tautan dokumentasi Flow2API memakai fork English milik Exeloxylade. Pasang ulang memperbarui kode server sambil menyimpan akun, cache, pengaturan, dan cadangan kode lama.
- Panduan akun Flow2API mengikuti panel Accounts → Add dan cookie Google/Flow lengkap, menggantikan petunjuk Session Token lama.
- Kurung penutup fungsi pemeriksaan kunci Flow2API yang hilang dan menyebabkan build gagal dengan `Unexpected "export"`.
- Kunci Gemini untuk penyusun cerita dan Gemini TTS disimpan terpisah. Mengubah atau menghapus satu kunci tidak
  lagi mengubah kunci lainnya; kunci lama disalin sekali untuk menjaga narasi saat aplikasi diperbarui.

## [1.0.0] - 2026-10-02

Rilis pertama Bang Story (sebelumnya bernama Studio Cerita).

### Alur produksi
- Empat langkah: **Ide cerita → Naskah → Storyboard → Editor**, tersimpan otomatis di database lokal.
- Penyusun cerita memakai Gemini, OpenRouter, Groq, atau endpoint custom yang kompatibel dengan OpenAI. Daftar
  modelnya diambil langsung dari penyedia.
- Naskah bisa diubah, ditambah, dihapus, dan diurutkan ulang. Narasi boleh memuat tag ekspresi suara.
- Rencana visual dibuat dari naskah final: prompt gambar berlabel (dunia dan era, aksi, baju per adegan, hal yang
  harus dihindari), pemeran beserta lembar karakter, gerak kamera, transisi, dan arahan gerak video.
- 14 model gambar dan 34 model video Higgsfield, dengan perkiraan kredit dari endpoint `estimate`. Resolusi video
  bisa dipilih per proyek.
- Narasi dibuat dalam satu rekaman utuh (Gemini TTS atau ElevenLabs), lalu dipotong otomatis per adegan.
- Caption akurat dengan Whisper lokal (mode DTW). Klip lama bisa disinkronkan ulang dari tab Caption.
- Panel Musik bisa membuat prompt musik latar untuk Suno atau AI musik lain.

### Editor
- Pratinjau langsung dengan gerak kamera, transisi, caption karaoke, musik latar, dan overlay (logo, watermark,
  teks) yang bisa digeser di pratinjau.
- Timeline seperti editor video:
  - tarik tepi klip untuk mengatur panjangnya (video tidak bisa melebihi panjang aslinya);
  - geser dan potong suara, caption, musik, dan overlay;
  - **Potong** (S atau Ctrl+B) dan **Hapus** (Delete);
  - snap ke playhead dan sambungan;
  - overlay bertumpuk di baris masing-masing.
- Transisi diatur per sambungan dari tombol di antara klip. Panelnya punya pratinjau yang diputar berulang, durasi
  0,2–2 detik, dan tombol terapkan ke semua.
- Gerak kamera bisa diatur untuk klip gambar maupun video. Pratinjaunya diputar tanpa menggeser playhead.
- Caption:
  - 4 gaya dan pilihan tanpa caption;
  - 15 font (4 tegas, 9 kartun/komik, 2 tulisan tangan/elegan) dengan contoh di daftar;
  - ukuran, posisi, warna, dan kotak latar rounded;
  - teksnya bisa diedit langsung dan tersimpan otomatis.
- Suara: volume per klip dan volume narasi. Musik: volume, otomatis mengecil saat narasi, dipotong, dan digeser.

### Ekspor
- MP4 dirender dengan FFmpeg di komputer pengguna. Hasilnya sama dengan pratinjau karena aturan gerak, transisi,
  caption, dan potongan suara dipakai bersama (`src/shared/`).
- Gerak kamera halus memakai filter `perspective`. Caption memakai libass dengan kotak rounded, dan ukurannya
  sama dengan pratinjau.
- Proyek bisa diekspor berulang kali setelah diedit.

### Lainnya
- Kunci API milik pengguna (BYOK), disimpan terenkripsi dengan DPAPI Windows (`safeStorage`).
- Halaman About menampilkan versi aplikasi, tautan ke channel Bang Tutorial, dan video tutorial.
- Salinan siap jalan dengan skrip START untuk Windows dan macOS.
- Dokumentasi pengembang: [AGENTS.md](AGENTS.md) dan folder [docs/](docs/README.md).
- Kode dirilis dengan [lisensi MIT](LICENSE). README dilengkapi badge dan screenshot.
- Installer Windows (`BangStory-Setup-1.0.0.exe`) dengan ikon dari logo Bang Story.

### Batasan yang diketahui
Lihat [docs/masalah-diketahui.md](docs/masalah-diketahui.md). Yang paling terasa:
- gerak kamera di atas video masih bergetar di pratinjau (hasil ekspor halus);
- belum ada undo/redo;
- Whisper dan installer baru tersedia untuk Windows.
