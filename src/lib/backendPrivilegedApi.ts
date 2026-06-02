import { hashPasswordToSHA256 } from "./passwordHash";

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
const BACKEND_TIMEOUT_MS = 5_000;

type BackendLoginResponse = {
  token?: string;
};

let cachedPrivilegedToken: {
  token: string;
  expiresAtMs: number;
} | null = null;

const interviewCandidateCache = new Map<
  string,
  {
    candidate: BackendInterviewCandidate;
    expiresAtMs: number;
  }
>();

export type BackendInterviewCandidate = {
  id: number;
  jobId: number;
  userId: string;
  startTime: number | null;
  endTime: number | null;
};

const getResponseMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const fetchBackend = async (url: string, init?: RequestInit) => {
  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new Error(`Backend request timed out: ${API_BASE_URL}`);
    }
    throw error;
  }
};

const extractList = (raw: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  for (const key of ["items", "data", "list", "results", "rows", "interviewCandidates"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }

  return [];
};

const mapInterviewCandidate = (candidate: Record<string, unknown>): BackendInterviewCandidate => ({
  id: Number(candidate.id),
  jobId: Number(candidate.jobId ?? candidate.job_id),
  userId: String(candidate.userId ?? ""),
  startTime: candidate.startTime == null ? null : Number(candidate.startTime),
  endTime: candidate.endTime == null ? null : Number(candidate.endTime),
});

const getInterviewCandidateCacheKey = (userId: string, jobId: number) => `${userId}:${jobId}`;

const rememberInterviewCandidate = (candidate: BackendInterviewCandidate) => {
  interviewCandidateCache.set(getInterviewCandidateCacheKey(candidate.userId, candidate.jobId), {
    candidate,
    expiresAtMs: Date.now() + 60 * 1000,
  });
};

const getJwtExpiresAtMs = (token: string) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

export async function getPrivilegedBackendToken() {
  if (cachedPrivilegedToken && cachedPrivilegedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedPrivilegedToken.token;
  }

  const username = process.env.BACKEND_PRIVILEGED_USERNAME;
  const password = process.env.BACKEND_PRIVILEGED_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing BACKEND_PRIVILEGED_USERNAME or BACKEND_PRIVILEGED_PASSWORD.");
  }

  const response = await fetchBackend(`${API_V1_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      passwordSha256: hashPasswordToSHA256(password),
    }),
  });

  if (!response.ok) {
    throw new Error(await getResponseMessage(response));
  }

  const data = (await response.json()) as BackendLoginResponse;
  if (!data.token) {
    throw new Error("Privileged login response missing token.");
  }

  cachedPrivilegedToken = {
    token: data.token,
    expiresAtMs: getJwtExpiresAtMs(data.token) ?? Date.now() + 10 * 60 * 1000,
  };

  return data.token;
}

export async function getInterviewCandidatesWithPrivilegedToken(token: string) {
  const response = await fetchBackend(`${API_V1_BASE_URL}/interview-candidates`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await getResponseMessage(response));
  }

  return extractList(await response.json())
    .map(mapInterviewCandidate)
    .filter((candidate) => Number.isFinite(candidate.id) && Number.isFinite(candidate.jobId))
    .map((candidate) => {
      rememberInterviewCandidate(candidate);
      return candidate;
    });
}

export async function getInterviewCandidateForUserJobWithPrivilegedToken(
  token: string,
  userId: string,
  jobId: number
) {
  const cacheKey = getInterviewCandidateCacheKey(userId, jobId);
  const cached = interviewCandidateCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.candidate;
  }

  const candidates = await getInterviewCandidatesWithPrivilegedToken(token);
  return candidates.find((item) => item.jobId === jobId && item.userId === userId) ?? null;
}

export async function getAssignmentsForUserWithPrivilegedToken(token: string, userId: string) {
  const response = await fetchBackend(
    `${API_V1_BASE_URL}/assignments/user/${encodeURIComponent(userId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseMessage(response));
  }

  return response.json();
}

export async function updateInterviewCandidateTimeWithPrivilegedToken(
  token: string,
  candidateId: number,
  startTime: number,
  endTime: number
) {
  const response = await fetchBackend(`${API_V1_BASE_URL}/interview-candidates/${candidateId}/time`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startTime, endTime }),
  });

  if (!response.ok) {
    throw new Error(await getResponseMessage(response));
  }

  const updated = mapInterviewCandidate((await response.json()) as Record<string, unknown>);
  rememberInterviewCandidate(updated);
  return updated;
}
