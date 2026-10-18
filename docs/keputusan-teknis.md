# Keputusan teknis

Catatan kenapa sesuatu dibuat begitu. Sebagian besar lahir dari bug nyata, jadi baca dulu sebelum mengubah
bagian terkait. Tambahkan entri baru di akhir setiap kali membuat keputusan penting.

### Narasi direkam satu kali utuh, lalu dipotong per adegan
TTS yang dipanggil per klip menghasilkan suara dan intonasi yang berbeda-beda. Satu rekaman utuh lalu dipotong
membuat suaranya konsisten. Jangan menambah tombol "buat suara" per klip.

### Whisper tanpa `--prompt`, dengan DTW
Naskah yang dikirim sebagai prompt membuat Whisper berhalusinasi: dalam uji coba, Whisper mengulang "tidak tidak
tidak..." puluhan kali. Caption klip 1 selesai 2 detik lebih cepat dari suaranya, dan kata-kata awal klip lain
tertumpuk di detik 0. Waktu per kata bawaan whisper.cpp juga kurang presisi. Dari tiga cara yang diuji,
`-nfa -dtw small` tanpa prompt paling akurat: caption hanya meleset sekitar 0,1–0,2 detik dari suara (diuji pada
proyek nyata). Ejaan caption tetap dari naskah (`align.ts`); dari Whisper hanya diambil waktunya.

### Potongan adegan mengikuti kata
Dengan Whisper, adegan dipotong di jeda antara kata terakhir satu adegan dan kata pertama adegan berikutnya
(`cutsFromWords`), jadi potongan tidak pernah jatuh di tengah kata. Tanpa waktu kata, `chooseCuts` memilih dari
jeda yang dideteksi FFmpeg. Batas adegan visual tidak menambahkan tag jeda otomatis. ElevenLabs
memakai waktu kata dari API-nya sendiri.

### Sorotan caption bertahan di jeda antar kata
Di jeda antar kata, sorotan tetap di kata terakhir yang sudah diucapkan (`captionAt`), sama seperti ekspor.
Dulu sorotan lompat ke kata terakhir baris lalu balik lagi, sehingga terlihat berkedip.

### Segmen ekspor dibulatkan ke frame + 2 frame cadangan
`xfade` menghentikan seluruh video kalau klip pertama habis sebelum offset transisi. Dengan transisi `cut`
(1 frame) dan durasi klip yang tidak pas di frame, gambar video pernah berhenti setelah klip 1 sementara audio
tetap jalan. `planSegments` membulatkan awal klip ke frame utuh dan menambah 2 frame cadangan.

### Gerak kamera di ekspor memakai filter `perspective`, bukan `zoompan`
`zoompan` membulatkan potongan gambar ke piksel bulat setiap frame, sehingga gerak lambat bergoyang 0,6–0,7 px
per frame (terlihat bergetar, terutama garis tipis). `perspective` (sense=source, cubic) bergerak pecahan piksel:
getarannya 0,02–0,16 px dengan kecepatan hampir sama. Gambar diproses di resolusi aslinya (1×–2× output) lalu
diperkecil, supaya tetap tajam. Catatan: penghitung frame `perspective` mulai dari 1, jadi rumusnya memakai `(on-1)`.

### Kotak caption rounded digambar sendiri
libass hanya bisa membuat kotak bersudut siku. Kotak rounded digambar sebagai drawing ASS di layer bawah teks.
Lebarnya dihitung dari metrik file font (`fontMetrics.ts`), dan baris dipecah dengan fungsi yang sama dengan
pratinjau (`layoutCaptionLines`).

### Ukuran caption memakai metrik `cell` per font
libass mengukur ukuran font dengan winAscent+winDescent, CSS dengan em. Tanpa konversi, caption di ekspor hanya
sekitar 57% ukuran pratinjau. Setiap font di `CAPTION_FONTS` punya nilai `cell` hasil pengukuran file TTF-nya.

