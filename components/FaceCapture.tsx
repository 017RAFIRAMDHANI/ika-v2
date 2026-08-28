"use client";

import { useEffect, useRef, useState } from "react";
import type Human from "@vladmandic/human";
import type { Config } from "@vladmandic/human";
import LoadingButton from "@/components/LoadingButton";
import type {
  FaceCapturePayload,
  FaceChallengeMode,
  FaceChallengeResponse,
  FaceChallengeStep
} from "@/lib/face-types";

const MIN_QUALITY_SCORE = 0.5;
const HOLD_DURATION_MS = 450;

const stepLabels: Record<FaceChallengeStep, string> = {
  blink: "Kedipkan kedua mata satu kali",
  "turn-left": "Tengokkan wajah ke kiri",
  "turn-right": "Tengokkan wajah ke kanan",
  center: "Kembali menghadap lurus ke kamera"
};

const modelConfig: Partial<Config> = {
  backend: "webgl",
  modelBasePath: "/models/human/",
  // Model wajah disimpan bersama aplikasi. Hindari model lama/rusak dari
  // IndexedDB browser, karena GraphModel tanpa executor akan gagal saat
  // membaca `inputNodes`.
  cacheModels: false,
  validateModels: false,
  async: false,
  warmup: "none",
  cacheSensitivity: 0,
  filter: { enabled: true, equalization: true, flip: false },
  face: {
    enabled: true,
    detector: {
      rotation: true,
      maxDetected: 2,
      minConfidence: 0.5,
      minSize: 120,
      skipFrames: 0,
      skipTime: 0
    },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true, skipFrames: 0, skipTime: 0 },
    emotion: { enabled: false },
    antispoof: { enabled: true, skipFrames: 0, skipTime: 0 },
    liveness: { enabled: true, skipFrames: 0, skipTime: 0 }
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true }
};

type Phase = "idle" | "loading" | "scanning" | "processing" | "complete" | "error";

