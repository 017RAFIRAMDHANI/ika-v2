-- Migrasi tambahan untuk instalasi yang sudah berjalan.
-- Jalankan sekali di Neon Console > SQL Editor sebelum deploy kode baru.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_program VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cohort VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS graduation_year VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS domicile VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_template_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_source VARCHAR(32) NOT NULL DEFAULT 'Admin';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci
  ON users (LOWER(email)) WHERE email IS NOT NULL;

COMMIT;

SELECT
  COUNT(*) FILTER (WHERE face_template_encrypted IS NOT NULL) AS wajah_terdaftar,
  COUNT(*) FILTER (WHERE face_verified_at IS NOT NULL) AS wajah_terverifikasi
FROM users;
