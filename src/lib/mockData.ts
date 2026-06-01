export type MockUser = {
  id: string;
  username: string;
  email: string;
  role: string;
};

export type MockInterview = {
  id: number;
  jobRole: string;
  examinerEmpId: string;
  startTime?: string | null;
  endTime?: string | null;
};

export type MockInterviewCandidate = {
  id: number;
  jobId: number;
  userId: string;
};

export type MockQuestion = {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  // Legacy fields for questioner page compatibility
  prompt: string;
  example: string;
  exampleAns: string;
  testcase: string;
  testcaseAns: string;
  authorUserId: number;
};

function normalizeDifficulty(value: unknown): string {
  const raw = String(value ?? "EASY").trim().toUpperCase();
  if (raw === "EASY" || raw === "MEDIUM" || raw === "HARD") return raw;
  return "EASY";
}

export type MockAssignment = {
  id: number;
  problemId: number;
  userId: string;
  // Legacy fields for questioner page compatibility
  questionId: number;
  jobId: number;
};

export type MockDbPayload = {
  users: MockUser[];
  interviews: MockInterview[];
  interviewCandidates: MockInterviewCandidate[];
  questions: MockQuestion[];
  assignments: MockAssignment[];
};

export const EMPTY_MOCK_DATA: MockDbPayload = {
  users: [],
  interviews: [],
  interviewCandidates: [],
  questions: [],
  assignments: [],
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (normalizedToken) {
    headers["Authorization"] = `Bearer ${normalizedToken}`;
  }
  return headers;
}

function extractList(raw: unknown): Array<Record<string, unknown>> {
  const pickFromObject = (obj: Record<string, unknown>): Array<Record<string, unknown>> => {
    const keys = [
      "items",
      "data",
      "list",
      "results",
      "rows",
      "problems",
      "users",
      "interviews",
      "assignments",
      "interviewCandidates",
      "interview_candidates",
    ];
    for (const key of keys) {
      const value = obj[key];
      if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
      if (value && typeof value === "object") {
        const nested = pickFromObject(value as Record<string, unknown>);
        if (nested.length > 0) return nested;
      }
    }
    return [];
  };

  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (!raw || typeof raw !== "object") return [];
  return pickFromObject(raw as Record<string, unknown>);
}

// ── GET: Fetch all data ────────────────────────────────────

