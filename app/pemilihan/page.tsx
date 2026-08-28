import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import FaceGate from "@/components/FaceGate";
import VotingForm from "@/components/VotingForm";
import { getCandidates } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VotingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.hasVoted) {
    return (
      <AppShell user={user}>
        <section className="success-screen">
          <div className="success-inner">
            <div className="success-check">
              <svg className="animated-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Voting Berhasil!</h1>
            <p>Hak suara akun Anda sudah tercatat oleh sistem. Sesuai aturan aplikasi, akun yang sudah memilih tidak dapat mengirim suara kedua.</p>
            <div className="success-ticket">
              <div className="success-ticket-row"><span>Status</span><strong>Suara Tercatat</strong></div>
              <div className="success-ticket-row"><span>Nama Pemilih</span><strong>{user.displayName}</strong></div>
              <div className="success-ticket-row"><span>User ID</span><strong>{user.userId}</strong></div>
            </div>
            <Link href="/" className="app-btn app-btn-gold">Kembali ke Beranda <i className="bx bx-home-alt" /></Link>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!user.faceVerified) {
    return (
      <AppShell user={user}>
        <div className="voting-page-head">
          <Link href="/" className="back-link"><i className="bx bx-left-arrow-alt" /> Kembali ke dashboard</Link>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Verifikasi Identitas</span>
          <h1>Bilik Suara Terkunci</h1>
          <p>Verifikasi wajah satu kali diperlukan sebelum kandidat dapat ditampilkan.</p>
        </div>
        <FaceGate faceEnrolled={user.faceEnrolled} />
      </AppShell>
    );
  }

  const candidates = await getCandidates();
  return (
    <AppShell user={user}>
      <div className="voting-page-head">
        <Link href="/" className="back-link"><i className="bx bx-left-arrow-alt" /> Kembali ke dashboard</Link>
        <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Gunakan Hak Suara</span>
        <h1>Bilik Suara</h1>
        <p>Pelajari seluruh informasi kandidat sebelum mengirim pilihan.</p>
      </div>
      <VotingForm candidates={candidates} />
    </AppShell>
  );
}
