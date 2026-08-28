import { neon } from "@neondatabase/serverless";
import type { AdminStats, AdminUserRecord, Candidate, ExportVoterRecord, UserRole, VoterRecord } from "@/lib/types";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }
  return neon(databaseUrl);
}

export async function findUserByLogin(userId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id::int AS id,
      user_id AS "userId",
      password_hash AS "passwordHash",
      display_name AS "displayName",
      role,
      has_voted AS "hasVoted",
      face_template_encrypted IS NOT NULL AS "faceEnrolled",
      face_verified_at IS NOT NULL AS "faceVerified"
    FROM users
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return (rows[0] ?? null) as
    | {
        id: number;
        userId: string;
        passwordHash: string;
        displayName: string;
        role: "Alumni" | "Admin";
        hasVoted: boolean;
        faceEnrolled: boolean;
        faceVerified: boolean;
      }
    | null;
}

export async function findSessionUser(id: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id::int AS id,
      user_id AS "userId",
      display_name AS "displayName",
      role,
      has_voted AS "hasVoted",
      face_template_encrypted IS NOT NULL AS "faceEnrolled",
      face_verified_at IS NOT NULL AS "faceVerified"
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  return (rows[0] ?? null) as
    | {
        id: number;
        userId: string;
        displayName: string;
        role: "Alumni" | "Admin";
        hasVoted: boolean;
        faceEnrolled: boolean;
        faceVerified: boolean;
      }
    | null;
}

export async function upgradeLegacyPassword(id: number, passwordHash: string) {
  const sql = getSql();
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getCandidates(): Promise<Candidate[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      name,
      vision,
      mission,
      featured_program AS "featuredProgram",
      image,
      occupation,
      cohort,
      votes
    FROM candidates
    ORDER BY id ASC
  `;
  return rows as Candidate[];
}

export async function castVote(userId: number, candidateId: number) {
  const sql = getSql();
  const rows = await sql`
    WITH candidate_exists AS (
      SELECT id FROM candidates WHERE id = ${candidateId}
    ), updated_user AS (
      UPDATE users
      SET has_voted = TRUE, updated_at = NOW()
      WHERE id = ${userId}
        AND has_voted = FALSE
        AND face_verified_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM candidate_exists)
      RETURNING id
    ), new_voter AS (
      INSERT INTO voters (user_id, candidate_id)
      SELECT id, ${candidateId}
      FROM updated_user
      RETURNING id
    )
    UPDATE candidates
    SET votes = votes + 1, updated_at = NOW()
    WHERE id = ${candidateId} AND EXISTS (SELECT 1 FROM new_voter)
    RETURNING id
  `;
  return rows as Candidate[];
}

export async function getVoters(search = ""): Promise<VoterRecord[]> {
  const sql = getSql();
  const query = `%${search.trim()}%`;
  const rows = await sql`
    SELECT
      u.id,
      u.id::int AS "userRecordId",
      u.user_id AS "userId",
      u.display_name AS "displayName",
      u.role,
      u.has_voted AS "hasVoted",
      c.name AS "candidateName",
      u.email,
      u.whatsapp,
      u.study_program AS "studyProgram",
      u.cohort,
      u.graduation_year AS "graduationYear",
      u.domicile,
      u.face_template_encrypted IS NOT NULL AS "faceEnrolled",
      u.face_verified_at IS NOT NULL AS "faceVerified",
      u.face_enrolled_at::text AS "faceEnrolledAt",
      u.face_verified_at::text AS "faceVerifiedAt",
      u.registration_source AS "registrationSource",
      u.created_at::text AS "createdAt",
      u.updated_at::text AS "updatedAt"
    FROM users u
    LEFT JOIN voters v ON v.user_id = u.id
    LEFT JOIN candidates c ON c.id = v.candidate_id
    WHERE (${search.trim() === ""}
       OR u.user_id ILIKE ${query}
       OR c.name ILIKE ${query}
       OR u.display_name ILIKE ${query})
    ORDER BY u.created_at ASC
  `;
  return rows as VoterRecord[];
}

export async function getVoter(id: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      u.id,
      u.id::int AS "userRecordId",
      u.user_id AS "userId",
      u.display_name AS "displayName",
      u.role,
      u.has_voted AS "hasVoted",
      c.name AS "candidateName",
      u.email,
      u.whatsapp,
      u.study_program AS "studyProgram",
      u.cohort,
      u.graduation_year AS "graduationYear",
      u.domicile,
      u.face_template_encrypted IS NOT NULL AS "faceEnrolled",
      u.face_verified_at IS NOT NULL AS "faceVerified",
      u.face_enrolled_at::text AS "faceEnrolledAt",
      u.face_verified_at::text AS "faceVerifiedAt",
      u.registration_source AS "registrationSource",
      u.created_at::text AS "createdAt",
      u.updated_at::text AS "updatedAt"
    FROM users u
    LEFT JOIN voters v ON v.user_id = u.id
    LEFT JOIN candidates c ON c.id = v.candidate_id
    WHERE u.id = ${id}
    LIMIT 1
  `;
  return (rows[0] ?? null) as VoterRecord | null;
}

