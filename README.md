# Sahabat Aman — aplikasi anti-bullying sekolah

Starter project responsif untuk portal laporan dan edukasi anti-bullying. Frontend statis, autentikasi dan database online memakai Supabase, shell web dapat dicache sebagai PWA.

## Penting sebelum digunakan
Ini adalah **starter/MVP**, bukan sistem yang sudah diaudit untuk menangani keadaan darurat atau data sensitif anak. Jangan memasukkan laporan siswa sungguhan sebelum sekolah melakukan uji keamanan, menunjuk petugas penanggung jawab, menyiapkan prosedur tindak lanjut, serta meninjau privasi dan aturan yang berlaku. Versi ini belum menyediakan upload bukti, panel UI untuk manajemen akun/penugasan konselor, notifikasi darurat, atau sinkronisasi otomatis draf offline.

## Struktur
- `index.html` — antarmuka.
- `styles.css` — desain responsif.
- `app.js` — autentikasi, laporan, status, pesan, statistik.
- `supabase.sql` — tabel dan kebijakan Row Level Security.
- `manifest.json`, `sw.js` — metadata PWA dan cache shell.

## 1. Buat backend Supabase
1. Buat proyek di https://supabase.com/.
2. Buka SQL Editor, tempel isi `supabase.sql`, lalu jalankan.
3. Di Project Settings / API (atau Connect), salin **Project URL** dan **publishable key**. Jangan pernah gunakan `service_role` atau secret key di browser.
4. Buka `app.js`, ganti `ISI_SUPABASE_PROJECT_URL` dan `ISI_SUPABASE_PUBLISHABLE_KEY` dengan nilai proyek.
5. Di Authentication settings, aktifkan verifikasi email dan konfigurasi URL situs/redirect sesuai alamat lokal dan alamat produksi. Atur kebijakan kata sandi dan pembatasan pendaftaran sesuai kebutuhan sekolah.

## 2. Jalankan di komputer
Service worker dan beberapa fitur web perlu `localhost` atau HTTPS; jangan buka `index.html` langsung dengan `file://`.
- Pasang Node.js dari https://nodejs.org/ (atau gunakan editor yang sudah memiliki terminal).
- Buka terminal di folder proyek.
- Jalankan `npx serve .`
- Buka alamat localhost yang ditampilkan terminal, biasanya `http://localhost:3000`.
- Supabase harus online untuk login, pendaftaran, mengambil data, dan mengirim laporan.

Jika belum memasang Node.js, gunakan ekstensi Live Server pada Visual Studio Code, klik kanan `index.html` lalu “Open with Live Server”.

## 3. Buat akun dan peran admin
1. Buka aplikasi melalui localhost.
2. Daftarkan akun admin menggunakan email sekolah tepercaya, lalu verifikasi email.
3. Di Supabase Dashboard → SQL Editor, jalankan perintah berikut dengan email yang sesuai:
   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where u.id = p.id and u.email = 'admin@sekolah.sch.id';
   ```
4. Keluar lalu masuk kembali. Buat akun konselor dan kepala sekolah dengan alur pendaftaran biasa, verifikasi, lalu ubah peran lewat SQL:
   ```sql
   update public.profiles p set role = 'counselor'
   from auth.users u where u.id = p.id and u.email = 'konselor@sekolah.sch.id';

   update public.profiles p set role = 'principal'
   from auth.users u where u.id = p.id and u.email = 'kepsek@sekolah.sch.id';
   ```
5. **Jangan pernah memberi peran admin kepada siswa.** Nonaktifkan pendaftaran publik jika sekolah ingin akun dibuat terpusat. Promosi peran hanya boleh dilakukan admin tepercaya.

## 4. Uji sebelum publikasi
- Buat dua akun siswa dan pastikan siswa A tidak bisa melihat laporan siswa B.
- Pastikan siswa tidak bisa mengubah status atau menetapkan konselor.
- Pastikan konselor hanya dapat mengakses laporan yang ditugaskan kepadanya.
- Pastikan akun principal tidak dapat mengirim pesan atau mengubah laporan.
- Pastikan admin dapat melihat dan memperbarui kasus.
- Uji pesan, status, reset password, verifikasi email, dan logout.
- Jalankan tes dengan akun terpisah; jangan hanya menguji sebagai admin.
- Perbaiki RLS dan hak akses sampai semua skenario benar. Minta peninjauan teknis sebelum dipakai sungguhan.

## 5. Publikasikan gratis (misalnya GitHub Pages)
1. Buat repositori GitHub baru dan unggah file proyek.
2. Pastikan konfigurasi Supabase sudah diisi dengan URL dan publishable key (publishable key boleh ada di frontend, tetapi harus selalu dilindungi RLS).
3. Di GitHub, buka Settings → Pages → pilih deploy dari branch `main`, folder root, lalu Save.
4. Tunggu URL publik diberikan GitHub Pages.
5. Masukkan URL itu ke daftar Site URL dan Redirect URLs di pengaturan Supabase Auth.
6. Buka URL dengan HTTPS, uji kembali semua skenario. GitHub Pages hanya meng-host frontend; database dan login tetap memerlukan Supabase.
7. Perhatikan bahwa URL dan publishable key dapat dilihat siapa saja. Jangan simpan secret/service-role key, password, atau data kasus di repositori.

## 6. Mode offline — batasannya
- Setelah pertama kali dibuka online melalui localhost/HTTPS, service worker dapat menyimpan shell halaman dan aset same-origin.
- Saat offline, halaman yang sudah dicache dapat terbuka, tetapi login, pesan, statistik, dan database memerlukan koneksi.
- Form laporan versi ini menyimpan **satu draf lokal** di `localStorage` ketika tombol kirim ditekan saat offline. Draf tidak otomatis dikirim; saat online, salin/isi kembali formulir lalu kirim. Draf lokal dapat diakses orang lain yang memakai perangkat/browser yang sama, jadi jangan gunakan perangkat bersama untuk laporan sensitif.
- Jangan menyimpan isi kasus atau identitas korban ke cache service worker. Jangan menganggap cache offline sebagai cadangan data yang aman.

## 7. Batasan yang perlu ditambah untuk produksi
- Panel admin khusus untuk manajemen pengguna, penugasan kasus, artikel edukasi, dan audit log.
- Notifikasi email yang tidak membocorkan detail kasus.
- Penyimpanan bukti dengan bucket privat, batas ukuran/jenis file, pemindaian file, serta kebijakan akses terpisah.
- Rate limiting / pencegahan spam dan perlindungan penyalahgunaan.
- Kebijakan retensi/penghapusan data, backup, prosedur insiden keamanan, persetujuan dan pemberitahuan privasi.
- Audit log perubahan kasus dan verifikasi hak akses secara berkala.
- Perbaiki policy counselor: untuk operasional sekolah yang ketat, penugasan sebaiknya dilakukan hanya admin dan konselor hanya boleh memperbarui status kasus yang sudah ditugaskan. Tinjau policy SQL sesuai prosedur sekolah sebelum produksi.

## Referensi
- Supabase secure data: https://supabase.com/docs/guides/database/secure-data
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- GitHub Pages: https://docs.github.com/pages