export default function FaceCapture({
  mode,
  onComplete,
  onReset,
  compact = false
}: {
  mode: FaceChallengeMode;
  onComplete: (payload: FaceCapturePayload) => void | Promise<void>;
  onReset?: () => void;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<Human | null>(null);
  const runIdRef = useRef(0);
  const stepIndexRef = useRef(0);
  const holdStartRef = useRef(0);
  const blinkClosedRef = useRef(false);
  const completedStepsRef = useRef<FaceChallengeStep[]>([]);
  const scoresRef = useRef({ real: 0, live: 0, count: 0 });
  const latestEmbeddingRef = useRef<number[] | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Kamera hanya aktif saat proses verifikasi berlangsung.");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<FaceChallengeStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function resetRun() {
    runIdRef.current += 1;
    stopCamera();
    stepIndexRef.current = 0;
    holdStartRef.current = 0;
    blinkClosedRef.current = false;
    completedStepsRef.current = [];
    scoresRef.current = { real: 0, live: 0, count: 0 };
    latestEmbeddingRef.current = null;
    setCurrentStep(0);
  }

  useEffect(() => () => {
    runIdRef.current += 1;
    stopCamera();
  }, []);

  async function start() {
    onReset?.();
    resetRun();
    const runId = runIdRef.current;
    setPhase("loading");
    setError("");
    setMessage("Menyiapkan model biometrik dan kamera…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser ini tidak mendukung akses kamera. Gunakan Chrome, Edge, atau Safari versi terbaru.");
      }

      const challengeRequest = fetch(`/api/face/challenge?mode=${mode}`, {
        credentials: "same-origin",
        cache: "no-store"
      }).then(async (response) => {
        const data = await response.json() as FaceChallengeResponse & { message?: string };
        if (!response.ok) throw new Error(data.message || "Sesi verifikasi wajah tidak dapat dibuat.");
        return data;
      });

      const cameraRequest = navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 }
        },
        audio: false
      }).then((stream) => {
        if (runId === runIdRef.current) streamRef.current = stream;
        else stream.getTracks().forEach((track) => track.stop());
        return stream;
      });

      const humanRequest = (async () => {
        if (humanRef.current) return humanRef.current;
        const humanModule = await import("@vladmandic/human");
        const human = new humanModule.default(modelConfig);
        await human.init();
        await human.load();

        const requiredModels = ["blazeface", "facemesh", "iris", "faceres", "antispoof", "liveness"];
        const unavailableModels = requiredModels.filter((name) => {
          const model = human.models.models[name];
          try {
            return !model?.inputs?.length;
          } catch {
            return true;
          }
        });
        if (unavailableModels.length > 0) {
          throw new Error("Model verifikasi wajah belum termuat lengkap. Muat ulang halaman lalu coba kembali.");
        }

        humanRef.current = human;
        return human;
      })();

      const [challenge, stream, human] = await Promise.all([challengeRequest, cameraRequest, humanRequest]);
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) throw new Error("Elemen kamera tidak tersedia.");
      video.srcObject = stream;
      await video.play();

      setSteps(challenge.steps);
      setPhase("scanning");
      setMessage(stepLabels[challenge.steps[0]]);
      const startedAt = Date.now();

      while (runId === runIdRef.current && stepIndexRef.current < challenge.steps.length) {
        const result = await human.detect(video);
        if (runId !== runIdRef.current) return;

        if (result.face.length !== 1) {
          holdStartRef.current = 0;
          setMessage(result.face.length > 1 ? "Pastikan hanya satu wajah terlihat." : "Posisikan wajah di dalam bingkai kamera.");
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          continue;
        }

        const face = result.face[0];
        const confidence = face.faceScore || face.boxScore || 0;
        const real = face.real ?? 0;
        const live = face.live ?? 0;
        const faceSize = Math.min(face.box[2], face.box[3]);
        if (confidence < MIN_QUALITY_SCORE || real < MIN_QUALITY_SCORE || live < MIN_QUALITY_SCORE || faceSize < 120) {
          holdStartRef.current = 0;
          setMessage("Dekatkan wajah, gunakan cahaya cukup, dan jangan gunakan foto atau rekaman.");
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          continue;
        }

        scoresRef.current.real += real;
        scoresRef.current.live += live;
        scoresRef.current.count += 1;
        if (face.embedding?.length === 1024) latestEmbeddingRef.current = [...face.embedding];

        const gestures = result.gesture
          .filter((item) => "face" in item)
          .map((item) => item.gesture);
        const step = challenge.steps[stepIndexRef.current];
        let completed = false;

        if (step === "blink") {
          const eyesClosed = gestures.includes("blink left eye") || gestures.includes("blink right eye");
          if (eyesClosed) blinkClosedRef.current = true;
          completed = blinkClosedRef.current && !eyesClosed;
        } else {
          const yaw = face.rotation?.angle.yaw ?? 0;
          const condition = step === "turn-left"
            ? gestures.includes("facing left") || yaw > 0.25
            : step === "turn-right"
              ? gestures.includes("facing right") || yaw < -0.25
              : gestures.includes("facing center") || Math.abs(yaw) < 0.16;
          if (condition) {
            if (!holdStartRef.current) holdStartRef.current = Date.now();
            completed = Date.now() - holdStartRef.current >= HOLD_DURATION_MS;
          } else {
            holdStartRef.current = 0;
          }
        }

        if (completed) {
          completedStepsRef.current.push(step);
          stepIndexRef.current += 1;
          holdStartRef.current = 0;
          blinkClosedRef.current = false;
          setCurrentStep(stepIndexRef.current);
          if (stepIndexRef.current < challenge.steps.length) {
            setMessage(stepLabels[challenge.steps[stepIndexRef.current]]);
          }
        } else {
          setMessage(stepLabels[step]);
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }

      const embedding = latestEmbeddingRef.current;
      const score = scoresRef.current;
      if (!embedding || score.count < challenge.steps.length) {
        throw new Error("Descriptor wajah belum terbaca dengan baik. Silakan ulangi pemindaian.");
      }

      stopCamera();
      setPhase("processing");
      setMessage("Memvalidasi hasil pemindaian…");
      await onComplete({
        embedding,
        challengeToken: challenge.token,
        evidence: {
          startedAt,
          completedAt: Date.now(),
          completedSteps: completedStepsRef.current,
          sampleCount: score.count,
          averageReal: score.real / score.count,
          averageLive: score.live / score.count
        }
      });
      if (runId === runIdRef.current) {
        setPhase("complete");
        setMessage(mode === "register" ? "Data wajah siap disertakan dalam pendaftaran." : "Verifikasi wajah berhasil.");
      }
    } catch (caught) {
      if (runId !== runIdRef.current) return;
      stopCamera();
      setPhase("error");
      const cameraError = caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "PermissionDeniedError");
      setError(cameraError
        ? "Izin kamera ditolak. Izinkan akses kamera pada pengaturan browser lalu coba lagi."
        : caught instanceof Error ? caught.message : "Pemindaian wajah gagal.");
    }
  }

  const active = phase === "loading" || phase === "scanning" || phase === "processing";

  return (
    <section className={`face-capture ${compact ? "face-capture-compact" : ""}`}>
      <div className="face-camera">
        <video ref={videoRef} muted playsInline aria-label="Pratinjau kamera verifikasi wajah" />
        <div className="face-oval" aria-hidden="true" />
        {phase !== "scanning" && (
          <div className="face-camera-placeholder">
            <i className={`bx ${phase === "complete" ? "bx-check-shield" : "bx-scan"}`} />
          </div>
        )}
      </div>

      <div className="face-capture-info">
        <div className="face-progress" aria-label="Kemajuan pemeriksaan liveness">
          {(steps.length ? steps : ["blink", "turn-left", "turn-right", "center"]).map((step, index) => (
            <span key={`${step}-${index}`} className={index < currentStep || phase === "complete" ? "done" : index === currentStep && phase === "scanning" ? "active" : ""}>
              {index < currentStep || phase === "complete" ? <i className="bx bx-check" /> : index + 1}
            </span>
          ))}
        </div>
        <strong>{phase === "idle" ? "Verifikasi liveness dan kecocokan wajah" : message}</strong>
        <p>Pastikan hanya satu wajah terlihat, lepaskan masker atau kacamata gelap, dan gunakan pencahayaan dari arah depan.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {phase === "complete" && <div className="alert alert-success" role="status">{message}</div>}
        <div className="face-actions">
          <LoadingButton busy={active} type="button" className="app-btn app-btn-primary" onClick={start}>
            <i className="bx bx-camera" /> {phase === "idle" ? "Mulai Pemindaian" : phase === "complete" ? "Pindai Ulang" : "Coba Lagi"}
          </LoadingButton>
          {active && phase !== "processing" && (
            <button type="button" className="app-btn app-btn-soft" onClick={() => { onReset?.(); resetRun(); setPhase("idle"); setMessage("Kamera hanya aktif saat proses verifikasi berlangsung."); }}>
              Batal
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