export async function getVotersForExport(): Promise<ExportVoterRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      u.id,
      u.id::int AS "userRecordId",
      u.user_id AS "userId",
      u.display_name AS "displayName",
      u.role,
      u.has_voted AS "hasVoted",
      c.name AS "candidateName",
      u.email,
      u.whatsapp,
      u.study_program AS "studyProgram",
      u.cohort,
      u.graduation_year AS "graduationYear",
      u.domicile,
      u.face_template_encrypted IS NOT NULL AS "faceEnrolled",
      u.face_verified_at IS NOT NULL AS "faceVerified",
      u.face_enrolled_at::text AS "faceEnrolledAt",
      u.face_verified_at::text AS "faceVerifiedAt",
      u.registration_source AS "registrationSource",
      u.created_at::text AS "createdAt",
      u.updated_at::text AS "updatedAt",
      u.face_template_encrypted AS "faceTemplateEncrypted"
    FROM users u
    LEFT JOIN voters v ON v.user_id = u.id
    LEFT JOIN candidates c ON c.id = v.candidate_id
    ORDER BY u.created_at ASC
  `;
  return rows as ExportVoterRecord[];
}

export async function importUsers(
  users: Array<{
    userId: string;
    displayName: string;
    passwordHash: string;
    updatePassword: boolean;
    email: string | null;
    whatsapp: string | null;
    studyProgram: string | null;
    cohort: string | null;
    graduationYear: string | null;
    domicile: string | null;
    faceTemplateEncrypted: string | null;
    faceEnrolledAt: string | null;
    faceVerifiedAt: string | null;
  }>
) {
  const sql = getSql();
  const payload = JSON.stringify(
    users.map((user) => ({
      user_id: user.userId,
      display_name: user.displayName,
      password_hash: user.passwordHash,
      update_password: user.updatePassword,
      email: user.email,
      whatsapp: user.whatsapp,
      study_program: user.studyProgram,
      cohort: user.cohort,
      graduation_year: user.graduationYear,
      domicile: user.domicile,
      face_template_encrypted: user.faceTemplateEncrypted,
      face_enrolled_at: user.faceEnrolledAt,
      face_verified_at: user.faceVerifiedAt
    }))
  );
  const rows = await sql`
    WITH imported AS (
      SELECT *
      FROM jsonb_to_recordset(${payload}::jsonb) AS source(
        user_id TEXT,
        display_name TEXT,
        password_hash TEXT,
        update_password BOOLEAN,
        email TEXT,
        whatsapp TEXT,
        study_program TEXT,
        cohort TEXT,
        graduation_year TEXT,
        domicile TEXT,
        face_template_encrypted TEXT,
        face_enrolled_at TIMESTAMPTZ,
        face_verified_at TIMESTAMPTZ
      )
    ), saved AS (
      INSERT INTO users (
        user_id, display_name, password_hash, role, has_voted,
        email, whatsapp, study_program, cohort, graduation_year, domicile,
        face_template_encrypted, face_enrolled_at, face_verified_at, registration_source
      )
      SELECT
        user_id, display_name, password_hash, 'Alumni', FALSE,
        email, whatsapp, study_program, cohort, graduation_year, domicile,
        face_template_encrypted, face_enrolled_at, face_verified_at,
        CASE WHEN update_password THEN 'ExcelLegacy' ELSE 'ExcelBackup' END
      FROM imported
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        password_hash = CASE
          WHEN EXCLUDED.registration_source = 'ExcelLegacy'
            THEN EXCLUDED.password_hash
          ELSE users.password_hash
        END,
        email = COALESCE(EXCLUDED.email, users.email),
        whatsapp = COALESCE(EXCLUDED.whatsapp, users.whatsapp),
        study_program = COALESCE(EXCLUDED.study_program, users.study_program),
        cohort = COALESCE(EXCLUDED.cohort, users.cohort),
        graduation_year = COALESCE(EXCLUDED.graduation_year, users.graduation_year),
        domicile = COALESCE(EXCLUDED.domicile, users.domicile),
        face_template_encrypted = CASE
          WHEN EXCLUDED.face_template_encrypted IS NOT NULL
            THEN EXCLUDED.face_template_encrypted
          ELSE users.face_template_encrypted
        END,
        face_enrolled_at = CASE
          WHEN EXCLUDED.face_template_encrypted IS NOT NULL
            THEN EXCLUDED.face_enrolled_at
          ELSE users.face_enrolled_at
        END,
        face_verified_at = CASE
          WHEN EXCLUDED.face_template_encrypted IS NOT NULL
            THEN EXCLUDED.face_verified_at
          ELSE users.face_verified_at
        END,
        updated_at = NOW()
      RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM saved
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function createPublicVoter(data: {
  userId: string;
  displayName: string;
  passwordHash: string;
  email: string;
  whatsapp: string;
  studyProgram: string;
  cohort: string;
  graduationYear: string | null;
  domicile: string | null;
  faceTemplateEncrypted: string;
}) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (
      user_id, password_hash, display_name, role, has_voted,
      email, whatsapp, study_program, cohort, graduation_year, domicile,
      face_template_encrypted, face_enrolled_at, face_verified_at, registration_source
    ) VALUES (
      ${data.userId}, ${data.passwordHash}, ${data.displayName}, 'Alumni', FALSE,
      ${data.email}, ${data.whatsapp}, ${data.studyProgram}, ${data.cohort},
      ${data.graduationYear}, ${data.domicile}, ${data.faceTemplateEncrypted},
      NOW(), NULL, 'PublicRegistration'
    )
    RETURNING id::int AS id
  `;
  return rows[0] as { id: number };
}

export async function getFaceVerificationRecord(userId: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      face_template_encrypted AS "faceTemplateEncrypted",
      face_enrolled_at::text AS "faceEnrolledAt",
      face_verified_at::text AS "faceVerifiedAt"
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  return (rows[0] ?? null) as
    | {
        faceTemplateEncrypted: string | null;
        faceEnrolledAt: string | null;
        faceVerifiedAt: string | null;
      }
    | null;
}

export async function enrollAndVerifyLegacyFace(userId: number, faceTemplateEncrypted: string) {
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET
      face_template_encrypted = ${faceTemplateEncrypted},
      face_enrolled_at = NOW(),
      face_verified_at = NOW(),
      updated_at = NOW()
    WHERE id = ${userId}
      AND face_template_encrypted IS NULL
      AND face_verified_at IS NULL
    RETURNING id
  `;
  return rows.length === 1;
}