export const fetchMockData = async (token?: string | null): Promise<MockDbPayload> => {
  const headers = authHeaders(token);

  const [usersRes, interviewsRes, problemsRes, candidatesRes, assignmentsRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/v1/users`, { cache: "no-store", headers }),
    fetch(`${API_BASE_URL}/api/v1/interviews`, { cache: "no-store", headers }),
    fetch(`${API_BASE_URL}/api/v1/problems`, { cache: "no-store", headers }),
    fetch(`${API_BASE_URL}/api/v1/interview-candidates`, { cache: "no-store", headers }),
    fetch(`${API_BASE_URL}/api/v1/assignments`, { cache: "no-store", headers }),
  ]);

  // Users: backend returns array of { id, email, name, empId, isAdmin, isCandidate, ... }
  const usersRaw = usersRes.ok ? await usersRes.json() : [];
  const usersList = extractList(usersRaw);
  const users = (usersList as Array<Record<string, unknown>>).map((u) => {
    const rawRole = String(u.role ?? "").toUpperCase();
    let role = rawRole || "CANDIDATE";
    if (!rawRole) {
      if (u.isAdmin) role = "ADMIN";
      else if (u.isExaminer) role = "EXAMINER";
      else if (u.isQuestioner) role = "QUESTIONER";
      else if (u.isCandidate) role = "CANDIDATE";
    }

    return {
      id: String(u.id),
      username: (u.username ?? u.name ?? u.email ?? "") as string,
      email: (u.email ?? "") as string,
      role,
    };
  }) as MockUser[];

  // Interviews: backend returns direct array, id as string
  const interviewsRaw = interviewsRes.ok ? await interviewsRes.json() : [];
  const interviewsList = extractList(interviewsRaw);
  const interviews = (interviewsList as Array<Record<string, unknown>>).map((i) => ({
    id: Number(i.id),
    jobRole: (i.jobRole ?? "") as string,
    examinerEmpId: (i.examinerEmpId ?? "") as string,
    startTime: (i.startTime as string) ?? null,
    endTime: (i.endTime as string) ?? null,
  })) as MockInterview[];

  // Problems: backend returns array of { id, title, prompt, example, exampleAns, testcase, testcaseAns, authorUserId }
  const problemsRaw = problemsRes.ok ? await problemsRes.json() : [];
  const problemsList = extractList(problemsRaw);
  const questions = (problemsList as Array<Record<string, unknown>>)
    .map((p) => {
      const parsedId = Number(p.id ?? p.problem_id);
      if (!Number.isFinite(parsedId)) return null;
      return {
        id: parsedId,
        title: String(p.title ?? p.problem_title ?? p.problemTitle ?? p.name ?? ""),
        description: String(p.description ?? p.problem_description ?? p.prompt ?? ""),
        difficulty: normalizeDifficulty(p.difficulty),
        prompt: String(p.prompt ?? p.description ?? ""),
        example: (p.example ?? p.sample_input ?? "") as string,
        exampleAns: (p.exampleAns ?? p.sample_output ?? "") as string,
        testcase: (p.testcase ?? "") as string,
        testcaseAns: (p.testcaseAns ?? "") as string,
        authorUserId: Number(p.authorUserId ?? 0),
      };
    })
    .filter((q): q is MockQuestion => q !== null);

  // Interview Candidates: backend returns array of { id, jobId, userId }
  const candidatesRaw = candidatesRes.ok ? await candidatesRes.json() : [];
  const candidatesList = extractList(candidatesRaw);
  const interviewCandidates = (candidatesList as Array<Record<string, unknown>>).map((c) => ({
    id: Number(c.id),
    jobId: Number(c.jobId),
    userId: String(c.userId ?? ""),
  })) as MockInterviewCandidate[];

  // Assignments: backend returns array of { id, jobId, userId, questionId }
  const assignmentsRaw = assignmentsRes.ok ? await assignmentsRes.json() : [];
  const assignmentsList = extractList(assignmentsRaw);
  const assignments = (assignmentsList as Array<Record<string, unknown>>).map((a) => ({
    id: Number(a.id),
    problemId: Number(a.questionId ?? a.problemId ?? a.problem_id),
    userId: String(a.userId ?? ""),
    questionId: Number(a.questionId ?? a.problemId ?? a.problem_id),
    jobId: Number(a.jobId ?? a.job_id ?? 0),
  })) as MockAssignment[];

  return {
    users,
    interviews,
    interviewCandidates,
    questions,
    assignments,
  };
};

// ── Interviews ─────────────────────────────────────────────

// POST /api/v1/interviews
// Request: { jobRole: string, examinerEmpId: string }
// Response: { id: 1, jobRole: "...", examinerEmpId: "..." }
export const createInterview = async (
  payload: {
    jobRole: string;
    candidateUserId?: string;
    problemCounts?: { easy?: number; medium?: number; hard?: number };
  },
  token?: string | null
): Promise<MockInterview> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/interviews`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let details = "";
    try {
      const errBody = await response.json();
      details = Array.isArray(errBody?.message)
        ? errBody.message.join(", ")
        : String(errBody?.message ?? "");
    } catch {
      details = await response.text();
    }
    throw new Error(`Failed to create interview: ${response.status}${details ? ` - ${details}` : ""}`);
  }
  const raw = await response.json();
  return {
    id: Number(raw.id),
    jobRole: raw.jobRole,
    examinerEmpId: raw.examinerEmpId,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
  };
};

