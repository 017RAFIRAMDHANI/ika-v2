# Verifikasi wajah dan pendaftaran DPT

## Alur pengguna baru

1. Calon pemilih membuka `/daftar` tanpa login.
2. Pemilih memasukkan Kode Primary DPT yang diberikan administrator. Server
   memvalidasi kode dan memberikan token akses pendaftaran selama 15 menit.
3. Pemilih mengisi identitas alumni dan membuat password sendiri.
4. Browser memuat model lokal dari `public/models/human`; tidak ada model yang
   diambil dari CDN.
5. Instruksi liveness diacak: kedip, tengok kiri, tengok kanan, lalu kembali
   menghadap kamera.
6. Foto dan video tidak dikirim ke server. Browser hanya menghasilkan descriptor
   1024 angka beserta bukti penyelesaian challenge.
7. Server memvalidasi challenge, mengompresi descriptor, mengenkripsinya dengan
   AES-256-GCM, lalu membuat akun berperan `Alumni` tanpa persetujuan admin.
8. Saat akun pertama kali membuka `/pemilihan`, proses liveness diulang dan
   descriptor baru dicocokkan oleh server. Setelah berhasil, `face_verified_at`
   disimpan dan pemeriksaan tidak muncul lagi untuk akun tersebut.

## Akun lama

Akun hasil impor lama tidak memiliki template wajah. Saat pertama membuka bilik
suara, pengguna menjalani **Aktivasi Verifikasi Wajah**. Liveness yang berhasil
mendaftarkan template sekaligus menandai akun terverifikasi. Jalur kompatibilitas
ini hanya berlaku bila template akun masih kosong.

## Penegakan backend

- Halaman kandidat tidak diberikan sebelum `face_verified_at` tersedia.
- `POST /api/vote` memeriksa status verifikasi dari sesi.
- Query atomik penyimpanan suara juga mensyaratkan `face_verified_at IS NOT NULL`,
  sehingga pemanggilan endpoint secara langsung tidak melewati verifikasi.

## Database dan kunci

Jalankan `database/migrate-face-verification.sql` pada database Neon yang sudah
ada. Tambahkan variabel berikut di lokal dan deployment:

```dotenv
FACE_DATA_SECRET=KUNCI_ACAK_MINIMAL_32_KARAKTER
REGISTRATION_PRIMARY_CODE=KODE_PRIMARY_DPT_MINIMAL_8_KARAKTER
```

Gunakan generator yang sama seperti `SESSION_SECRET`, tetapi simpan nilai yang
berbeda. Jangan mengganti atau kehilangan kunci ini: template wajah lama dan
backup Excel tidak dapat dibuka tanpa kunci yang sama.
`REGISTRATION_PRIMARY_CODE` dapat diganti oleh administrator untuk menutup akses
kode lama; perubahan kode tidak memengaruhi akun yang sudah terdaftar.

## Backup Excel

Kolom `Data Wajah Terenkripsi` sengaja disembunyikan agar lembar mudah dibaca,
tetapi tetap tersimpan di file. Menu Import mendeteksi header backup secara
otomatis dan memulihkan biodata serta status wajah. File backup tetap harus
diperlakukan sebagai dokumen rahasia walaupun template sudah terenkripsi.

## Catatan operasional

- Kamera browser memerlukan HTTPS pada deployment; `localhost` tetap diizinkan
  untuk pengembangan.
- Script `dev` dan `build` memakai bundler Webpack agar paket Human selalu
  diarahkan ke bundle browser dan tidak mencoba memuat TensorFlow native Node.js.
- Uji di perangkat aktual, terutama Android kelas menengah dan iPhone, dengan
  pencahayaan depan yang cukup.
- Ini merupakan verifikasi biometrik lokal untuk kontrol akses voting, bukan
  pengganti pemeriksaan identitas legal/KYC oleh penyedia biometrik tersertifikasi.
