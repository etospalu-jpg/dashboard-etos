# Integrasi Absensi Asrama ETOS ID Palu · 2026

## Sumber dan tanggung jawab
- Google Spreadsheet: https://docs.google.com/spreadsheets/d/1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA/edit
- Pengisian dan koreksi absensi **tetap dilakukan oleh fasilitator asrama di Google Sheets**.
- Dashboard ETOS Palu menampilkan data asrama sebagai **hanya-baca** serta membedakannya dari kegiatan wilayah.
- Data langsung dari sheet `02 Kehadiran` (A4:K), kode agenda `AGD-xxx`; identitas tujuh peserta dipetakan ke ID Awardee Supabase. Sheet lain tidak disunting.

## Aktivasi satu kali (oleh pengelola berizin Editor)
1. Di Dashboard, masuk dengan PIN Superadmin → **Manajemen Ruang Awardee** → **Sinkronisasi Google Spreadsheet**.
2. Pilih **Buat / Ganti Kunci Sinkronisasi**, lalu salin kunci baru (ditampilkan sekali saja).
3. Buka spreadsheet sumber → **Ekstensi → Apps Script**. Masukkan isi [Code.gs](./Code.gs) sebagai skrip *terikat* pada spreadsheet tersebut, kemudian simpan.
4. Muat ulang Google Spreadsheet. Menu **ETOS · Asrama** akan muncul.
5. Pilih **Masukkan kunci sinkronisasi**, tempel kunci dari Superadmin, lalu **Pasang pemicu otomatis**.
6. Jalankan **Sinkronisasi sekarang** sekali untuk memeriksa sambungan. Di Dashboard, tekan **Perbarui** untuk memeriksa waktu sinkronisasi terakhir.

Pemicu edit mengirim perubahan setelah sel absensi diperbarui. Pemeriksaan setiap lima menit menangkap perubahan yang tidak menghasilkan event edit, sehingga hasilnya **hampir real-time**, bukan janji keterlambatan nol detik.

## Aturan perhitungan
- Agenda yang belum memiliki status Hadir/Izin/Sakit/Alpa **tidak masuk denominator** dan tidak otomatis menjadi Alpa.
- Status yang berubah di spreadsheet memperbarui baris Supabase berdasarkan ID agenda dan ID Awardee, tidak membuat duplikasi.
- Sumber `wilayah` dan `asrama` dipisahkan dalam filter admin dan grafik pribadi.
- Awardee Angkatan 2023 nonasrama tidak menerima sesi asrama, sedangkan 2026 dapat melihat kedua sumber.
- Kata sandi konektor **tidak disimpan di repository**, hanya di Script Properties milik Apps Script; database menyimpan hash saja.
- Jika struktur peserta atau agenda di spreadsheet berubah, sinkronisasi ditolak sampai pemetaan diverifikasi. Ini menghindari salah pengakuan kehadiran.

## Pemulihan
Bila konektor gagal, lihat log **Executions** di Apps Script, cocokkan header Sheet dan ID agenda, lalu jalankan **Sinkronisasi sekarang**. Data yang terakhir berhasil tersimpan tetap tersedia. Jangan mengganti nama kolom peserta atau kode agenda tanpa memperbarui pemetaan dengan verifikasi identitas.

**Penting:** deployment Dashboard dan Edge Function **tidak otomatis memasang pemicu Apps Script** ke Google Sheet yang dimiliki fasilitator. Enam langkah aktivasi tersebut membutuhkan izin eksplisit pengelola spreadsheet.
