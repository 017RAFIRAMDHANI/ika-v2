export const FACE_CHALLENGE_STEPS = ["blink", "turn-left", "turn-right", "center"] as const;

export type FaceChallengeStep = (typeof FACE_CHALLENGE_STEPS)[number];

export type FaceChallengeMode = "register" | "enroll" | "verify";

export type FaceEvidence = {
  startedAt: number;
  completedAt: number;
  completedSteps: FaceChallengeStep[];
  sampleCount: number;
  averageReal: number;
  averageLive: number;
};

export type FaceCapturePayload = {
  embedding: number[];
  challengeToken: string;
  evidence: FaceEvidence;
};

export type FaceChallengeResponse = {
  ok: true;
  token: string;
  steps: FaceChallengeStep[];
  expiresAt: number;
};
