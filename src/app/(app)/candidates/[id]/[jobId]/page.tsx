"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMockData } from "@/hooks/useMockData";
import { getInterviewById, getQuestionById, getUserById } from "@/lib/mockData";
import { useSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

type Submission = {
  problemId: number;
  status: string;
  score: number;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: "Accepted", color: "text-green-600 dark:text-green-400" },
  WRONG_ANSWER: { label: "Wrong Answer", color: "text-red-600 dark:text-red-400" },
  TLE: { label: "TLE", color: "text-yellow-600 dark:text-yellow-400" },
  MLE: { label: "MLE", color: "text-orange-600 dark:text-orange-400" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "text-purple-600 dark:text-purple-400" },
  COMPILE_ERROR: { label: "Compile Error", color: "text-gray-600 dark:text-gray-400" },
};

export default function CandidateJobPage() {
  const params = useParams<{ id: string; jobId: string }>();
  const { data: session } = useSession();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { assignments, interviews, questions, users, isLoading: isLoadingData } = useMockData();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const { id, jobId } = params;
  const interviewId = Number(jobId);

  const candidate = getUserById(users, id) ?? users.find((user) => user.username === id) ?? null;
  const interview = getInterviewById(interviews, interviewId);

  const candidateUserId = candidate?.id ?? id;
  const assignedQuestions = assignments
    .filter((assignment) => assignment.userId === candidateUserId && assignment.jobId === interviewId)
    .map((assignment) => getQuestionById(questions, assignment.problemId))
    .filter((question) => question !== null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!candidate?.username) return;
      const headers: Record<string, string> = {};
      if (session?.user?.accessToken) {
        headers.Authorization = `Bearer ${session.user.accessToken}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/users/${candidate.username}/submissions`, { headers, cache: "no-store" });
        if (!res.ok) {
          setSubmissions([]);
          return;
        }
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
        const mapped = list.map((s: Record<string, unknown>) => ({
          problemId: Number(s.problem_id ?? s.problemId ?? 0),
          status: String(s.status ?? "PENDING"),
          score: Number(s.score ?? 0),
        })) as Submission[];
        setSubmissions(mapped);
      } catch {
        setSubmissions([]);
      }
    };
    fetchSubmissions();
  }, [candidate?.username, session?.user?.accessToken]);

  const questionResultMap = useMemo(() => {
    const map = new Map<number, Submission>();
    submissions.forEach((s) => {
      const prev = map.get(s.problemId);
      if (!prev || (prev.status !== "ACCEPTED" && s.status === "ACCEPTED")) {
        map.set(s.problemId, s);
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
  if (!candidate || !interview) {
    return <div className="p-8">Candidate or interview not found.</div>;
  }
  if (
    sessionUser.role !== "ADMIN" &&
    sessionUser.role !== "CANDIDATE" &&
    sessionUser.role !== "USER" &&
    sessionUser._id !== id &&
    sessionUser.username !== id
  ) {
    return <div className="p-8">You do not have access rights.</div>;
  }

  const now = new Date();
  const notStartedYet = interview.startTime && now < new Date(interview.startTime);
  const alreadyEnded = interview.endTime && now > new Date(interview.endTime);
  const locked = notStartedYet || alreadyEnded;

  const passedCount = assignedQuestions.filter((q) => questionResultMap.get(q!.id)?.status === "ACCEPTED").length;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">
        {candidate.username} - {interview.jobRole}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Progress: {passedCount}/{assignedQuestions.length} passed
      </p>

      {notStartedYet && (
        <div className="mt-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
          This interview has not started yet. It will open at {new Date(interview.startTime!).toLocaleString("en-US")}.
        </div>
      )}
      {alreadyEnded && (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          This interview has ended ({new Date(interview.endTime!).toLocaleString("en-US")}). You can no longer submit answers.
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {assignedQuestions.map((question) => {
          const result = questionResultMap.get(question!.id) ?? null;
          const config = result ? statusConfig[result.status] : null;

          return locked ? (
            <div
              key={question!.id}
              className="flex items-center justify-between rounded-md border bg-[var(--sidebar-accent)] p-4 opacity-50 cursor-not-allowed"
            >
              <div>
                <p className="text-sm text-muted-foreground">Question</p>
                <p className="text-lg font-medium">{question!.title}</p>
              </div>
              <div className="text-right">
                {result ? (
                  <>
                    <p className={`text-sm font-medium ${config?.color}`}>
                      {config?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{result.score} pts</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not attempted</p>
                )}
              </div>
            </div>
          ) : (
            <Link
              key={question!.id}
              href={`/question/${question!.id}`}
              className="flex items-center justify-between rounded-md border bg-[var(--sidebar-accent)] p-4 transition hover:bg-background"
            >
              <div>
                <p className="text-sm text-muted-foreground">Question</p>
                <p className="text-lg font-medium">{question!.title}</p>
              </div>
              <div className="text-right">
                {result ? (
                  <>
                    <p className={`text-sm font-medium ${config?.color}`}>
                      {config?.label}
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

        {assignedQuestions.length === 0 && (
          <p className="text-sm text-muted-foreground">No questions assigned.</p>
        )}
      </div>
    </div>
  );
}
