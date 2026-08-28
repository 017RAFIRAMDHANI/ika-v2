# Struktur database Neon

- `users`: akun login, biodata alumni, status voting, template wajah terenkripsi,
  serta waktu pendaftaran/verifikasi wajah.
- `voters`: relasi akun dengan kandidat yang dipilih.
- `candidates`: profil kandidat dan total suara.

Skema ini mempertahankan relasi dari tabel Laravel `users`, `mahasiswas`, dan
`paslons`, tetapi menggunakan tipe serta batasan PostgreSQL.

Untuk pemasangan manual, buka **Neon Console → SQL Editor**, salin seluruh isi
`neon-manual.sql`, kemudian tekan **Run**. File tersebut sudah mencakup skema,
indeks, tiga kandidat, dan akun admin awal.

Untuk database versi lama, jalankan `migrate-face-verification.sql`. Migrasi ini
hanya menambah kolom dan indeks email; akun, kandidat, serta suara tidak dihapus.
