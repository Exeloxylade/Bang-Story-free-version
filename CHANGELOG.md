# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan nomor versi mengikuti [Semantic Versioning](https://semver.org/lang/id/): **mayor** untuk perubahan yang merusak
data atau alur lama, **minor** untuk fitur baru, **patch** untuk perbaikan.

Cara menaikkan versi ada di [docs/pengembangan.md](docs/pengembangan.md#versi-dan-rilis).

## [Belum dirilis]

### Ditambahkan
- Narasi mengalir antar adegan: tidak menyisipkan long pause/paragraf otomatis, tetap mempertahankan jeda yang ditulis pengguna dan larangan napas/desahan. Potongan pendek mengikuti durasi audio asli; pemilihan ulang audio satu take tidak menambah ekor 400 ms. Berlaku saat membuat narasi baru; rekaman lama tetap tersimpan.
- Connector 1.1.8 mempertahankan selector akun dari URL atau RPC asli pada sesi halaman yang sama, dan membedakan kegagalan jaringan/HTTP. Verifikasi kredit akun paired memakai satu permintaan; pairing yang tersimpan tidak dihapus ketika pengecekan gagal. Bang Story menghapus kode yang sudah dipakai dan menampilkan alasan gagal kredit tanpa menunggu berulang.
- Pembacaan video Flow mendukung state numerik pada record baru dan signed URL tanpa `/video/`. Poster dipisahkan dari video; state selesai yang belum punya URL tetap dipolling sampai hasil siap. Tes mencakup pengiriman hasil ke unduhan Bang Story.
- Connector 1.1.7 memperbaiki izin route lookup hasil video dan memilih ulang tab akun yang responsif pada setiap permintaan. Timeout tidak mengulang submit otomatis; kegagalan verifikasi tab ditampilkan jelas dan menghentikan antrean yang belum mulai. Reload extension dan refresh studio Flow setelah update; pairing tetap tersimpan.
- Pembaruan Flow2API memvalidasi respons submit video, membaca status gagal/sukses eksplisit, dan tidak lagi menganggap respons polling tak dikenal sebagai Active. Dashboard menampilkan status tak dikenal, waktu tunggu, serta batas timeout; tidak memakai persentase render buatan saat menunggu video.
- Pilihan Asli/Kustom terpisah untuk instruksi naskah, storyboard, dan setiap gaya visual. Beralih ke Asli mempertahankan teks kustom. Prompt gambar dan instruksi karakter reference sheet dapat diedit per gaya; planner storyboard menerima batasan gaya yang sama dengan generator gambar.
- Pengaturan lanjutan untuk mengedit instruksi kreatif naskah/hook dan storyboard/karakter, dengan simpan terpisah serta pulihkan bawaan. Berlaku untuk generasi berikutnya di semua proyek; format keluaran, konteks proyek, dan narasi dengan jeda hening tetap disertakan.
- Template narasi Gemini memakai jeda hening tanpa napas, desahan, atau bisikan; tag efek vokal dari naskah lama dibersihkan saat membuat audio baru.
- Ekspor dapat memilih CPU, AMD AMF, NVIDIA NVENC, Intel Quick Sync, atau otomatis. Mode Ringan, Seimbang, dan Maksimal mengatur anggaran thread dan jumlah klip yang dirender bersamaan. GPU diuji dengan encoding singkat dan ada fallback CPU untuk kegagalan inisialisasi.
- Flow2API menyertakan fallback upstream untuk penolakan video `code=[5]` pada model relaxed: coba sekali model standar dengan durasi dan frame masukan yang sama. Tidak mengulang penolakan aktivitas tidak biasa atau pengiriman dengan hasil tidak pasti.
- Connector 1.1.6 memakai fungsi CAPTCHA yang disimpan Flow saat startup, mengikuti jalur pada repo asli. Setelah update, reload extension lalu refresh tab Flow yang sudah terbuka sekali; tidak perlu pairing ulang. Upload referensi kini menerima action `UPLOAD_IMAGE`. Penerimaan Google tetap memerlukan verifikasi langsung.
- Penolakan Google `PUBLIC_ERROR_UNUSUAL_ACTIVITY` kini menampilkan alasan yang jelas dan membatalkan pekerjaan Flow yang belum dimulai, sehingga sisa batch tidak terus dikirim setelah penolakan. Ini tidak menghapus pembatasan dari Google.
- Jumlah gambar Flow paralel dapat diatur 1–8 (bawaan 2). Kegagalan verifikasi membatalkan pekerjaan yang belum mulai, tanpa halaman atau tombol lanjutkan tambahan. Setelah diperbaiki, gunakan Generate seperti biasa. Job yang sedang berjalan tetap menyelesaikan permintaannya.
- Connector 1.1.5 memakai bootstrap Google `trustedtypes=true` agar skrip CAPTCHA tahap kedua kompatibel dengan Trusted Types, tanpa mengubah kebijakan halaman.
- Connector membedakan kegagalan jaringan loader, pembatasan kebijakan halaman, API CAPTCHA yang tidak tersedia, dan penolakan token. Koneksi dan kredit yang berhasil belum membuktikan CAPTCHA siap.
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
