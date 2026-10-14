# RUANG GAGASAN — ETOS ID PALU

## Arsitektur
- Dashboard author/editor: /gagasan.html, /gagasan-*.js, /gagasan.css. Terhubung ke akun READMAP Supabase Auth (storageKey etos-readmap-auth-v1).
- Admin: /readmap-admin.html + /gagasan-admin.js, menggunakan sesi cookie Superadmin yang telah ada dan gateway /api/secure -> readmapAdmin. Tidak ada API function baru di dashboard.
- Server-rendered public share: subproject Vercel root \`gagasan-public\`, nama proyek \`gagasan-etos-palu\`, route /t/:id-slug menghasilkan HTML Open Graph.
- Data: public.gagasan_articles. Migration live Supabase 20261014220008 (gagasan_articles_storage_public_share_20261015), Applied 15 Oct 2026.
- Media: bucket \`gagasan-covers\` public JPEG max 512KiB. Hanya *path* di PostgreSQL. Kompresi otomatis target 400KiB 1200x630, fallback sampul editorial otomatis.
- Anonymous PostgREST SELECT hanya \`status='published' AND share_enabled=true\`. Tidak ada daftar karya publik; setiap tautan merupakan halaman unlisted, noindex. Perlu peringatan bahwa siapapun yang memiliki link dapat mengakses tulisan.
- Access: Awardee terautentikasi dan terpetakan di \`readmap_memberships\` dapat membuat, menyunting, menghapus tulisannya sendiri. Admin semua lewat sesi Superadmin yang sudah ada. Penulis yang belum punya akun READMAP disiapkan melalui panel /readmap-admin.html (tidak menerbitkan akun/PIN di sini).
- Admin laporan: semua Awardee aktif, filter bulan dan angkatan, hitung artikel \`published\` per periode, tampilkan yang belum berkontribusi, sunting isi/status/sampul.
- Website ETOS utama tidak otomatis diubah atau diisi; admin bisa memilih tulisan terbaik secara manual.
- Tidak ada kurasi. Publikasi langsung saat penulis menekan \`Terbitkan\`.
- Pengujian: \`node scripts/gagasan-smoke.cjs\`; build Vercel memanggil skrip tersebut. Uji end-to-end login Awardee, unggah gambar dari perangkat, dan cache WhatsApp tetap memerlukan pengujian perangkat nyata.

## Catatan operasional
- Layanan gratis Supabase menggunakan kuota proyek bersama; monitor storage, database, dan bandwidth.
- Konten sampul public bucket tetap berpotensi diakses jika URL pernah diketahui walau artikel disembunyikan, sampai file dihapus; jangan mengunggah materi sensitif.
- URL publik default: https://gagasan-etos-palu.vercel.app; jika memasang subdomain kustom, ubah canonical, share origin, dan test OG kembali.
- Meta WhatsApp dibuat di server saat permintaan. WhatsApp mungkin menyimpan cache preview untuk URL yang telah dibagikan.

- DOCX/TXT/MD importer uses pinned Mammoth browser extraction of raw text. Original document stays on-device, plain text is edited and stored in Postgres.

## Domain resmi
- Link baru: `https://dashboard.etosidpalu.com/tulisan/:id-judul`. Vercel rewrites mem-proxy secara transparan ke layanan `gagasan-etos-palu`, tetap tampil pada subdomain `.com` utama.
- Halaman karya dan pembaca menggunakan logo resmi putih `brand-etos-white.svg`, palet biru-nav y ETOS, dan header konsisten.
- Verifikasi langsung preview WhatsApp baru dapat dilakukan setelah artikel nyata diterbitkan dan link dibagikan.
