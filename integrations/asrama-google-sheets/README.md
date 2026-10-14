# Sinkronisasi Absensi Asrama 2026 — ETOS ID Palu

**Tidak memerlukan akses editor maupun persetujuan pemilik Google Spreadsheet pusat.** Script dijalankan sebagai proyek mandiri milik akun Google pengelola Palu yang sudah bisa **melihat** spreadsheet sumber.

## Sumber dan batasan

- Spreadsheet: https://docs.google.com/spreadsheets/d/1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA/edit
- Tab sumber: `02 Kehadiran`, rentang A4:K, kode agenda `AGD-xxx`.
- Khusus tujuh Awardee asrama **Palu Angkatan 2026**: Awaina, Jelita, Nur Afni, Putri, Risky Maharani, Wiwid Awrel, Zahratun Sita.
- Hanya membaca data; tidak menulis, mengubah, atau memasang apa pun di spreadsheet pusat.
- Awardee 2023 **nonasrama** hanya mendapatkan catatan pembinaan wilayah Palu.

## Aktivasi satu kali dari akun Google Palu

1. Masuk **Superadmin Dashboard ETOS → Ruang Awardee → Sinkronisasi Google Spreadsheet**. Pilih **Buat Kunci Sinkronisasi**. Salin kunci secara pribadi, jangan kirim ke grup.
2. Masuk ke [Google Apps Script → Proyek baru](https://script.google.com/home/projects/create) dengan akun Google yang *sudah bisa membuka jurnal pusat*. Ini **bukan** menu Ekstensi → Apps Script dalam spreadsheet pusat.
3. Tempel seluruh isi [Code.gs](./Code.gs) di proyek **mandiri** milik akun Palu, lalu Simpan.
4. Buka **Pengaturan proyek → Properti skrip**. Tambahkan nama `ETOS_ASRAMA_SYNC_KEY`, nilai berupa kunci yang didapat pada langkah 1. Simpan.
5. Di editor, pilih fungsi **`etosForceSync` → Jalankan**, kemudian otorisasi menggunakan **akun Google Palu Anda sendiri**. Baca izin yang diminta; tidak perlu izin dari pemilik spreadsheet pusat.
6. Pilih fungsi **`etosInstallTriggers` → Jalankan**. Pemicu dijadwalkan sekitar **setiap 1 menit**, tanpa `onEdit` pada file pusat.
7. Periksa **Dashboard Superadmin → Perbarui**. Status aktif hanya muncul apabila server menerima sinkronisasi atau heartbeat terbaru.

## Cara kerja

Pengecekan rutin membaca 67 agenda yang direncanakan. Hanya sel berisi Hadir/Izin/Sakit/Alpa yang dihitung; yang kosong **bukan Alpa**. Saat ada perubahan, status diperbarui di Supabase dengan ID agenda + ID Awardee, tanpa duplikat. Saat tidak berubah, script hanya mengirim heartbeat ringan. Google Apps Script mengeksekusi pemicu secara perkiraan, jadi ini **hampir real-time ±1 menit**, bukan nol detik.

## Jika terkendala

- **Tidak memiliki izin membuka dokumen dari Apps Script:** pastikan proyek berjalan dari akun Google yang sama dengan akun yang dapat melihat file sumber. Akses baca pada file diperlukan; jika akun memang tidak memiliki akses, tidak ada jalan aman untuk melewati perizinannya.
- **Kunci diganti:** ubah properti `ETOS_ASRAMA_SYNC_KEY`, jalankan `etosForceSync`, lalu pastikan status dashboard kembali aktif.
- **Gagal validasi:** periksa nama tujuh Awardee, format tanggal, dan kode agenda. Impor akan ditolak jika nama/kolom berubah sehingga data wilayah lain tidak salah masuk.
- **Koneksi berhenti:** cek daftar **Eksekusi** di Apps Script. Catatan terakhir tetap ada tetapi tidak diklaim real-time selama pemicu belum berjalan.

Kredensial hanya dibuat dari panel Superadmin dan database menyimpan hash-nya, bukan teks kunci. Data absensi wilayah dan asrama terpisah; laporan akun Awardee hanya mengembalikan data dirinya sendiri.
