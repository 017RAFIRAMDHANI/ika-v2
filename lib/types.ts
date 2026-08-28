export type UserRole = "Alumni" | "Admin";

export type SessionUser = {
  id: number;
  userId: string;
  displayName: string;
  role: UserRole;
  hasVoted: boolean;
  faceEnrolled: boolean;
  faceVerified: boolean;
};

export type Candidate = {
  id: number;
  name: string;
  vision: string;
  mission: string;
  featuredProgram: string;
  image: string;
  occupation: string;
  cohort: string;
  votes: number;
};

export type VoterRecord = {
  id: number;
  userRecordId: number | null;
  userId: string | null;
  displayName: string | null;
  role: UserRole;
  hasVoted: boolean | null;
  candidateName: string | null;
  email: string | null;
  whatsapp: string | null;
  studyProgram: string | null;
  cohort: string | null;
  graduationYear: string | null;
  domicile: string | null;
  faceEnrolled: boolean;
  faceVerified: boolean;
  faceEnrolledAt: string | null;
  faceVerifiedAt: string | null;
  registrationSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExportVoterRecord = VoterRecord & {
  faceTemplateEncrypted: string | null;
};

export type AdminUserRecord = {
  id: number;
  userId: string;
  displayName: string;
  role: UserRole;
  hasVoted: boolean;
};

export type AdminStats = {
  users: number;
  voters: number;
  voted: number;
  candidates: number;
  totalVotes: number;
};
