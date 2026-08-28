"use client";

import { useRouter } from "next/navigation";
import FaceCapture from "@/components/FaceCapture";
import type { FaceCapturePayload } from "@/lib/face-types";

export default function FaceGate({ faceEnrolled }: { faceEnrolled: boolean }) {
  const router = useRouter();
  const mode = faceEnrolled ? "verify" : "enroll";

  async function complete(payload: FaceCapturePayload) {
    const response = await fetch(`/api/face/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({
      ok: false,
      message: `Server mengembalikan respons yang tidak valid (${response.status}).`
    })) as { ok: boolean; message?: string };
    if (!response.ok) throw new Error(result.message || "Verifikasi wajah gagal.");
    router.refresh();
  }

  return (
    <section className="face-gate app-card card-pad">
      <div className="face-gate-heading">
        <span className="face-gate-icon"><i className="bx bx-face" /></span>
        <div>
          <span className="eyebrow">Pemeriksaan Keamanan Satu Kali</span>
          <h2>{faceEnrolled ? "Verifikasi Wajah untuk Membuka Bilik Suara" : "Aktivasi Verifikasi Wajah"}</h2>
          <p>
            {faceEnrolled
              ? "Selesaikan pemeriksaan liveness. Sistem akan mencocokkan wajah dengan data yang terdaftar dan tidak akan meminta ulang setelah berhasil."
              : "Akun lama ini belum memiliki data wajah. Selesaikan liveness untuk mendaftarkan wajah sekaligus mengaktifkan akses bilik suara."}
          </p>
        </div>
      </div>
      <FaceCapture mode={mode} onComplete={complete} compact />
      <div className="face-privacy-note"><i className="bx bx-lock-alt" /> Descriptor wajah disimpan terenkripsi; foto atau rekaman kamera tidak diunggah dan tidak disimpan.</div>
    </section>
  );
}
