# Konsolidasi Ruang Gagasan ke satu proyek Vercel

## Proyek resmi
- Vercel: https://vercel.com/etospalu-3401/dashboard-etos
- Domain: https://dashboard.etosidpalu.com
- Repo: https://github.com/etospalu-jpg/dashboard-etos
- Supabase: weklmapqizeldfdalbgs

## Halaman dan pembaca artikel
- Portal: /gagasan.html
- Artikel yang dibagikan: /tulisan/:ref
- Vercel rewrite internal: /tulisan/:ref -> /api/public-attendance?ref=:ref.
- Fungsi existing api/public-attendance.js meneruskan GET dengan ref ke gagasan-public/api/article.js sebagai handler pustaka.
- GET data_health dan semua POST publik tetap ditangani logika lama.
- Metadata Open Graph dibuat server-side, cover di Supabase Storage, canonical dan URL WhatsApp di domain .com.
- Jaga jumlah fungsi akar api/ maksimal 12 jika paket Hobby memiliki batasan ini. Jangan buat api/article.js tersendiri.

## Cache dashboard
- index.html memuat shell dengan ?v=38.1 dan cache:'no-store'.
- vercel.json mengatur Cache-Control: no-store untuk shell.html.
- Service Worker versi 38.1 menggunakan network-first untuk shell.html, bukan cache-first.
- Jangan mengembalikan force-cache atau immutable pada shell.html yang memuat microcopy seperti “Masuk sebagai Awardee”.

## Proyek Vercel kedua yang dinonaktifkan
Proyek gagasan-etos-palu sebelumnya digunakan sebagai SSR artikel, tetapi setelah pergantian rewrite tidak lagi berada pada jalur permintaan produksi.
Pengaturan Ignored Build Step untuk proyek kedua: exit 0 (lewati build), preview deployment disabled.
Tidak menghapus proyek kedua otomatis. Setelah memastikan canonical URL dan preview WhatsApp di production, pemilik proyek dapat menghapusnya dari Vercel.
Jangan ubah proyek Vercel utama / nama tim / domain secara tidak sengaja.

## Verifikasi
1. Semuanya tetap diarahkan ke dashboard.etosidpalu.com; cari literal gagasan-etos-palu.vercel.app dalam konfigurasi root, harus tidak ada.
2. Periksa GET /tulisan/{uuid}-slug: HTTP 200, Content-Type HTML, og:title, og:image dan og:url.
3. Verifikasi GET /api/public-attendance?data_health=1 dan layanan POST publik tidak terganggu.
4. Reload Dashboard memakai browser lama: kartu dan pilihan akses harus menulis Awardee.
5. Uji link yang sudah dibagikan dengan WhatsApp, bila perlu menunggu cache preview WhatsApp kedaluwarsa.
6. Kedua halaman Portal, READMAP, Profil Awardee, serta laporan admin tetap terbuka seperti sebelumnya.
