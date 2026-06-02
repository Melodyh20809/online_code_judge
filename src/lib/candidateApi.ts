const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;

type BackendAssignmentApi = {
  id: string;
  jobId: string;
  userId: string;
  problemId: string;
  createdAt?: string;
  interview?: {
    id: string | number;
    jobRole: string;
    examinerEmpId?: string;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  problem?: {
    id: string | number;
    title: string;
    difficulty?: string;
  } | null;
};

export type CandidateAssignment = {
  id: string;
  jobId: number;
  userId: string;
  problemId: number;
  createdAt?: string;
  interview?: {
    id: number;
    jobRole: string;
    examinerEmpId?: string;
    startTime?: string | null;
    endTime?: string | null;
  };
  problem?: {
    id: number;
    title: string;
    difficulty?: string;
  };
};

export type CandidateInterviewRecord = {
  id: number;
  jobId: number;
  userId: string;
  startTime: number | null;
  endTime: number | null;
};

const authHeaders = (token?: string | null): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};

const getErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const extractList = (raw: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  for (const key of ["items", "data", "list", "results", "rows", "assignments"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }

  return [];
};

const mapAssignment = (assignment: BackendAssignmentApi): CandidateAssignment => ({
  id: String(assignment.id),
  jobId: Number(assignment.jobId),
  userId: String(assignment.userId),
  problemId: Number(assignment.problemId),
  createdAt: assignment.createdAt,
  interview: assignment.interview
    ? {
        id: Number(assignment.interview.id),
        jobRole: assignment.interview.jobRole,
        examinerEmpId: assignment.interview.examinerEmpId,
        startTime: assignment.interview.startTime,
        endTime: assignment.interview.endTime,
      }
    : undefined,
  problem: assignment.problem
    ? {
        id: Number(assignment.problem.id),
        title: assignment.problem.title,
        difficulty: assignment.problem.difficulty,
      }
    : undefined,
});

export async function getCandidateAssignments(
  userId: string,
  token?: string | null
): Promise<CandidateAssignment[]> {
  const response = await fetch(`${API_V1_BASE_URL}/assignments/user/${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: authHeaders(token),
  });

  if (response.status === 401 || response.status === 403) {
    const fallbackResponse = await fetch(
      `/api/assignments/user/${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );

    if (!fallbackResponse.ok) {
      throw new Error(await getErrorMessage(fallbackResponse));
    }

    return extractList(await fallbackResponse.json()).map((assignment) =>
      mapAssignment(assignment as BackendAssignmentApi)
    );
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return extractList(await response.json()).map((assignment) =>
    mapAssignment(assignment as BackendAssignmentApi)
  );
}

export async function getCandidateSubmissions(username: string, token?: string | null) {
  const response = await fetch(
    `${API_V1_BASE_URL}/users/${encodeURIComponent(username)}/submissions`,
    {
      cache: "no-store",
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return extractList(await response.json());
}

export async function getMyInterviewCandidate(jobId: number): Promise<CandidateInterviewRecord> {
  const response = await fetch(`/api/interview-candidates/me?jobId=${encodeURIComponent(jobId)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<CandidateInterviewRecord>;
}

export async function enterInterview(payload: {
  jobId: number;
  questionCount: number;
}): Promise<CandidateInterviewRecord> {
  const response = await fetch("/api/interview-candidates/enter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<CandidateInterviewRecord>;
}
