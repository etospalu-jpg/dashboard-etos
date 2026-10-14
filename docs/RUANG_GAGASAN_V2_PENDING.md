# RUANG GAGASAN V2 — Siap ditinjau, BELUM DEPLOY

Status: **implementasi disiapkan sebagai Git tree/commit tanpa memperbarui branch atau deployment Vercel**. Tidak ada migrasi database dan tidak ada perubahan data produksi.

## Pengalaman publik
- URL portal: `https://dashboard.etosidpalu.com/gagasan.html`
- Saat dibuka tanpa login, pengunjung langsung melihat beranda, tulisan terbaru, foto sampul, pencarian, kategori, penulis, tanggal dan tombol berbagi.
- Tombol Masuk Penulis membuka dialog login, tidak menutupi laman eksplorasi secara default.
- Karya Saya, Tulis Karya, mengubah atau menghapus artikel hanya untuk Awardee yang login menggunakan sesi READMAP existing.
- Kartu artikel menggunakan alamat `https://dashboard.etosidpalu.com/tulisan/{uuid}-{slug}`; proxy Vercel dashboard ke pembaca SSR untuk WhatsApp Open Graph.
- Artikel langsung terbit tanpa kurasi; pengelola dapat memperbarui maupun menyembunyikan dari laporan Superadmin.
- Bila belum ada artikel atau hasil pencarian kosong, tampil keadaan kosong terkurasi, bukan formulir login penuh.

## Editor
- Isian artikel: Judul, Kategori, Isi Tulisan, pilih Foto Sampul; impor DOCX/TXT/MD tetap ada. Simpan Draf opsional.
- Tidak ada isian ringkasan. Sistem menyusun nilai `excerpt` otomatis dari isi artikel (maksimal 320 karakter) untuk kompatibilitas DB dan preview WhatsApp.
- **Migrasi DB tidak diperlukan**: `gagasan_publish_check` lama tetap terpenuhi karena judul harus >= 6, teks >= 120, dan excerpt tersusun dari isi teks. Metadata title/description/og:image/og:url dibuat SSR.
- Sampul otomatis jika tidak memilih gambar, jadi setiap artikel terbit tetap memiliki `cover_path`.
- Setelah terbit, panel tautan pada laman baca menampilkan URL, tombol Salin Tautan, dan Buka Halaman Publik; tautan juga ada pada kartu publik dan Karya Saya.
- Tetap memberikan link walau refresh daftar gagal setelah artikel tersimpan di DB; tanpa kesalahan palsu yang menyatakan penyimpanan gagal.

## Foto
- Pilih file JPG/PNG/WebP; HEIC pada browser pendukung, maksimum file sumber 30MB.
- Foto diubah menjadi JPEG 1200 × 630 px, target 400 KB, maksimal 512 KB sesuai bucket `gagasan-covers`.
- Foto seluruhnya tetap terlihat dengan gambar yang ditampilkan secara utuh (contain) di atas latar blur dari sumber yang sama. Tidak menggunakan pemotongan tengah tanpa kontrol.
- Pratinjau merupakan file JPEG final yang sama seperti yang diunggah, beserta indikator ukuran asli -> ukuran kompresi.
- Saat perubahan sampul, gambar lama baru dihapus setelah penyimpanan artikel berhasil.

## Desain
- Identitas ETOS asli: logo putih `brand-etos-white.svg`, navy, biru, putih.
- Tata letak portal editorial responsif; kartu gambar 1.91:1, unggulan, badge kategori, profil penulis, tombol bagikan.
- Reveal saat kartu masuk viewport, bayangan dan lift halus, image hover zoom kecil, sorotan mengikuti kursor.
- Aksesibilitas reduced-motion, fokus keyboard pada pemilihan gambar, label dialog login, responsif untuk telepon.

## Pengujian sebelum deployment
1. Jalankan `npm run build` di environment repo dan `node scripts/gagasan-smoke.cjs` setelah commit diaktifkan (sekarang belum deploy sehingga build Vercel tidak terpicu).
2. Uji eksplorasi publik tanpa akun, pencarian/kategori, buka satu artikel existing.
3. Login satu akun Awardee nyata, buat draf, unggah JPEG/PNG panorama dan vertikal, periksa preview byte/ukuran dan hasil upload.
4. Terbitkan lalu periksa tautan `/tulisan/{uuid}-{slug}` dari browser tanpa login dan thumbnail Open Graph saat WhatsApp menerima link.
5. Masuk Superadmin, periksa pelaporan partisipasi dan sunting isi artikel tanpa ringkasan manual.
6. Pastikan data READMAP dan halaman lain tetap berfungsi. Deploy sekali setelah disetujui pengguna.