### Pratinjau menjaga tiga klip tetap terpasang
Membuat elemen `<video>` baru setiap pindah klip sempat menampilkan frame pertama video (atau poster) sebelum
seek. Akibatnya ada kilasan di sambungan potongan dan di transisi. Klip sebelum/sekarang/sesudah selalu
terpasang dalam urutan timeline. Klip berikutnya menunggu di titik mulainya, dan langsung diputar tanpa seek
ulang (seek ulang menahan video sekitar 150 ms).

### Video overlay hardware dimatikan
Di Windows, Chromium menyerahkan video ke overlay hardware (DirectComposition) yang membulatkan posisi dan
ukuran ke piksel bulat. Gerak kamera di atas video jadi gemetar di pratinjau, padahal gambar halus.
Switch `disable-direct-composition-video-overlays` dan opasitas 0,999 untuk video yang bergerak menahan video
di jalur render biasa. (Pemilik aplikasi masih melihat getaran di pratinjau; lihat masalah-diketahui.md.)

### Suara milik klipnya ("klip tertaut")
Seperti suara bawaan klip video di editor lain: suara bisa dipotong dan digeser di dalam klip, dan terpotong di
akhir klip. Ini menjaga sinkron naskah per adegan dan rekam ulang narasi tetap sederhana.

### Potong klip ikut membelah suara dan naskah
Saat klip dibelah, file suara dipotong di jeda antar kata terdekat, dan teks narasinya dibagi
(`splitNarration`). Dengan begitu tiap bagian punya aset dan naskah yang cocok (tidak dianggap basi), dan bisa
direkam ulang sendiri. Bagian pertama diberi transisi `cut` agar sambungannya mulus.

### Panel Transisi, bukan popup
Popup di timeline menutupi pratinjau, padahal pengguna ingin melihat contoh transisinya. Tombol sambungan
membuka panel di kanan, lalu pratinjau memutar sambungan itu berulang-ulang (audition).

### Prompt visual berlabel dan baris Wardrobe
Model gambar tidak membaca naskah. Prompt yang kurang spesifik menghasilkan latar Bumi dan alien untuk cerita di
Mars, dan baju astronot di semua adegan. Setiap prompt kini menyebut dunia/era dengan jelas, orang disebut
"human", dan baju per adegan ditulis di baris `Wardrobe` (bawaan lembar karakter atau custom).

### Prompt video selalu melarang musik
Beberapa model video (Veo, Grok, MiniMax) membuat musik sendiri tanpa saklar. Setiap prompt diakhiri `NO_MUSIC`,
dan audio dimatikan lewat parameter kalau modelnya punya. Audio dari file video tidak pernah dipakai di ekspor.

### Kunci API dienkripsi safeStorage, kunci kripto dibuat saat startup
Kunci kriptografi `safeStorage` baru tertulis ke `Local State` sekitar 10 detik setelah dibuat. Membuatnya saat
startup (`warmUpEncryption`) mencegah kunci API tidak terbaca setelah aplikasi ditutup paksa.

### YouTube embed diberi Referer berisi ID aplikasi
Halaman dari `file://` tidak mengirim Referer, dan YouTube menolak embed tanpa identitas (Error 153). Header
ditambahkan hanya untuk `https://www.youtube.com/embed/*`.

### Kunci Gemini LLM dan TTS terpisah
Kedua formulir dulu menulis baris `gemini` yang sama, sehingga mengganti kunci narator juga mengganti kunci
penyusun cerita. TTS kini memakai `gemini-tts` untuk kunci, status tes, model, dan suara. Migrasi menyalin
blob terenkripsi lama sekali tanpa membuka kuncinya; setelah itu tidak ada fallback ke kunci LLM.

### Narasi bersih dan anggaran render
Instruksi narasi bersih dibagi oleh prompt naskah dan metadata gaya Gemini, bukan disisipkan sebagai teks yang dibacakan. Tag jeda tetap dipertahankan untuk pemotongan antar-adegan; audio lama perlu dibuat ulang.
Encoder GPU diuji dengan encode nyata, bukan hanya daftar encoder FFmpeg. Filter kamera/transisi/caption tetap sama dan memakai CPU. Anggaran thread dibagi antar-worker segmen, dengan batas RAM lebih ketat untuk 4K. Kegagalan inisialisasi GPU boleh mencoba CPU; kesalahan filter tidak disembunyikan.

