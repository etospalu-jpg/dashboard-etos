# Integrasi Murajaah ETOS23

Sumber: `https://panpejzadufainlnoocw.supabase.co/functions/v1/etos23-report`

Status: adapter disiapkan, **belum aktif**. Respons API dan autentikasi belum terverifikasi. Jangan menaruh kredensial sumber di frontend atau melakukan sinkronisasi sebelum identitas awardee dapat dicocokkan secara deterministik.

## Alur

1. Backend ETOS mengambil laporan dengan batas waktu dan autentikasi server-side bila diperlukan.
2. Validasi skema respons dan identitas awardee (gunakan ID stabil; nama saja tidak cukup).
3. Pisahkan baris tak cocok/ambigu ke karantina; jangan otomatis membuat awardee baru.
4. Simpan id sumber, waktu laporan, dan hash untuk idempotensi.
5. Aktifkan penyajian read-only di dashboard setelah pengujian.

Tidak menyentuh PIN, tidak menimpa `spiritual_records`, tidak mengaktifkan deploy. Endpoint perlu dites dari lingkungan server yang dapat menjangkaunya.
