# Motion + SFX dengan ScenePulse

ScenePulse adalah proyek pendamping Exeloxylade. Bang Story tetap karya asli Bang Tutorial; panduan Bang Motion yang ikut dibundel juga karya Bang Tutorial (MIT).

## Memakai fitur

1. Selesaikan gambar/video dan narasi, lalu buka **Editor → Efek**.
2. Nyalakan **Motion + SFX**. Pilih gerak/grafis, efek suara, atau keduanya.
3. Pilih gaya penyuntingan dan resolusi hasil efek (720p atau 1080p). Gaya penyuntingan mengatur energi, warna sorotan, kepadatan dan volume SFX; gaya ilustrasi proyek tetap menjadi konteks visual.
4. Klik **Tambahkan / perbarui efek**. Bang Story memakai LLM yang dipilih di Pengaturan untuk membuat rencana. Saat gerak pertama kali dipakai, runtime render diunduh otomatis. Tombol **Siapkan render sekali** tersedia bila ingin memasangnya lebih dulu.
5. Dengarkan pratinjau, lihat baris SFX di timeline, lalu ekspor seperti biasa. Tombol **Buat ulang efek adegan terpilih** membuat pilihan AI baru untuk satu adegan. Setelah semua sesuai, tombol utama dapat membuat ulang semua efek.

Saklar utama mengembalikan media asli saat dimatikan. Saklar gerak dan SFX bisa diubah terpisah. Aset asli, naskah, durasi, pemotongan narasi, caption, musik dan transisi tetap dimiliki Bang Story. Efek memakai aset yang sudah ada; pipeline ini tidak memanggil ulang generator gambar/video/TTS.

SFX saja memakai FFmpeg bawaan tanpa runtime browser. Gerak memakai HyperFrames headless dengan satu worker dan browser terpisah yang tidak membaca profil/login Chrome atau Edge kamu. Resolusi hasil gerak tersimpan pada aset; ekspor akhir menskalakannya mengikuti pilihan ekspor.

## Skill ikut dibawa

Paket lengkap ScenePulse v0.3.0 ada di `resources/scenepulse/skill/`, termasuk `SKILL.md`, panduan, skrip portabel, enam gaya penyuntingan, katalog kecil delapan suara CC0, lisensi sumber, dan panduan Bang Motion. `resources/scenepulse/ORIGIN.json` mencatat pin sumber serta hash setiap berkas. Paket installer menyalinnya ke folder resources juga.

Adapter aplikasi benar-benar membaca `SKILL.md`, arah kreatif, format rencana, panduan anti-slide Bang Motion, gaya aktif dan katalog suara sebelum memanggil LLM Bang Story. Skill memberi instruksi dan sumber daya; ia tidak melatih bobot model atau membutuhkan layanan LLM tambahan. Tidak ada kunci API yang disalin ke skill atau hasil render.

Eksekusi di dalam aplikasi memakai **rencana JSON terbatas**: lima pilihan kamera (termasuk diam), kotak sorotan/garis bawah/bingkai dengan fade, dan enam peran SFX. Grafis/kamera dijalankan sebagai komposisi native HyperFrames. Ini belum merupakan generator kode HTML bebas, animasi karakter terpisah, atau pelacakan objek otomatis. Panduan authoring yang lebih kaya tetap ikut tersedia untuk pengembangan berikutnya.

## Penyimpanan dan konsistensi

- Pengaturan opsional tersimpan di `Project.editor.scenePulse`; proyek lama tetap nonaktif dan tidak memerlukan migrasi kolom klip.
- Hasil adalah aset turunan `provider: scenepulse`, dengan metadata versi skill, rencana dan signature sumber. Tautan gambar/video/narasi asli tidak ditimpa.
- Signature mencakup sumber media, trim video, durasi, teks konteks, trim/penempatan suara, kamera, rasio dan gaya. Perubahan tersebut membuat hasil lama tidak dipakai. Ekspor meminta pembaruan bila efek aktif belum sesuai.
- Pratinjau dan ekspor memakai pemilih aset serta aturan validasi yang sama di `src/shared/scenePulse.ts`. Kamera asli dipanggang ke video dasar lewat renderer segmen Bang Story; hasil efek tidak diberi kamera itu untuk kedua kalinya.
- SFX dirender sebagai WAV terpisah dengan posisi/gain/fade tervalidasi. Pratinjau memutarnya bersama narasi; ekspor mencampurnya setelah musik/ducking. Audio di video adegan tetap dimatikan, sehingga suara efek tidak tergandakan.
- Setiap batch dipublikasikan setelah semua hasil berhasil dan sumber masih cocok. Pembatalan menghentikan proses render khusus beserta turunannya; aset asli tidak disentuh. Perubahan media/timing selama proses meminta pembuatan ulang.

## Pengembangan dan pengujian

`node scripts/sync-scenepulse.mjs PATH_SKILL` memperbarui bundle dari skill ScenePulse yang ditinjau. Tinjau versi/pin `ORIGIN.json`, perbarui `SCENEPULSE_VERSION` ketika kontrak berubah, lalu jalankan tes. Byte asli disimpan lewat `.gitattributes`; jangan merapikan berkas vendor tanpa memperbarui provenance.

```text
npm run typecheck
npm run build
npm run test:effects
```

`tests/scenepulse-harness.cjs` menjalankan Electron sungguhan dengan data sementara, LLM mock lokal, FFmpeg asli dan HyperFrames asli. Set `STUDIO_SCENEPULSE_BROWSER` ke Chrome headless shell khusus yang sudah tersedia, lalu jalankan `node tests/scenepulse-harness.cjs`. Variabel ini hanya berlaku di build pengembangan. Harness memakai jendela tersembunyi, mengambil screenshot, membandingkan data asli dan audio ekspor, memeriksa tombol nonaktif/cache, serta memastikan efek basi ditolak. Tidak ada akun atau API berbayar yang dipakai dalam pengujian ini.
