import type {
  ApiDifficulty,
  AssignProblemPayload,
  AssignProblemResponse,
  BackendAssignment,
  BackendProblem,
  BackendSubmission,
  CreateProblemPayload,
  CreateProblemResponse,
  ProblemTestCase,
  ProblemDetailResponse,
  ProblemListResponse,
  ProblemResultStats,
  SubmissionStatus,
  UpdateProblemPayload,
} from "@/types/problem";

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;

const getErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const getAuthHeaders = (token?: string): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};

type BackendProblemListItem = {
  problem_id: string;
  title: string;
  difficulty: ApiDifficulty;
  status?: BackendProblem["status"];
  acceptance_rate: string;
  author?: { id: string; username: string; email: string } | null;
};

type BackendTestCase = {
  id?: string;
  input: string;
  output: string;
  is_hidden?: boolean;
  order_index?: number;
};

type BackendProblemDetail = {
  problem_id: string;
  title: string;
  description: string;
  input_format?: string;
  output_format?: string;
  difficulty: ApiDifficulty;
  status?: BackendProblem["status"];
  allowed_languages?: string[];
  function_name: string;
  constraints: {
    time_limit_ms: string;
    memory_limit_mb: string;
  };
  author?: { id: string; username: string; email: string } | null;
  sample_test_cases: BackendTestCase[];
};

type BackendAssignmentApi = {
  id: string;
  jobId: string;
  userId: string;
  problemId: string;
  createdAt?: string;
  interview?: { id: string; jobRole: string; examinerEmpId: string; durationMinutes?: number };
  problem?: { id: number; title: string; difficulty: ApiDifficulty };
  user?: { id: string; username: string; email: string };
};

type BackendSubmissionApi = {
  submission_id: string;
  id?: string;
  assignment_id?: string;
  problem_id?: string;
  problemId?: string | number;
  language?: string;
  status: SubmissionStatus;
  score?: string;
  user_answer?: string;
  execution_result?: string;
  compile_message?: string;
  metrics?: {
    execution_time_ms?: string;
    memory_usage_kb?: string;
  };
  submitted_at?: string;
  createdAt?: string;
};