// PATCH /api/v1/interviews/:id
// Request: { jobRole: string }
export const updateInterview = async (
  id: number,
  payload: { jobRole: string },
  token?: string | null
): Promise<MockInterview> => {
  const request = async (body: Record<string, unknown>) =>
    fetch(`${API_BASE_URL}/api/v1/interviews/${id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });

  let response = await request({ jobRole: payload.jobRole });
  if (!response.ok && response.status === 400) {
    response = await request({ job_role: payload.jobRole });
  }

  if (!response.ok) {
    let details = "";
    try {
      const errBody = await response.json();
      details = typeof errBody?.message === "string" ? errBody.message : JSON.stringify(errBody);
    } catch {
      details = await response.text();
    }
    throw new Error(`Failed to update interview: ${response.status}${details ? ` - ${details}` : ""}`);
  }

  const raw = await response.json();
  return {
    id: Number(raw.id),
    jobRole: raw.jobRole,
    examinerEmpId: raw.examinerEmpId,
  };
};

// DELETE /api/v1/interviews/:id
export const deleteInterview = async (id: number, token?: string | null): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/interviews/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete interview: ${response.status}`);
  }
};

// ── Interview Candidates ───────────────────────────────────

// POST /api/v1/interview-candidates
// Request: { interviewId: number, userId: string }
export const addCandidateToInterview = async (
  payload: { jobId: number; userId: string },
  token?: string | null
): Promise<MockInterviewCandidate> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/interview-candidates`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to add candidate: ${response.status}`);
  }
  const raw = await response.json();
  return {
    id: Number(raw.id),
    jobId: Number(raw.jobId),
    userId: raw.userId,
  };
};

// DELETE /api/v1/interview-candidates/:id
export const deleteCandidate = async (id: number, token?: string | null): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/interview-candidates/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete candidate: ${response.status}`);
  }
};

// ── Assignments ────────────────────────────────────────────

// POST /assignments
// Request: { jobId: number, userId: number, questionId: number }
// Response: { id, jobId, userId, questionId }
export const createAssignment = async (
  payload: { jobId: number; userId: string; problemId: number },
  token?: string | null
): Promise<MockAssignment> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assignments`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      jobId: payload.jobId,
      userId: payload.userId,
      problemId: payload.problemId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create assignment: ${response.status}`);
  }
  const raw = await response.json();
    return {
      id: Number(raw.id),
    problemId: Number(raw.questionId ?? raw.problemId ?? raw.problem_id),
    userId: String(raw.userId),
    questionId: Number(raw.questionId ?? raw.problemId ?? raw.problem_id),
    jobId: Number(raw.jobId ?? raw.job_id ?? raw.interviewId),
  };
};

// DELETE /api/v1/assignments/:id
export const deleteAssignment = async (id: number, token?: string | null): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assignments/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete assignment: ${response.status}`);
  }
};

// ── Fetch single problem detail ────────────────────────────

export type QuestionDetail = {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  functionName: string;
  constraints: { timeLimitMs: string; memoryLimitMb: string };
  sampleTestCases: Array<{ input: string; output: string }>;
};

export const fetchQuestionDetail = async (
  id: number,
  token?: string | null
): Promise<QuestionDetail | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/problems/${id}`, {
      cache: "no-store",
      headers: authHeaders(token),
    });
    if (!response.ok) return null;
    const raw = await response.json();
    return {
      id: Number(raw.id ?? raw.problem_id),
      title: (raw.title ?? "") as string,
      description: (raw.description ?? "") as string,
      difficulty: (raw.difficulty ?? "EASY") as string,
      functionName: (raw.function_name ?? "") as string,
      constraints: {
        timeLimitMs: String(raw.constraints?.time_limit_ms ?? "1000"),
        memoryLimitMb: String(raw.constraints?.memory_limit_mb ?? "256"),
      },
      sampleTestCases: raw.sample_test_cases
        ? Array.isArray(raw.sample_test_cases) ? raw.sample_test_cases : [{ input: "", output: "" }]
        : [],
    };
  } catch {
    return null;
  }
};

// ── Helpers ────────────────────────────────────────────────

export const getUserById = (users: MockUser[], id: string) =>
  users.find((user) => user.id === id) ?? null;

export const getInterviewById = (interviews: MockInterview[], id: number) =>
  interviews.find((interview) => interview.id === id) ?? null;

export const getQuestionById = (questions: MockQuestion[], id: number) =>
  questions.find((question) => question.id === id) ?? null;
