# ETOS ID Palu — Historical Data Audit 2026-09-07

Dokumen ini adalah **catatan historis proses cutover awal** dan tidak lagi menjadi sumber kebijakan runtime ETOS ID Palu Dashboard.

Mulai arsitektur **supabase-only-v36**, authority aplikasi ditetapkan sebagai berikut:

- seluruh data aplikasi disimpan dan dibaca dari Supabase PostgreSQL;
- spreadsheet dashboard lama tidak lagi disinkronkan, baik otomatis maupun manual;
- snapshot JSON lokal tidak dipakai sebagai fallback database;
- migration-on-build dan endpoint cutover lama dipensiunkan;
- IDP pusat menjadi satu-satunya sumber eksternal yang diizinkan dan hanya dibaca secara live/read-only;
- Periode Pembinaan dan Agenda Absensi dikelola langsung melalui Supabase;
- data Jurnal Pendampingan dan ringkasan bulanan disimpan di Supabase.

Catatan audit detail dari fase migrasi awal sengaja tidak digunakan sebagai konfigurasi atau authority runtime. Kebijakan aktif dan machine-readable terdapat pada `data-audit-manifest.json`.
