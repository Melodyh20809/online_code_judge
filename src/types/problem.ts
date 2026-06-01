export type ApiDifficulty = "EASY" | "MEDIUM" | "HARD";
export type UiDifficulty = "Easy" | "Medium" | "Hard";
export type ProblemStatus = "draft" | "published" | "locked" | "archived";

export type ProblemTestCase = {
  id?: string | number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  orderIndex?: number;
};

export type BackendUser = {
  id: string;
  email: string;
  username?: string;
  name: string;
  empId: string | null;
  isAdmin: boolean;
  isCandidate: boolean;
  isExaminer: boolean;
  isQuestioner: boolean;
};

export type BackendProblem = {
  id: number;
  title: string;
  difficulty?: ApiDifficulty;
  prompt: string;
  example: string;
  exampleAns: string;
  testcase: string;
  testcaseAns: string;
  inputFormat?: string;
  outputFormat?: string;
  allowedLanguages?: string[];
  status?: ProblemStatus;
  testCases?: ProblemTestCase[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  authorId?: string | null;
  authorUserId: number;
  author?: Pick<BackendUser, "id" | "email" | "username" | "name" | "empId" | "isQuestioner">;
};

export type ProblemListResponse = BackendProblem[];
export type ProblemDetailResponse = BackendProblem;

export type BackendInterview = {
  id: number;
  jobRole: string;
  examinerEmpId: string;
  durationMinutes?: number;
};

export type BackendAssignment = {
  id: string;
  jobId: string;
  userId: string;
  questionId: number;
  interview?: BackendInterview;
  question?: BackendProblem;
  user?: Pick<BackendUser, "id" | "email" | "name" | "empId" | "isCandidate">;
};

export type SubmissionStatus =
  | "PENDING"
  | "COMPILING"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TLE"
  | "MLE"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export type BackendSubmission = {
  id: string;
  assignmentId?: string;
  userId?: string;
  questionId: number;
  language: string;
  code: string;
  status: SubmissionStatus;
  stdout: string;
  stderr: string;
  expectedOutput: string;
  score: number;
  executionTimeMs: number | null;
  createdAt?: string;
  updatedAt?: string;
  assignment?: BackendAssignment;
  question?: BackendProblem;
  user?: Pick<BackendUser, "id" | "email" | "name" | "empId" | "isCandidate">;
};

export type CreateProblemPayload = Omit<BackendProblem, "id" | "author"> & {
  timeLimitMs?: number;
  testCases?: ProblemTestCase[];
};
export type CreateProblemResponse = BackendProblem;
export type UpdateProblemPayload = Partial<CreateProblemPayload>;

export type AssignProblemPayload = {
  jobId: string | number;
  userId: string;
  questionId: number;
};

export type AssignProblemResponse = BackendAssignment;

export type ProblemResultStats = {
  assignedCount: number;
  submittedCount: number;
  acceptedCount: number;
  failedCount: number;
  passRate: number;
  candidates: Array<{
    id: string;
    name: string;
    email: string;
    status: "Pending" | "Submitted" | "Accepted" | "Failed";
    passedCases: number;
    totalCases: number;
    interviewId?: string;
    interviewName?: string;
    submissionId?: string;
    score?: number;
    submittedAt?: string;
  }>;
};