const extractList = (raw: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  for (const key of ["items", "data", "list", "results", "rows", "submissions"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }

  return [];
};

const mapProblemDetail = (problem: BackendProblemDetail): BackendProblem => {
  const [firstCase] = problem.sample_test_cases;
  const testCases = mapTestCases(problem.sample_test_cases);

  return {
    id: Number(problem.problem_id),
    title: problem.title,
    difficulty: problem.difficulty,
    status: problem.status ?? "draft",
    prompt: problem.description,
    example: firstCase ? `Input: ${firstCase.input}` : "",
    exampleAns: firstCase ? `Output: ${firstCase.output}` : "",
    testcase: firstCase?.input ?? "",
    testcaseAns: firstCase?.output ?? "",
    inputFormat: problem.input_format ?? "",
    outputFormat: problem.output_format ?? "",
    allowedLanguages: problem.allowed_languages ?? ["javascript"],
    timeLimitMs: Number(problem.constraints.time_limit_ms),
    memoryLimitMb: Number(problem.constraints.memory_limit_mb),
    testCases,
    authorId: problem.author?.id ?? null,
    author: problem.author
      ? {
          id: problem.author.id,
          username: problem.author.username,
          name: problem.author.username,
          email: problem.author.email,
          empId: problem.author.id,
          isQuestioner: true,
        }
      : undefined,
    authorUserId: 0,
  };
};

const mapTestCases = (testCases: BackendTestCase[]): ProblemTestCase[] =>
  testCases.map((testCase, index) => ({
    id: testCase.id ?? index + 1,
    input: testCase.input,
    expectedOutput: testCase.output,
    isHidden: testCase.is_hidden ?? false,
    orderIndex: testCase.order_index ?? index,
  }));

const mapAssignment = (assignment: BackendAssignmentApi): BackendAssignment => ({
  id: assignment.id,
  jobId: assignment.jobId,
  userId: assignment.userId,
  questionId: Number(assignment.problemId),
  interview: assignment.interview
    ? {
        id: Number(assignment.interview.id),
        jobRole: assignment.interview.jobRole,
        examinerEmpId: assignment.interview.examinerEmpId,
        durationMinutes: assignment.interview.durationMinutes,
      }
    : undefined,
  question: assignment.problem
    ? {
        id: assignment.problem.id,
        title: assignment.problem.title,
        difficulty: assignment.problem.difficulty,
        prompt: "",
        example: "",
        exampleAns: "",
        testcase: "",
        testcaseAns: "",
        authorUserId: 0,
      }
    : undefined,
  user: assignment.user
    ? {
        id: assignment.user.id,
        name: assignment.user.username,
        email: assignment.user.email,
        empId: assignment.user.id,
        isCandidate: true,
      }
    : undefined,
});

const mapSubmission = (
  submission: BackendSubmissionApi,
  fallback?: {
    assignmentId?: string;
    userId?: string;
    questionId?: number;
    language?: string;
    code?: string;
  }
): BackendSubmission => ({
  id: submission.submission_id ?? submission.id ?? "",
  assignmentId: submission.assignment_id ?? fallback?.assignmentId,
  userId: fallback?.userId,
  questionId: Number(submission.problem_id ?? submission.problemId ?? fallback?.questionId ?? 0),
  language: submission.language ?? fallback?.language ?? "javascript",
  code: fallback?.code ?? "",
  status: submission.status,
  stdout: submission.user_answer ?? submission.execution_result ?? "",
  stderr: submission.compile_message ?? "",
  expectedOutput: "",
  score: Number(submission.score ?? 0),
  executionTimeMs: submission.metrics?.execution_time_ms
    ? Number(submission.metrics.execution_time_ms)
    : null,
  createdAt: submission.submitted_at ?? submission.createdAt,
});

export async function getProblems(): Promise<ProblemListResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/problems`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const payload = (await response.json()) as { items?: BackendProblemListItem[] };
  return (payload.items ?? []).map((problem) => ({
    id: Number(problem.problem_id),
    title: problem.title,
    difficulty: problem.difficulty,
    status: problem.status ?? "draft",
    prompt: "",
    example: "",
    exampleAns: "",
    testcase: "",
    testcaseAns: "",
    authorId: problem.author?.id ?? null,
    author: problem.author
      ? {
          id: problem.author.id,
          username: problem.author.username,
          name: problem.author.username,
          email: problem.author.email,
          empId: problem.author.id,
          isQuestioner: true,
        }
      : undefined,
    authorUserId: 0,
  }));
}

export async function getProblemDetail(id: number): Promise<ProblemDetailResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/problems/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return mapProblemDetail((await response.json()) as BackendProblemDetail);
}

export async function createProblem(
  payload: CreateProblemPayload,
  token?: string
): Promise<CreateProblemResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/problems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(token),
    },
    body: JSON.stringify({
      title: payload.title,
      description: payload.prompt,
      difficulty: payload.difficulty ?? "EASY",
      function_name: "solve",
      time_limit_ms: payload.timeLimitMs ?? 1000,
      memory_limit_mb: payload.memoryLimitMb ?? 256,
      test_cases: (payload.testCases?.length
        ? payload.testCases
        : [{ input: payload.testcase, expectedOutput: payload.testcaseAns, isHidden: false }]
      ).map((testCase, index) => ({
        input: testCase.input,
        output: testCase.expectedOutput,
        is_hidden: testCase.isHidden ?? index !== 0,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const created = (await response.json()) as { problem_id: string; title: string };
  return {
    id: Number(created.problem_id),
    title: created.title,
    difficulty: payload.difficulty,
    status: payload.status ?? "draft",
    prompt: payload.prompt,
    example: payload.example,
    exampleAns: payload.exampleAns,
    testcase: payload.testcase,
    testcaseAns: payload.testcaseAns,
    inputFormat: payload.inputFormat,
    outputFormat: payload.outputFormat,
    allowedLanguages: payload.allowedLanguages,
    timeLimitMs: payload.timeLimitMs,
    memoryLimitMb: payload.memoryLimitMb,
    testCases: payload.testCases,
    authorUserId: payload.authorUserId,
  };
}

export async function deleteProblem(id: number, token?: string): Promise<void> {
  const response = await fetch(`${API_V1_BASE_URL}/problems/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

export async function assignProblem(
  payload: AssignProblemPayload,
  token?: string
): Promise<AssignProblemResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/assignments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(token),
    },
    body: JSON.stringify({
      jobId: Number(payload.jobId),
      userId: payload.userId,
      problemId: payload.questionId,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return mapAssignment((await response.json()) as BackendAssignmentApi);
}

export async function updateProblem(
  id: number,
  payload: UpdateProblemPayload,
  token?: string
): Promise<ProblemDetailResponse> {
  void id;
  void payload;
  void token;
  throw new Error("The current backend does not support editing problems.");
}

export async function getProblemTestCases(
  id: number,
  token?: string
): Promise<ProblemTestCase[]> {
  void token;
  const detail = await getProblemDetail(id);
  return detail.testCases ?? [];
}

export async function getAssignments(): Promise<BackendAssignment[]> {
  const response = await fetch(`${API_V1_BASE_URL}/assignments`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const payload = (await response.json()) as BackendAssignmentApi[];
  return payload.map(mapAssignment);
}

export async function getAssignmentsByUser(userId: string): Promise<BackendAssignment[]> {
  const response = await fetch(`${API_V1_BASE_URL}/assignments/user/${userId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const payload = (await response.json()) as BackendAssignmentApi[];
  return payload.map(mapAssignment);
}

export async function getSubmissions(): Promise<BackendSubmission[]> {
  return [];
}

export async function getSubmissionsByUser(userId: string): Promise<BackendSubmission[]> {
  void userId;
  return [];
}

export async function getSubmission(id: string, token?: string): Promise<BackendSubmission> {
  const response = await fetch(`${API_V1_BASE_URL}/submissions/${id}`, {
    cache: "no-store",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return mapSubmission((await response.json()) as BackendSubmissionApi);
}

const isTerminalSubmissionStatus = (status: SubmissionStatus) =>
  !["PENDING", "COMPILING", "RUNNING"].includes(status);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createSubmission(payload: {
  assignmentId: string;
  userId: string;
  language: "javascript";
  code: string;
  token?: string;
  questionId: number;
}): Promise<BackendSubmission> {
  const response = await fetch(`${API_V1_BASE_URL}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(payload.token),
    },
    body: JSON.stringify({
      problem_id: payload.questionId,
      language: payload.language,
      source_code: payload.code,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const created = (await response.json()) as BackendSubmissionApi;
  const fallback = {
    assignmentId: payload.assignmentId,
    userId: payload.userId,
    questionId: payload.questionId,
    language: payload.language,
    code: payload.code,
  };

  let result = mapSubmission(created, fallback);
  for (let attempt = 0; attempt < 20 && !isTerminalSubmissionStatus(result.status); attempt += 1) {
    await wait(500);
    result = {
      ...(await getSubmission(result.id, payload.token)),
      ...fallback,
      id: result.id,
    };
  }

  return result;
}

export async function getProblemResults(id: number, token?: string): Promise<ProblemResultStats> {
  const assignments = (await getAssignments()).filter((assignment) => assignment.questionId === id);
  const headers = getAuthHeaders(token);

  const candidates = await Promise.all(
    assignments.map(async (assignment) => {
      const username = assignment.user?.name ?? assignment.userId;
      let submissions: BackendSubmission[] = [];

      try {
        const response = await fetch(
          `${API_V1_BASE_URL}/users/${encodeURIComponent(username)}/submissions`,
          {
            cache: "no-store",
            headers,
          }
        );

        if (response.ok) {
          submissions = extractList(await response.json())
            .map((submission) => mapSubmission(submission as BackendSubmissionApi))
            .filter((submission) => submission.questionId === id);
        }
      } catch {
        submissions = [];
      }

      const bestSubmission =
        submissions.length === 0
          ? null
          : submissions.reduce((best, current) => (current.score > best.score ? current : best));
      const status = bestSubmission
        ? bestSubmission.status === "ACCEPTED"
          ? "Accepted"
          : "Failed"
        : "Pending";

      return {
        id: assignment.userId,
        name: assignment.user?.name ?? assignment.userId,
        email: assignment.user?.email ?? "",
        status,
        passedCases: status === "Accepted" ? 1 : 0,
        totalCases: 1,
        interviewId: assignment.jobId,
        interviewName: assignment.interview?.jobRole,
        submissionId: bestSubmission?.id,
        score: bestSubmission?.score,
        submittedAt: bestSubmission?.createdAt,
      } satisfies ProblemResultStats["candidates"][number];
    })
  );

  const submittedCount = candidates.filter((candidate) => candidate.status !== "Pending").length;
  const acceptedCount = candidates.filter((candidate) => candidate.status === "Accepted").length;
  const failedCount = submittedCount - acceptedCount;

  return {
    assignedCount: assignments.length,
    submittedCount,
    acceptedCount,
    failedCount,
    passRate: submittedCount > 0 ? Math.round((acceptedCount / submittedCount) * 100) : 0,
    candidates,
  };
}

/*
 * Compatibility helpers kept out of the current questioner flow.
 * The active UI uses DELETE /problems/:id directly and does not call problem-level assign.
 */
async function legacyDeleteProblem(id: number, token?: string): Promise<void> {
  const response = await fetch(`${API_V1_BASE_URL}/problems/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

async function legacyAssignProblem(
  id: number,
  payload: AssignProblemPayload,
  token?: string
): Promise<AssignProblemResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/problems/${id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<AssignProblemResponse>;
}

void legacyDeleteProblem;
void legacyAssignProblem;
