# ETOS ID Palu Dashboard

ETOS ID Palu Dashboard adalah workspace perkembangan Awardee berbasis **Supabase PostgreSQL** dengan frontend di Vercel.

## Arsitektur v36

- **Frontend:** ETOS web dashboard di Vercel
- **Database utama:** Supabase PostgreSQL (`weklmapqizeldfdalbgs`)
- **Authentication:** Supabase Auth + session operasional Superadmin
- **Authorization:** RBAC + Row Level Security
- **Realtime:** Supabase Realtime untuk perubahan data aplikasi
- **Public data:** Supabase Edge Function `public-api`
- **Refleksi Kajian:** Supabase Edge Function `public-reflection`
- **IDP:** live read-only; satu-satunya sumber data eksternal yang diizinkan

## Kebijakan sumber data

Seluruh data aplikasi selain IDP harus dibaca dan ditulis ke Supabase PostgreSQL. Tidak ada auto-sync spreadsheet, manual spreadsheet sync, snapshot JSON sebagai fallback database, atau migration-on-build.

IDP pusat hanya dibaca secara live dan tidak boleh digunakan sebagai database fallback. Dashboard tidak menulis ke workbook IDP.

## Modul akses

Dashboard, Direktori Awardee, Tracking Alumni, Akademik, dan Prestasi dapat memiliki akses baca sesuai kebijakan aplikasi. Modul operasional berikut berada di balik autentikasi/RBAC:

- Absensi
- Coaching & IDP
- Jurnal Pendampingan
- Profil Fasilitator
- Data Center
- System Center
- Pengaturan

## Data Center dan Pengaturan

**Data Center** adalah workspace CRUD data Supabase sesuai role. **Pengaturan** adalah workspace konfigurasi operasional, termasuk Periode Pembinaan dan Agenda Absensi. Keduanya merupakan view terpisah dan tidak boleh saling menimpa.

## Deployment

Perubahan dikerjakan dan diverifikasi di branch terlebih dahulu. Production dipromosikan hanya setelah migration database, quality gate, dan verifikasi runtime selesai.

Jangan menaruh service-role key atau secret server di repository. Browser hanya boleh menggunakan Supabase publishable key.
