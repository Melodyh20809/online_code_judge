"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

// ── API Response Types ──────────────────────────────────────
type Submission = {
  id: string;
  userId: string;
  problemId: number;
  language: string;
  sourceCode: string;
  status: string;
  score: number;
  userOutput: string | null;
  compileMessage: string;
  executionTimeMs: number | null;
  memoryUsageKb: number | null;
  createdAt: string;
};

type Candidate = {
  id: number;
  userId: string;
  jobId: number;
  name: string;
  email: string;
  startTime: number | null;
  endTime: number | null;
};

type Problem = {
  id: number;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | string;
};

type Interview = {
  id: number;
  jobRole: string;
};

type Assignment = {
  id: number;
  jobId: number;
  userId: string;
  problemId: number;
};

type CandidateTimeStatus = "NOT_SCHEDULED" | "BEFORE_START" | "IN_PROGRESS" | "ENDED";

// ── Helpers ────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  WRONG_ANSWER: { label: "Wrong Answer", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  TLE: { label: "Time Limit Exceeded", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400" },
  MLE: { label: "Memory Limit Exceeded", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400" },
  COMPILE_ERROR: { label: "Compile Error", color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" },
  PENDING: { label: "Pending", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400" },
};

const difficultyConfig: Record<string, { color: string }> = {
  EASY: { color: "text-green-600 dark:text-green-400" },
  MEDIUM: { color: "text-yellow-600 dark:text-yellow-400" },
  HARD: { color: "text-red-600 dark:text-red-400" },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] ?? { label: status, color: "bg-gray-100 text-gray-800" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function difficultyRank(level: string): number {
  const v = String(level).toUpperCase();
  if (v === "EASY") return 1;
  if (v === "MEDIUM") return 2;
  if (v === "HARD") return 3;
  return 99;
}

function getCandidateTimeStatus(
  startTime: number | null,
  endTime: number | null,
  serverTime = Math.floor(Date.now() / 1000)
): CandidateTimeStatus {
  if (startTime == null || endTime == null) {
    return "NOT_SCHEDULED";
  }
  if (serverTime < startTime) {
    return "BEFORE_START";
  }
  if (serverTime <= endTime) {
    return "IN_PROGRESS";
  }
  return "ENDED";
}

function submissionTimestamp(createdAt: string): number {
  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickPreferredSubmission(submissions: Submission[]): Submission | undefined {
  return submissions.reduce<Submission | undefined>((best, current) => {
    if (!best) {
      return current;
    }
    if (current.score > best.score) {
      return current;
    }
    if (current.score < best.score) {
      return best;
    }
    return submissionTimestamp(current.createdAt) > submissionTimestamp(best.createdAt)
      ? current
      : best;
  }, undefined);
}

function isSubmissionWithinWindow(
  submission: Submission,
  startTime: number | null,
  endTime: number | null
): boolean {
  if (startTime == null || endTime == null) {
    return false;
  }
  const submittedAt = submissionTimestamp(submission.createdAt);
  if (submittedAt === 0) {
    return false;
  }
  const windowStart = startTime * 1000;
  const windowEnd = endTime * 1000;
  return submittedAt >= windowStart && submittedAt <= windowEnd;
}

// ── Component ──────────────────────────────────────────────
export default function ExaminerReportPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ExaminerReportContent />
    </Suspense>
  );
}

function ExaminerReportContent() {
  const { data: session } = useSession();
  const accessToken = session?.user?.accessToken;
  const searchParams = useSearchParams();
  const interviewIdParam = searchParams.get("interviewId");

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedInterviewId, setSelectedInterviewId] = useState<number>(
    interviewIdParam ? Number(interviewIdParam) : 0
  );
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"candidates" | "problems">("candidates");
  const [sortBy, setSortBy] = useState<"score" | "name" | "completion">("score");

  useEffect(() => {
    const fetchData = async () => {
      const toList = (raw: unknown): Array<Record<string, unknown>> => {
        if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
        if (!raw || typeof raw !== "object") return [];
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
        if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
        return [];
      };
      try {
        setIsLoading(true);
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const [interviewsRes, candidatesRes, problemsRes, usersRes, assignmentsRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/v1/interviews`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/interview-candidates`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/problems`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/users`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/assignments`, { headers }),
        ]);

        const interviewsData = interviewsRes.status === "fulfilled" ? interviewsRes.value.data : [];
        const candidatesData = candidatesRes.status === "fulfilled" ? candidatesRes.value.data : [];
        const problemsData = problemsRes.status === "fulfilled" ? problemsRes.value.data : [];
        const usersData = usersRes.status === "fulfilled" ? usersRes.value.data : [];
        const assignmentsData = assignmentsRes.status === "fulfilled" ? assignmentsRes.value.data : [];

        if (candidatesRes.status === "rejected" && axios.isAxiosError(candidatesRes.reason) && candidatesRes.reason.response?.status === 404) {
          toast.warning("interview-candidates API not found (404), report will show partial data.");
        }

        const interviewsList = toList(interviewsData);
        const rawCandidates = toList(candidatesData);
        const usersList = toList(usersData);
        const assignmentsList = toList(assignmentsData);
        const problemsList = toList(problemsData).map((p) => ({
          id: Number(p.id ?? p.problem_id),
          title: String(p.title ?? ""),
          difficulty: String(p.difficulty ?? "EASY").toUpperCase(),
        })).filter((p) => Number.isFinite(p.id));

        const normalizedAssignments: Assignment[] = assignmentsList.map((a: Record<string, unknown>) => ({
          id: Number(a.id),
          jobId: Number(a.jobId ?? a.job_id ?? 0),
          userId: String(a.userId ?? ""),
          problemId: Number(a.problemId ?? a.problem_id ?? 0),
        })).filter((a) => Number.isFinite(a.id) && Number.isFinite(a.jobId) && Number.isFinite(a.problemId));

        const normalizedCandidates: Candidate[] = rawCandidates
          .map((c: Record<string, unknown>) => {
            const userId = String(c.userId ?? "");
            const user = usersList.find((u: Record<string, unknown>) => String(u.id) === userId);
            return {
              id: Number(c.id),
              userId,
              jobId: Number(c.jobId ?? c.job_id ?? 0),
              name: String(user?.username ?? user?.name ?? userId),
              email: String(user?.email ?? ""),
              startTime:
                c.startTime == null || c.startTime === ""
                  ? null
                  : Number(c.startTime),
              endTime:
                c.endTime == null || c.endTime === ""
                  ? null
                  : Number(c.endTime),
            };
          })
          .filter((c) => Number.isFinite(c.jobId))
          .filter(
            (c, index, arr) =>
              arr.findIndex(
                (x) =>
                  x.jobId === c.jobId &&
                  x.userId === c.userId
              ) === index
          );

        const userSubmissions = await Promise.all(
          normalizedCandidates.map(async (candidate) => {
            try {
              const res = await axios.get(`${API_BASE_URL}/api/v1/users/${candidate.name}/submissions`, { headers });
              const list = toList(res.data);
              return (Array.isArray(list) ? list : []).map((s: Record<string, unknown>) => ({
                id: String(s.submission_id ?? s.id ?? ""),
                problemId: Number(s.problem_id ?? s.problemId ?? 0),
                language: String(s.language ?? ""),
                sourceCode: String(s.source_code ?? s.sourceCode ?? ""),
                status: String(s.status ?? "PENDING"),
                score: Number(s.score ?? 0),
                userOutput: (s.user_answer ?? s.userOutput ?? null) as string | null,
                compileMessage: String(s.compile_message ?? s.compileMessage ?? ""),
                executionTimeMs: Number((s.metrics as Record<string, unknown> | undefined)?.execution_time_ms ?? s.executionTimeMs ?? 0) || null,
                memoryUsageKb: Number((s.metrics as Record<string, unknown> | undefined)?.memory_usage_kb ?? s.memoryUsageKb ?? 0) || null,
                createdAt: String(s.submitted_at ?? s.createdAt ?? ""),
                userId: candidate.userId,
              })) as Submission[];
            } catch {
              return [] as Submission[];
            }
          })
        );

        const normalizedInterviews = interviewsList.map((i) => ({ id: Number(i.id), jobRole: String(i.jobRole ?? "") })) as Interview[];
        setInterviews(normalizedInterviews);
        setAssignments(normalizedAssignments);
        setCandidates(normalizedCandidates);
        setProblems(problemsList as Problem[]);
        setSubmissions(userSubmissions.flat());

        if (normalizedInterviews.length > 0) {
          const targetId = interviewIdParam ? Number(interviewIdParam) : normalizedInterviews[0].id;
          setSelectedInterviewId(targetId);
        }
      } catch (error) {
        toast.error("無法載入報告資料");
        console.error("載入報告資料失敗:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [interviewIdParam, accessToken]);

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const selectedInterview = interviews.find((i) => i.id === selectedInterviewId);
  if (!selectedInterview) {
    return <div className="p-8">No interview selected.</div>;
  }

  const assignedRows = assignments.filter((a) => a.jobId === selectedInterview.id);
  const assignedProblemIds = new Set(assignedRows.map((a) => a.problemId));
  const assignedUserIds = new Set(assignedRows.map((a) => a.userId));
  const interviewProblems = problems
    .filter((p) => assignedProblemIds.has(p.id))
    .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.id - b.id);
  const interviewCandidates = candidates
    .filter((c) => assignedUserIds.has(c.userId))
    .filter(
      (c, index, arr) => arr.findIndex((x) => x.userId === c.userId) === index
    );
  const candidateWindowByUserId = new Map(
    interviewCandidates.map((candidate) => [
      candidate.userId,
      { startTime: candidate.startTime, endTime: candidate.endTime },
    ])
  );
  const interviewSubmissions = submissions.filter((submission) => {
    const window = candidateWindowByUserId.get(String(submission.userId));
    if (!window) {
      return false;
    }
    return isSubmissionWithinWindow(submission, window.startTime, window.endTime);
  });

  // Compute stats per candidate
  const candidateStats = interviewCandidates.map((c) => {
    const candidateAssignedProblemIds = new Set(
      assignedRows.filter((a) => a.userId === c.userId).map((a) => a.problemId)
    );
    const subs = interviewSubmissions.filter(
      (s) => String(s.userId) === c.userId && candidateAssignedProblemIds.has(s.problemId)
    );
    const totalProblems = candidateAssignedProblemIds.size;
    const attempted = new Set(subs.map((s) => s.problemId)).size;
    const accepted = new Set(subs.filter((s) => s.status === "ACCEPTED").map((s) => s.problemId)).size;
    const bestScoresByProblem = Array.from(candidateAssignedProblemIds).map((problemId) =>
      subs
        .filter((submission) => submission.problemId === problemId)
        .reduce((best, submission) => Math.max(best, submission.score), 0)
    );
    const totalScore = bestScoresByProblem.reduce((sum, score) => sum + score, 0);
    const avgScore = totalProblems > 0 ? Math.round(totalScore / totalProblems) : 0;
    const timeStatus = getCandidateTimeStatus(c.startTime, c.endTime);
    const completedAll = totalProblems > 0 && bestScoresByProblem.every((score) => score === 100);
    return { ...c, subs, totalProblems, attempted, accepted, avgScore, candidateAssignedProblemIds, timeStatus, completedAll };
  });

  // Sort
  const sortedCandidates = [...candidateStats].sort((a, b) => {
    if (sortBy === "score") return b.avgScore - a.avgScore;
    if (sortBy === "completion") return b.accepted - a.accepted;
    return a.name.localeCompare(b.name);
  });

  // Problem stats
  const problemStats = interviewProblems.map((p) => {
    const assignedUserIdsForProblem = new Set(
      assignedRows.filter((a) => a.problemId === p.id).map((a) => a.userId)
    );
    const subs = interviewSubmissions.filter(
      (s) => s.problemId === p.id && assignedUserIdsForProblem.has(String(s.userId))
    );
    const acceptedCount = subs.filter((s) => s.status === "ACCEPTED").length;
    const timedSubs = subs.filter((s) => s.executionTimeMs != null);
    const avgTime = timedSubs.reduce((sum, s) => sum + (s.executionTimeMs ?? 0), 0) / (timedSubs.length || 1);
    return {
      ...p,
      totalSubmissions: subs.length,
      acceptedCount,
      passRate: subs.length > 0 ? Math.round((acceptedCount / subs.length) * 100) : 0,
      avgTime: Math.round(avgTime),
    };
  });

  // Overview
  const totalCandidates = interviewCandidates.length;
  const completedAll = candidateStats.filter((c) => c.completedAll).length;
  const inProgress = candidateStats.filter((c) => c.timeStatus === "IN_PROGRESS").length;
  const notStarted = candidateStats.filter((c) => c.timeStatus === "NOT_SCHEDULED").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Interview Report</h1>
            <p className="text-sm text-muted-foreground">Interview data</p>
          </div>
          <select
            value={selectedInterviewId}
            onChange={(e) => {
              setSelectedInterviewId(Number(e.target.value));
              setExpandedCandidate(null);
            }}
            className="rounded-md border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
          >
            {interviews.map((interview) => (
              <option key={interview.id} value={interview.id}>
                {interview.jobRole}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/examiner"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-[var(--sidebar-accent)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Candidates</p>
          <p className="mt-1 text-2xl font-bold">{totalCandidates}</p>
        </div>
        <div className="rounded-lg border bg-[var(--sidebar-accent)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed All</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{completedAll}</p>
        </div>
        <div className="rounded-lg border bg-[var(--sidebar-accent)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{inProgress}</p>
        </div>
        <div className="rounded-lg border bg-[var(--sidebar-accent)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Not Started</p>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">{notStarted}</p>
        </div>
      </div>

      {/* View Toggle & Sort */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setViewMode("candidates")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === "candidates" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            By Candidate
          </button>
          <button
            type="button"
            onClick={() => setViewMode("problems")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === "problems" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            By Problem
          </button>
        </div>
        {viewMode === "candidates" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="score">Average Score</option>
              <option value="completion">Completion</option>
              <option value="name">Name</option>
            </select>
          </div>
        )}
      </div>

      {/* By Candidate View */}
      {viewMode === "candidates" && (
        <div className="space-y-4">
          {sortedCandidates.map((candidate) => {
            const isExpanded = expandedCandidate === candidate.id;
            return (
              <div key={candidate.id} className="rounded-lg border bg-[var(--sidebar-accent)]">
                {/* Candidate Header */}
                <button
                  type="button"
                  onClick={() => setExpandedCandidate(isExpanded ? null : candidate.id)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {candidate.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">{candidate.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium">Avg Score</p>
                      <p className={`text-lg font-bold ${candidate.avgScore >= 80 ? "text-green-600 dark:text-green-400" : candidate.avgScore >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                        {candidate.avgScore}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Passed</p>
                      <p className="text-lg font-bold">{candidate.accepted}/{candidate.totalProblems}</p>
                    </div>
                    <span className={`text-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    <div className="mt-4 space-y-3">
                      {interviewProblems
                        .filter((problem) => candidate.candidateAssignedProblemIds.has(problem.id))
                        .map((problem) => {
                        const sub = pickPreferredSubmission(
                          candidate.subs.filter((s) => s.problemId === problem.id)
                        );
                        return (
                          <div key={problem.id} className="rounded-md border bg-background p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{problem.title}</span>
                                <span className={`text-xs font-medium ${difficultyConfig[problem.difficulty].color}`}>
                                  {problem.difficulty}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                {sub ? (
                                  <>
                                    {getStatusBadge(sub.status)}
                                    <span className="text-sm font-medium">{sub.score} pts</span>
                                    {sub.executionTimeMs != null && (
                                      <span className="text-xs text-muted-foreground">{sub.executionTimeMs}ms</span>
                                    )}
                                    {sub.memoryUsageKb != null && (
                                      <span className="text-xs text-muted-foreground">{(sub.memoryUsageKb / 1024).toFixed(1)}MB</span>
                                    )}
                                    <span className="text-xs text-muted-foreground">{sub.language}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not attempted</span>
                                )}
                              </div>
                            </div>
                            {/* Source Code */}
                            {sub && sub.sourceCode && (
                              <div className="mt-3">
                                <pre className="max-h-48 overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-neutral-200">
                                  <code>{sub.sourceCode}</code>
                                </pre>
                              </div>
                            )}
                            {/* Compile Error */}
                            {sub && sub.compileMessage && (
                              <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                                {sub.compileMessage}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By Problem View */}
      {viewMode === "problems" && (
        <div className="space-y-4">
          {problemStats.map((problem) => {
            const subs = interviewSubmissions.filter((s) => s.problemId === problem.id);
            const assignedCandidatesForProblem = interviewCandidates.filter((candidate) =>
              assignedRows.some((a) => a.problemId === problem.id && a.userId === candidate.userId)
            );
            return (
              <div key={problem.id} className="rounded-lg border bg-[var(--sidebar-accent)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold">{problem.title}</h3>
                    <span className={`text-xs font-medium ${difficultyConfig[problem.difficulty].color}`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Pass Rate</p>
                      <p className={`font-bold ${problem.passRate >= 70 ? "text-green-600 dark:text-green-400" : problem.passRate >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                        {problem.passRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Avg Time</p>
                      <p className="font-medium">{problem.avgTime}ms</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Submissions</p>
                      <p className="font-medium">{problem.totalSubmissions}</p>
                    </div>
                  </div>
                </div>

                {/* Pass rate bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${problem.passRate}%` }}
                  />
                </div>

                {/* Each candidate's result for this problem */}
                <div className="mt-4 space-y-2">
                  {assignedCandidatesForProblem.map((candidate) => {
                    const sub = pickPreferredSubmission(
                      subs.filter((s) => String(s.userId) === candidate.userId)
                    );
                    return (
                      <div key={candidate.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {candidate.name.charAt(0)}
                          </div>
                          <span>{candidate.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {sub ? (
                            <>
                              {getStatusBadge(sub.status)}
                              <span className="w-16 text-right font-medium">{sub.score} pts</span>
                              <span className="w-16 text-right text-xs text-muted-foreground">
                                {sub.executionTimeMs != null ? `${sub.executionTimeMs}ms` : "-"}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not attempted</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
