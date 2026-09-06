# ETOS ID Palu — Data Audit 2026-09-07

Audit ini menggunakan source Google Sheet **DASHBOARD AWARDEE ETOS ID PALU** dan IDP pusat individual. Prinsip: data yang tidak didukung source tidak boleh diisi; placeholder tidak dianggap transaksi; konflik dipisahkan sebagai quarantine.

| Sheet | Source | Normalized target | Status / catatan |
|---|---:|---:|---|
| Awardee | 16 | 16 | Valid identity master; visi/jurusan dapat di-override hanya oleh IDP individual eksplisit. |
| Akademik | 61 | 54 | AKD-001–AKD-007 dikarantina: Semester `46235` adalah serial tanggal, bukan semester. |
| Organisasi | 18 | 2 | 16 shell ID/FK tanpa isi bisnis. |
| Prestasi | 30 | 19 | 11 shell kosong. |
| Coaching | 16 | 0 | Semua row legacy hanya shell; bukan sesi coaching. |
| Portfolio | 5 row nonempty termasuk orphan | 3 Awardee-linked | Samsudaris PRT-0NaN dikarantina; Wahyu memiliki dua artefak valid tetapi kolom CV/evidence legacy tertukar; Bagas valid; Riskawati contribution-only; orphan LinkedIn bukan Awardee. |
| Absensi | 0 transaksi | 0 | Production fresh-start 2026-09-07. |
| Asesmen_Awardee | 1 | 1 | JSON dipertahankan. |
| Analisis_Otomatis | 3 | 3 historical | Dipertahankan sebagai histori tetapi pre-cutover tidak dipakai sebagai analisis aktif. |
| Form_Refleksi_Kajian | 1 | 1 | RFK-0001 aktif; mereferensikan PRD-0002. |
| Refleksi_Kajian | 0 | 0 | Belum ada respons. |
| Periode_Pembinaan | 0 | compatibility only | Source kosong; PRD-0002 tidak boleh dianggap source period nyata. |
| Fasilitator | 1 | 1 | Ada satu profile source. |
| Pendampingan_Case | 0 | 0 | Kosong. |
| Kompetensi_Awardee | 0 | 0 | Kosong. |
| Spiritual | 0 | 0 | Kosong. |
| Networking | 0 | 0 | Kosong. |
| PDP | 0 | 0 | Legacy header only. |
| Pengaturan_Admin_Absensi | konfigurasi legacy | tidak dimigrasi sebagai data aplikasi | Mekanisme credential legacy harus dipensiunkan setelah Auth Supabase aktif. |

## Portfolio audit

- **AWD-0009 / Samsudaris / PRT-0NaN — QUARANTINE.** Link legacy membuka dokumen umum `Menjadi Manusia Indonesia — Antara Pengetahuan, Nilai, dan Kepedulian`; tidak ada bukti file tersebut adalah CV/portfolio Samsudaris dan pencarian Drive atas nama Samsudaris tidak menemukan file portfolio yang dapat diverifikasi.
- **AWD-0006 / Wahyu Hidayat — VERIFIED WITH COLUMN CORRECTION.** `CV WAHYU HIDAYAT.pdf` adalah CV; `WAHYU HIDAYAT-PITCHING.pdf` adalah evidence/pitching. Kolom legacy terbalik.
- **AWD-0001 / Bagas Jaya Andika — VERIFIED.** Artefak Drive bernama `Bagas Jaya Andika_Palu.pdf`.
- **AWD-0004 / Riskawati — SOURCE-ONLY.** Kontribusi `Guru SDIT Bina Insan Palu` ada di source, tetapi tidak ada file pendukung pada row tersebut.

## Awardee profile authority

- Nama, status, foto, cohort: master Awardee.
- Visi hidup: IDP individual jika eksplisit. Template/placeholder IDP = kosong.
- Jurusan: master Awardee, kecuali IDP individual secara eksplisit memberi informasi yang lebih spesifik/menyelesaikan field kosong.
- Tidak boleh membuat visi, portfolio, prestasi, coaching, atau evidence dari inferensi.

## Production cutover

- Absensi dimulai **7 September 2026** tanpa histori test.
- Rule analysis sebelum cutover disimpan sebagai histori tetapi tidak dipakai sebagai current Awardee 360.
- System Center baru boleh menampilkan `normalizedParity=true` jika target normalized counts cocok, bukan jika row legacy rusak ikut terhitung.