export async function markFaceVerified(userId: number) {
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET face_verified_at = COALESCE(face_verified_at, NOW()), updated_at = NOW()
    WHERE id = ${userId}
      AND face_template_encrypted IS NOT NULL
    RETURNING id
  `;
  return rows.length === 1;
}

export async function createCandidate(data: Omit<Candidate, "id" | "votes">) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO candidates (
      name, vision, mission, featured_program, image, occupation, cohort, votes
    ) VALUES (
      ${data.name}, ${data.vision}, ${data.mission}, ${data.featuredProgram},
      ${data.image}, ${data.occupation}, ${data.cohort}, 0
    )
    RETURNING id
  `;
  return rows[0] as { id: number };
}

export async function getAdminStats(): Promise<AdminStats> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM users WHERE role = 'Alumni') AS voters,
      (SELECT COUNT(*)::int FROM users WHERE has_voted = TRUE) AS voted,
      (SELECT COUNT(*)::int FROM candidates) AS candidates,
      (SELECT COALESCE(SUM(votes), 0)::int FROM candidates) AS "totalVotes"
  `;
  return rows[0] as AdminStats;
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      u.id::int AS id,
      u.user_id AS "userId",
      u.display_name AS "displayName",
      u.role,
      u.has_voted AS "hasVoted"
    FROM users u
    ORDER BY u.created_at ASC
  `;
  return rows as AdminUserRecord[];
}

