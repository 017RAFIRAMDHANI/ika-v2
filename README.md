# Portal Pemilihan Ketua IKA — Next.js + Neon + Verifikasi Wajah

Versi ini adalah migrasi full-stack dari proyek Laravel/MySQL ke Next.js App
Router dan Neon PostgreSQL. Backend, database, autentikasi, kandidat, dan alur pemilihan dipertahankan dari proyek sumber. Antarmuka telah didesain ulang penuh berdasarkan paket `new_design` dan dioptimalkan untuk desktop serta mobile.

## Teknologi

- Next.js App Router (frontend dan backend dalam satu proyek)
- React + TypeScript
- Next.js Route Handlers untuk login, biodata, voting, impor, dan ekspor
- Neon PostgreSQL melalui `@neondatabase/serverless`
- Cookie sesi bertanda tangan, `httpOnly`, dan `sameSite=lax`
- `bcrypt` untuk password
- ExcelJS untuk impor `.xlsx`/`.csv` dan ekspor `.xlsx`
- Chart.js untuk rekapitulasi suara
- Human/TensorFlow.js untuk face descriptor, anti-spoofing, liveness, dan gestur wajah di browser
- AES-256-GCM untuk enkripsi template biometrik sebelum disimpan di Neon

## Fitur yang telah dipindahkan

- Landing/onboarding baru untuk pengguna yang belum login
- Dashboard pemilih responsive dengan status hak suara
- Login pemilih (`/login`) dan administrator (`/admin/login`) yang terpisah
- Administrator tetap dapat membuka bilik suara seperti perilaku proyek Next.js lama
- Pemilihan kandidat satu kali per akun
- Transaksi voting atomik di PostgreSQL
- Halaman ucapan terima kasih setelah memilih
- Rekapitulasi suara khusus admin
- Dashboard administrator dengan ringkasan seluruh data
- CRUD kandidat: tambah, edit, dan hapus
- Kelola akun, peran, password, dan reset hak pilih
- Daftar dan detail lengkap pemilih (biodata, sumber pendaftaran, biometrik,
  waktu sistem, dan status suara), termasuk reset hak pilih
- Pencarian pemilih di tabel
- Impor akun dari Excel/CSV
- Form pendaftaran DPT tanpa login dengan Kode Primary DPT di `/daftar`
- Wizard pendaftaran tiga langkah: kode primary, biodata/akun, dan verifikasi wajah
- Liveness acak (kedip, tengok kiri/kanan, dan kembali ke tengah)
- Verifikasi wajah satu kali per akun sebelum bilik suara dibuka
- Aktivasi wajah satu kali untuk akun lama yang belum memiliki template
- Ekspor data pemilih dan backup template wajah terenkripsi ke Excel
- Impor ulang backup Excel tanpa mereset password akun yang masih ada
- Daftar calon ketua
- Redesign penuh mengikuti `new_design`, termasuk navigasi desktop dan bottom navigation mobile
- Logout berbasis POST dengan penghapusan cookie dan redirect penuh sesuai jenis akun

## Mulai cepat

1. Baca [PANDUAN-INSTALASI.md](./PANDUAN-INSTALASI.md).
2. Buat database Neon dan salin connection string.
3. Buka Neon SQL Editor, tempel seluruh isi `database/neon-manual.sql`, lalu
   tekan **Run**.
   Untuk database yang sudah berjalan, cukup jalankan `database/migrate-face-verification.sql`.
4. Salin `.env.example` menjadi `.env.local`, lalu isi semua nilainya termasuk
   `REGISTRATION_PRIMARY_CODE` yang akan dibagikan administrator kepada calon pemilih.
5. Jalankan:

   ```bash
   npm install
   npm run dev
   ```

6. Buka `http://localhost:3000`; pendaftaran DPT publik tersedia di `http://localhost:3000/daftar`.
7. Gunakan `http://localhost:3000/login` untuk pemilih atau
   `http://localhost:3000/admin/login` untuk administrator.

## Perintah

```bash
npm run dev        # Server pengembangan
npm run typecheck  # Pemeriksaan TypeScript
npm run lint       # Pemeriksaan kode
npm run build      # Build produksi
npm start          # Menjalankan hasil build
```

## Struktur utama

```text
app/                 Halaman dan backend Route Handlers
components/          Komponen UI interaktif
database/neon-manual.sql Query manual lengkap untuk Neon SQL Editor
database/schema.sql      Referensi struktur tabel PostgreSQL
lib/                 Database, sesi, keamanan, tipe data
public/assets/       Logo, foto, dan aset lokal proyek
public/storage/img/  Foto dan materi kandidat asli
sample-data/         Contoh data akun dari proyek sumber
INTEGRASI-DESAIN-BARU.md Catatan pemetaan dan validasi redesign
```

Referensi resmi: [Next.js App Router](https://nextjs.org/docs/app),
[Neon untuk Next.js](https://neon.com/docs/guides/nextjs), dan
[Next.js di Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
