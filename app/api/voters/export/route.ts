import ExcelJS from "exceljs";
import { getVotersForExport } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/session";
import { jsonError } from "@/lib/security";

export async function GET() {
  const session = await getSessionUser();
  if (!isAdmin(session)) return jsonError("Akses ditolak.", 403);

  const voters = await getVotersForExport();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E-Voting IKA AN/AP FISIP UNPAD";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Data Pemilih");
  sheet.columns = [
    { header: "User ID", key: "userId", width: 20 },
    { header: "Nama Lengkap", key: "displayName", width: 32 },
    { header: "Program Studi", key: "studyProgram", width: 24 },
    { header: "Angkatan", key: "cohort", width: 12 },
    { header: "Tahun Lulus", key: "graduationYear", width: 14 },
    { header: "Email", key: "email", width: 30 },
    { header: "WhatsApp", key: "whatsapp", width: 20 },
    { header: "Domisili", key: "domicile", width: 24 },
    { header: "Status Memilih", key: "hasVoted", width: 18 },
    { header: "Calon Pilihan", key: "candidateName", width: 38 },
    { header: "Wajah Terdaftar", key: "faceEnrolled", width: 18 },
    { header: "Verifikasi Wajah", key: "faceVerified", width: 19 },
    { header: "Waktu Daftar Wajah", key: "faceEnrolledAt", width: 25 },
    { header: "Waktu Verifikasi Wajah", key: "faceVerifiedAt", width: 27 },
    { header: "Data Wajah Terenkripsi", key: "faceTemplateEncrypted", width: 28 }
  ];
  sheet.addRows(
    voters.map((voter) => ({
      userId: voter.userId ?? "-",
      displayName: voter.displayName ?? "-",
      studyProgram: voter.studyProgram ?? "-",
      cohort: voter.cohort ?? "-",
      graduationYear: voter.graduationYear ?? "-",
      email: voter.email ?? "-",
      whatsapp: voter.whatsapp ?? "-",
      domicile: voter.domicile ?? "-",
      hasVoted: voter.hasVoted ? "Sudah Memilih" : "Belum Memilih",
      candidateName: voter.candidateName ?? "-",
      faceEnrolled: voter.faceEnrolled ? "Terdaftar" : "Belum Terdaftar",
      faceVerified: voter.faceVerified ? "Terverifikasi" : "Belum Terverifikasi",
      faceEnrolledAt: voter.faceEnrolledAt ?? "-",
      faceVerifiedAt: voter.faceVerifiedAt ?? "-",
      faceTemplateEncrypted: voter.faceTemplateEncrypted ?? "-"
    }))
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF696CFF" } };
  sheet.autoFilter = { from: "A1", to: "O1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getColumn(15).hidden = true;
  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "middle", wrapText: rowNumber === 1 };
  });

  const guide = workbook.addWorksheet("Petunjuk Backup");
  guide.columns = [{ width: 24 }, { width: 92 }];
  guide.addRows([
    ["Kegunaan", "File ini dapat diimpor kembali melalui menu Import Excel. Biodata dan data wajah terenkripsi akan dipulihkan."],
    ["Password", "Password tidak diekspor. Akun yang dibuat ulang dari backup memakai password awal yang sama dengan User ID; akun yang masih ada tidak mengalami perubahan password."],
    ["Kunci enkripsi", "FACE_DATA_SECRET pada sistem tujuan harus sama dengan sistem asal agar data wajah dapat dipulihkan."],
    ["Kolom data wajah", "Kolom O disembunyikan agar lembar mudah dibaca. Jangan mengubah isinya jika file akan digunakan sebagai backup."],
    ["Keamanan", "Simpan file ini sebagai dokumen rahasia karena memuat data pribadi dan template biometrik terenkripsi."]
  ]);
  guide.getColumn(1).font = { bold: true, color: { argb: "FF0B132B" } };
  guide.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });

  const output = await workbook.xlsx.writeBuffer();
  return new Response(output as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="data_pemilih.xlsx"'
    }
  });
}