export async function createAdminUser(data: {
  userId: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
}) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (user_id, display_name, role, password_hash, has_voted)
    VALUES (${data.userId}, ${data.displayName}, ${data.role}, ${data.passwordHash}, FALSE)
    RETURNING id::int AS id
  `;
  return rows[0] as { id: number };
}

export async function updateAdminUser(
  id: number,
  data: { userId: string; displayName: string; role: UserRole; passwordHash: string | null }
) {
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET
      user_id = ${data.userId},
      display_name = ${data.displayName},
      role = ${data.role},
      password_hash = COALESCE(${data.passwordHash}, password_hash),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length === 1;
}

export async function updateVoterAccount(
  id: number,
  data: { displayName: string; passwordHash: string | null }
) {
  const sql = getSql();
  const rows = await sql`
    UPDATE users
    SET
      display_name = ${data.displayName},
      password_hash = COALESCE(${data.passwordHash}, password_hash),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length === 1;
}

export async function deleteAdminUser(id: number) {
  const sql = getSql();
  const rows = await sql`
    WITH previous AS (
      SELECT u.id, u.has_voted, v.candidate_id
      FROM users u
      LEFT JOIN voters v ON v.user_id = u.id
      WHERE u.id = ${id}
    ), removed_user AS (
      DELETE FROM users WHERE id = (SELECT id FROM previous)
      RETURNING id
    ), reduced AS (
      UPDATE candidates
      SET votes = GREATEST(votes - 1, 0), updated_at = NOW()
      WHERE id = (SELECT candidate_id FROM previous)
        AND (SELECT has_voted FROM previous) = TRUE
      RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM removed_user
  `;
  return Number(rows[0]?.count ?? 0) === 1;
}

export async function resetUserVote(id: number) {
  const sql = getSql();
  const rows = await sql`
    WITH previous AS (
      SELECT u.id, v.candidate_id
      FROM users u
      JOIN voters v ON v.user_id = u.id
      WHERE u.id = ${id} AND u.has_voted = TRUE
      FOR UPDATE OF u, v
    ), reset_user AS (
      UPDATE users
      SET has_voted = FALSE, updated_at = NOW()
      WHERE id = (SELECT id FROM previous)
      RETURNING id
    ), reset_voter AS (
      DELETE FROM voters
      WHERE user_id = (SELECT id FROM previous)
      RETURNING id
    ), reduced AS (
      UPDATE candidates
      SET votes = GREATEST(votes - 1, 0), updated_at = NOW()
      WHERE id = (SELECT candidate_id FROM previous)
      RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM reset_user
  `;
  return Number(rows[0]?.count ?? 0) === 1;
}

export async function updateCandidate(
  id: number,
  data: Omit<Candidate, "id" | "votes" | "image"> & { image: string | null }
) {
  const sql = getSql();
  const rows = await sql`
    UPDATE candidates
    SET
      name = ${data.name},
      vision = ${data.vision},
      mission = ${data.mission},
      featured_program = ${data.featuredProgram},
      image = COALESCE(${data.image}, image),
      occupation = ${data.occupation},
      cohort = ${data.cohort},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length === 1;
}

export async function deleteCandidate(id: number) {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM candidates c
    WHERE c.id = ${id}
      AND c.votes = 0
      AND NOT EXISTS (SELECT 1 FROM voters v WHERE v.candidate_id = c.id)
    RETURNING id
  `;
  return rows.length === 1;
}
