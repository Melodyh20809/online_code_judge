"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCandidateAssignments,
  getMyInterviewCandidate,
  getCandidateSubmissions,
  type CandidateInterviewRecord,
  type CandidateAssignment,
} from "@/lib/candidateApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Submission = {
  problemId: number;
  status: string;
  score: number;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: "Accepted", color: "text-green-600 dark:text-green-400" },
  WRONG_ANSWER: { label: "Wrong Answer", color: "text-red-600 dark:text-red-400" },
  TLE: { label: "TLE", color: "text-yellow-600 dark:text-yellow-400" },
  TIME_LIMIT_EXCEEDED: { label: "TLE", color: "text-yellow-600 dark:text-yellow-400" },
  MLE: { label: "MLE", color: "text-orange-600 dark:text-orange-400" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "text-purple-600 dark:text-purple-400" },
  COMPILE_ERROR: { label: "Compile Error", color: "text-gray-600 dark:text-gray-400" },
  INTERNAL_ERROR: { label: "Internal Error", color: "text-gray-600 dark:text-gray-400" },
};

function difficultyRank(level?: string): number {
  const value = String(level ?? "").toUpperCase();
  if (value === "EASY") return 1;
  if (value === "MEDIUM") return 2;
  if (value === "HARD") return 3;
  return 99;
}

export default function CandidateJobPage() {
  const params = useParams<{ id: string; jobId: string }>();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { id, jobId } = params;
  const interviewId = Number(jobId);
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [interviewCandidate, setInterviewCandidate] = useState<CandidateInterviewRecord | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canViewCandidate =
    sessionUser?.role === "ADMIN" ||
    sessionUser?.role === "EXAMINER" ||
    sessionUser?.role === "QUESTIONER" ||
    sessionUser?._id === id ||
    sessionUser?.username === id;
  const candidateUserId = sessionUser?._id === id || sessionUser?.username === id ? sessionUser?._id ?? id : id;

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || !canViewCandidate || !candidateUserId) {
      setIsLoadingData(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoadingData(true);
        setLoadError(null);

        const [loadedAssignments, loadedSubmissions, loadedInterviewCandidate] = await Promise.all([
          getCandidateAssignments(candidateUserId, sessionUser.accessToken),
          sessionUser.username
            ? getCandidateSubmissions(sessionUser.username, sessionUser.accessToken).catch(() => [])
            : Promise.resolve([]),
          getMyInterviewCandidate(interviewId).catch(() => null),
        ]);

        if (!isMounted) return;
        setAssignments(loadedAssignments);
        setInterviewCandidate(loadedInterviewCandidate);
        setSubmissions(
          loadedSubmissions.map((submission) => ({
            problemId: Number(submission.problem_id ?? submission.problemId ?? 0),
            status: String(submission.status ?? "PENDING"),
            score: Number(submission.score ?? 0),
            createdAt: String(submission.submitted_at ?? submission.createdAt ?? ""),
          }))
        );
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load interview.");
        setAssignments([]);
        setSubmissions([]);
        setInterviewCandidate(null);
      } finally {
        if (!isMounted) return;
        setIsLoadingData(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [canViewCandidate, candidateUserId, interviewId, isAuthenticated, sessionUser]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const interviewAssignments = useMemo(
    () =>
      assignments
        .filter((assignment) => assignment.jobId === interviewId)
        .sort(
          (a, b) =>
            difficultyRank(a.problem?.difficulty) - difficultyRank(b.problem?.difficulty) ||
            a.problemId - b.problemId
        ),
    [assignments, interviewId]
  );
  const interview = interviewAssignments[0]?.interview ?? null;
  const remainingSeconds =
    interviewCandidate?.endTime == null ? null : Math.max(interviewCandidate.endTime - nowSeconds, 0);
  const isInterviewEnded = remainingSeconds != null && remainingSeconds <= 0;
  const formatRemainingTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
  };

  const questionResultMap = useMemo(() => {
    const map = new Map<number, Submission>();
    const visibleSubmissions = submissions.filter((submission) => {
      if (interviewCandidate?.startTime == null || interviewCandidate.endTime == null) {
        return false;
      }
      const submittedAt = Date.parse(submission.createdAt);
      if (Number.isNaN(submittedAt)) {
        return false;
      }
      return submittedAt >= interviewCandidate.startTime * 1000 && submittedAt <= interviewCandidate.endTime * 1000;
    });

    visibleSubmissions.forEach((submission) => {
      const previous = map.get(submission.problemId);
      const previousTime = previous ? Date.parse(previous.createdAt) || 0 : 0;
      const currentTime = Date.parse(submission.createdAt) || 0;
      if (
        !previous ||
        submission.score > previous.score ||
        (submission.score === previous.score && currentTime > previousTime)
      ) {
        map.set(submission.problemId, submission);
      }
    });
    return map;
  }, [interviewCandidate?.endTime, interviewCandidate?.startTime, submissions]);

  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAuthenticated || !sessionUser) {
    return <div className="p-8">Please sign in.</div>;
  }
  if (!canViewCandidate) {
    return <div className="p-8">You do not have access rights.</div>;
  }
  if (interviewAssignments.length === 0) {
    return (
      <div className="p-8">
        <p className="text-lg font-medium">No assigned questions found for this interview.</p>
        {loadError && <p className="mt-2 text-sm text-red-500">{loadError}</p>}
        <Link href={`/candidates/${candidateUserId}`} className="mt-4 inline-block text-sm underline">
          Back to candidate dashboard
        </Link>
      </div>
    );
  }

  const passedCount = interviewAssignments.filter(
    (assignment) => questionResultMap.get(assignment.problemId)?.status === "ACCEPTED"
  ).length;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{interview?.jobRole ?? `Interview #${interviewId}`}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Candidate: {sessionUser.username ?? id}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Progress: {passedCount}/{interviewAssignments.length} passed
      </p>
      <p className={`mt-2 text-sm font-medium ${isInterviewEnded ? "text-red-600" : "text-muted-foreground"}`}>
        Remaining Time: {remainingSeconds == null ? "Not started" : formatRemainingTime(remainingSeconds)}
      </p>
      {loadError && <p className="mt-3 text-sm text-red-500">{loadError}</p>}

      <div className="mt-6 grid gap-3">
        {interviewAssignments.map((assignment) => {
          const result = questionResultMap.get(assignment.problemId) ?? null;
          const config = result ? statusConfig[result.status] : null;

          return (
            <Link
              key={assignment.id}
              href={`/question/${assignment.problemId}?jobId=${interviewId}`}
              className="flex items-center justify-between rounded-md border bg-[var(--sidebar-accent)] p-4 transition hover:bg-background"
            >
              <div>
                <p className="text-sm text-muted-foreground">
                  {assignment.problem?.difficulty ?? "Question"}
                </p>
                <p className="text-lg font-medium">
                  {assignment.problem?.title ?? `Question #${assignment.problemId}`}
                </p>
              </div>
              <div className="text-right">
                {result ? (
                  <>
                    <p className={`text-sm font-medium ${config?.color}`}>
                      {config?.label ?? result.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{result.score} pts</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not attempted</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
