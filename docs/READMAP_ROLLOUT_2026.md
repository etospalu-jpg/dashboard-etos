# ETOS READMAP — rencana peluncuran terkendali

## Lingkup
Repository: `etospalu-jpg/dashboard-etos`.
Branch: `feat/readmap-literasi-2026`.
Vercel project: `prj_PnwdXvGAOtme8R8r5IYVKXglklOZ` (team `etospalu-3401`).
Supabase: `weklmapqizeldfdalbgs`.
Tidak membuat proyek baru, tidak mengubah IDP pusat, atau mereset data awardee.

## Apa yang sudah ada
- `/readmap.html` adalah ruang pribadi Etoser: username+PIN, rak buku, laporan baca, progres video, grafik bacaan.
- `/readmap-admin.html` adalah ruang terbatas Superadmin: terbitkan akun, reset PIN, ekspor kredensial satu kali, monitoring agregat.
- `/api/secure` menangani fungsi `readmapAdmin` dengan sesi PIN Superadmin existing. Tidak ada serverless endpoint tambahan.
- `ops/readmap-admin-handler.js` memakai Supabase Admin API, mengelola username `ETOS26-XXXXXXXXXX` dan PIN numerik acak 10 digit.
- Supabase Auth menyimpan hash PIN/password; tabel READMAP hanya menyimpan username dan relasi user ke awardee.
- Tabel dan policy baru berasal dari `supabase/migrations/20261013_readmap_phase1.sql`.

## Catatan keamanan
- Kredensial hanya dibuat dari halaman Superadmin setelah autentikasi PIN existing. Tidak ada endpoint anonim untuk menerbitkan akun.
- Jangan bagikan CSV kredensial melalui grup publik. Ekspor sekali, distribusikan per Etoser, lalu hapus salinan yang tidak dibutuhkan.
- Ketika reset PIN, bagian awal login lama dapat tetap berjalan sampai masa token access yang ada berakhir; review kebutuhan pencabutan session bila akun hilang/terkompromi.
- Progres video merekam aktivitas YouTube embed di dashboard; tidak membuktikan pemahaman dan berpotensi dimanipulasi dari browser. Tidak boleh dipromosikan sebagai verifikasi menonton yang tidak bisa dipalsukan.
- Akun hanya diterbitkan untuk `awardees.status='aktif'`, dapat bertambah saat administrasi diperbarui.
- Penyimpanan playlist dan refleksi di dalam tabel ber-RLS sesuai `awardee_id`; jangan mengubah role legacy.
- Tautan resmi YouTube atau aplikasi YouTube di luar dashboard tidak dapat dilacak.
- Beberapa video memblokir embedding sehingga tidak menghasilkan progres.

## Daftar pengujian sebelum produksi
1. Vercel Preview READY dari SHA branch terbaru.
2. Superadmin pada preview berhasil membuka `/readmap-admin.html` dengan sesi PIN-nya; akses tanpa PIN ditolak 401.
3. Generate **satu akun** terverifikasi terlebih dahulu, simpan PIN secara privat, login melalui `/readmap.html` dan uji logout/login ulang.
4. Uji autentikasi Etoser tidak dapat membuka `/api/secure`, Data Center, profil awardee lain, atau tabel literasi Etoser lain.
5. Uji dua metode input halaman (rentang 41–82 = 42; jumlah langsung), update laporan pekan yang sama, larangan silang buku-awardee.
6. Uji menambah video YouTube yang mendukung embedding, jeda, tutup, buka kembali, skip bagian durasi, lanjut pada perangkat lain, dan status selesai.
7. Uji profil serta dashboard existing tetap normal, terutama Absensi, Coaching & IDP dan Refleksi.
8. Uji mobile, tidak ada error console, data tetap setelah refresh; catat kekurangan sebagai release blocker.
9. Jika semua lolos, terbitkan akun Etoser aktif lain lewat Superadmin, simpan CSV secara privat, dan deploy production SEKALI.
10. Verifikasi produksi melalui domain `dashboard.etosidpalu.com` dan monitoring error Vercel.

## Pemeriksaan yang selesai pada 13 Oktober 2026
- Migration diterapkan ke Supabase existing dengan sukses; 5 tabel READMAP dibuat dengan RLS.
- Pasca migration: 23 awardee, 16 aktif, 0 membership diterbitkan. Tidak ada data buku/video/laporan fiktif.
- Preview build READY setelah endpoint provisioning dialihkan ke `/api/secure` untuk mematuhi batas 12 fungsi Vercel Hobby.
- Pengujian login sungguhan, pemutaran YouTube real-time, reset PIN, dan isolasi dua akun masih memerlukan percobaan end-to-end; build READY bukan bukti semuanya berjalan.
