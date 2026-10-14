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


## Penambahan dalam paket V2 — akses Dashboard + Profil Awardee
- Dashboard utama pada \`shell.html\` menyediakan pintu **Ruang Gagasan** di sidebar dan CTA halaman ikhtisar. URL publik selalu \`/gagasan.html\` pada domain \`dashboard.etosidpalu.com\`.
- Semua link artikel milik penulis, kartu karya, pengelola, dan halaman SSR memakai canonical \`https://dashboard.etosidpalu.com/tulisan/:id-judul\`. \`gagasan-etos-palu.vercel.app\` hanya ada sebagai target **internal reverse proxy Vercel** dan tidak perlu diumumkan ke pengguna.
- Ruang Awardee di \`readmap.html\` memuat satu strip ringkas profil pribadi: nama, kampus/prodi, tulisan terbit, IP terakhir, dan prestasi. Tidak tampil di demo.
- \`profil-awardee.html\` adalah ruang personal penuh: identitas, studi, kampus, angkatan, motto, jumlah tulisan/draf, rak buku, halaman bacaan, prestasi, perkembangan nilai dan karya terbaru. Desain ETOS premium navy–putih, responsive.
- Grafik IP murni data \`academic_records\` per semester dan tidak membuat titik palsu. Nilai rekap kumulatif (\`is_summary=true\`) diperlihatkan sebagai informasi terpisah, tidak otomatis menjadi nilai semester 1–8.
- RLS staf untuk \`awardees\` / \`academic_records\` tetap **tidak diubah**. Migration \`supabase/migrations/20261015_awardee_self_profile.sql\` (PENDING) menambah \`awardee_self_snapshot()\` yang hanya mengembalikan baris satu awardee yang dipetakan dari \`auth.uid()\` milik pemegang sesi READMAP. Tidak menerima \`awardee_id\` dari client, tidak punya akses \`anon\`, tidak expose kontak sensitif.
- **Deployment dependency**: ketika pemilik menyetujui rilis, audit lalu jalankan migrasi profil terlebih dahulu, uji satu akun pemilik yang otentik dan penolakan akun anonim/akun lain, jalankan \`npm run build\`, baru fast-forward branch utama untuk deploy dashboard + reader sekali terakhir.
- Profil dan grafik belum dapat diuji end-to-end terhadap fungsi RPC sampai migration diizinkan. Data produksi tidak diubah dalam pekerjaan penyiapan ini.