### Kontinuitas narasi melintasi batas adegan (18 Oktober 2026)
Gemini dan ElevenLabs menerima teks adegan yang disambung dengan spasi biasa, bukan `<long pause>` atau paragraf baru pada setiap batas visual. Kata, tanda baca, dan tag jeda yang memang ditulis pengguna tetap dipertahankan. Larangan napas/desahan/bisikan tetap berlaku; metadata gaya meminta narasi berlanjut melintasi pergantian visual.
Potongan WAV memakai batas bersama dan durasi aslinya, termasuk adegan di bawah 1,5 detik. Memilih ulang audio bertanda `take` dari riwayat juga tidak menambahkan ekor 400 ms. Audio mandiri lama mempertahankan perilaku sebelumnya. Tidak ada migrasi atau pemotongan otomatis pada rekaman/proyek yang sudah ada; rekaman dengan jeda otomatis lama harus dibuat ulang jika ingin menghilangkannya.
Uji tanpa API menjalankan FFmpeg asli pada satu WAV lalu menyambung semua hasil: sampel PCM identik dengan sumber, jeda alami tetap ada, naskah dan pemetaan caption per adegan terjaga. Aturan pratinjau/ekspor serta pemisahan adegan untuk gambar/video tidak diubah.

### Durasi Flow mengikuti narasi per adegan (18 Oktober 2026)
Pemilihan model Flow menyimpan keluarga/varian dasar. Saat job video mulai, durasi berasal dari `voiceSpan(...).playMs` pada audio adegan yang sudah dipotong; bila tidak ada audio yang dimainkan, gunakan durasi adegan. Daftar `/v1/models` dibaca sebelum submit, lalu dipilih alias berdurasi eksplisit yang paling dekat dalam keluarga, mode i2v/Omni, dan rasio yang sama. Jika sama dekat, pilih durasi lebih panjang. Tidak mengganti keluarga atau mengarang alias yang tidak diiklankan; server yang hanya menawarkan varian tetap mempertahankan varian itu.
4,5 detik dapat memilih 4 detik, 5,5 memilih 6, dan 7 memilih 8. Durasi di luar rentang memakai pilihan terdekat yang tersedia. Ini bukan pengubahan kecepatan atau pemotongan otomatis baru; panjang timeline/voiceover tetap. Model aktual disimpan pada aset hasil. Higgsfield dan permintaan gambar tidak memakai resolver ini.
Alias publik i2v Veo 8 detik menyalin konfigurasi backend yang sudah ada, termasuk model key, batas referensi, dan flag akses. Tidak ada CAPTCHA atau routing akun yang berubah.

### ScenePulse sebagai aset turunan dan track SFX terpisah (18 Oktober 2026)
Motion + SFX bersifat opsional di `editor_json`; tidak menambah kolom wajib atau menimpa tautan aset klip. Bundle skill dipin dan diperiksa hash-nya, lalu instruksi aktif dimasukkan ke LLM Bang Story. Hasil JSON dibatasi katalog, waktu, kepadatan SFX, area caption dan aturan kamera bersama. Kode HTML bebas dari LLM tidak dijalankan.
HyperFrames menerima video dasar dari renderer segmen asli, sehingga crop/kamera lama tetap ada. Pemilih aset bersama memastikan hasil yang sama dipakai di preview dan ekspor, tanpa kamera kedua di atas hasil yang sudah dipanggang. SFX berada di WAV sendiri karena video adegan sengaja tidak membawa audio; preview dan ekspor sama-sama memainkan WAV itu pada awal adegan. Narasi, caption, musik dan transisi tetap di pipeline asli.
Signature sumber membuat hasil lama tidak dipakai setelah perubahan media/timing/teks/gaya. Ekspor menolak efek aktif yang belum sesuai. Batch baru dipublikasikan secara transaksional setelah semua render berhasil dan sumber masih cocok. Runtime headless punya profil terpisah dan tidak memakai akun Google pengguna. Detail ada di `scenepulse.md`.
