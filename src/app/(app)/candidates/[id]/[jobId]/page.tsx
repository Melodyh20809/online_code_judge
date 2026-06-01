"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCandidateAssignments,
  getCandidateSubmissions,
  type CandidateAssignment,
} from "@/lib/candidateApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Submission = {
  problemId: number;
  status: string;
  score: number;
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

export default function CandidateJobPage() {
  const params = useParams<{ id: string; jobId: string }>();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { id, jobId } = params;
  const interviewId = Number(jobId);
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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

        const [loadedAssignments, loadedSubmissions] = await Promise.all([
          getCandidateAssignments(candidateUserId, sessionUser.accessToken),
          sessionUser.username
            ? getCandidateSubmissions(sessionUser.username, sessionUser.accessToken).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (!isMounted) return;
        setAssignments(loadedAssignments);
        setSubmissions(
          loadedSubmissions.map((submission) => ({
            problemId: Number(submission.problem_id ?? submission.problemId ?? 0),
            status: String(submission.status ?? "PENDING"),
            score: Number(submission.score ?? 0),
          }))
        );
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load interview.");
        setAssignments([]);
        setSubmissions([]);
      } finally {
        if (!isMounted) return;
        setIsLoadingData(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [canViewCandidate, candidateUserId, isAuthenticated, sessionUser]);

  const interviewAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.jobId === interviewId),
    [assignments, interviewId]
  );
  const interview = interviewAssignments[0]?.interview ?? null;

  const questionResultMap = useMemo(() => {
    const map = new Map<number, Submission>();
    submissions.forEach((submission) => {
      const previous = map.get(submission.problemId);
      if (!previous || (previous.status !== "ACCEPTED" && submission.status === "ACCEPTED")) {
        map.set(submission.problemId, submission);
      }
    });
    return map;
  }, [submissions]);

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
      <h1 className="text-2xl font-semibold">
        {sessionUser.username ?? id} - {interview?.jobRole ?? `Interview #${interviewId}`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Progress: {passedCount}/{interviewAssignments.length} passed
      </p>
      {loadError && <p className="mt-3 text-sm text-red-500">{loadError}</p>}

      <div className="mt-6 grid gap-3">
        {interviewAssignments.map((assignment) => {
          const result = questionResultMap.get(assignment.problemId) ?? null;
          const config = result ? statusConfig[result.status] : null;

          return (
            <Link
              key={assignment.id}
              href={`/question/${assignment.problemId}`}
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
