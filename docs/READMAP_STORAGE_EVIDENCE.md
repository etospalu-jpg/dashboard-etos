# READMAP: Bukti Bacaan — Supabase File Storage

- Bucket baru: `readmap-reading-evidence` (PRIVATE, WebP-only, 2 MB/file).
- Foto atau screenshot halaman buku tidak disimpan sebagai Base64/BYTEA di PostgreSQL.
- `readmap_reading_entries.evidence_paths` berisi paling banyak 3 lokasi file.
- Supabase Storage RLS membatasi upload, preview, hapus ke folder pengguna dan anggota READMAP yang login.
- Browser mengompresi gambar hingga batas 2 MB. Maksimal 3 foto per laporan. 
- Foto lama tetap jika user menyimpan laporan tanpa memilih foto baru. Memilih foto baru menggantikan foto sebelumnya setelah laporan sukses.
- Penghapusan bukti atau buku akan menghapus referensinya dan mencoba membersihkan file.
- Foto sampul yang lama, anggota, laporan, dan database lain tetap dipertahankan.
- Mode demo menggunakan data browser lokal tanpa mengunggah ke storage.
- Pantau penggunaan kuota Storage gratis dan egress secara berkala.
