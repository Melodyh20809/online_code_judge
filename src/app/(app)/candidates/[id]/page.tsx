"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  enterInterview,
  getCandidateAssignments,
  getMyInterviewCandidate,
  type CandidateAssignment,
  type CandidateInterviewRecord,
} from "@/lib/candidateApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function formatRemainingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
}

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { id } = params;
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enteringInterviewId, setEnteringInterviewId] = useState<number | null>(null);
  const [interviewCandidateByJobId, setInterviewCandidateByJobId] = useState<
    Record<number, CandidateInterviewRecord>
  >({});
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const canViewCandidate =
    sessionUser?.role === "ADMIN" ||
    sessionUser?.role === "EXAMINER" ||
    sessionUser?.role === "QUESTIONER" ||
    sessionUser?._id === id ||
    sessionUser?.username === id;

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || !canViewCandidate) {
      setIsLoadingAssignments(false);
      return;
    }

    const candidateUserId = sessionUser._id === id || sessionUser.username === id ? sessionUser._id ?? id : id;
    if (!candidateUserId) {
      setIsLoadingAssignments(false);
      return;
    }

    let isMounted = true;

    const loadAssignments = async () => {
      try {
        setIsLoadingAssignments(true);
        setLoadError(null);
        const loadedAssignments = await getCandidateAssignments(
          candidateUserId,
          sessionUser.accessToken
        );
        if (!isMounted) return;
        setAssignments(loadedAssignments);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load assignments.");
        setAssignments([]);
      } finally {
        if (!isMounted) return;
        setIsLoadingAssignments(false);
      }
    };

    void loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [canViewCandidate, id, isAuthenticated, sessionUser]);

  const candidateUserId = sessionUser?._id === id || sessionUser?.username === id ? sessionUser?._id ?? id : id;
  const candidateName = sessionUser?.username === id || sessionUser?._id === id ? sessionUser.username ?? id : id;

  const handleEnterInterview = async (row: { id: number; questionCount: number }) => {
    if (!candidateUserId) return;

    try {
      setEnteringInterviewId(row.id);
      setLoadError(null);
      await enterInterview({
        jobId: row.id,
        questionCount: row.questionCount,
      });
      router.push(`/candidates/${candidateUserId}/${row.id}`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to enter interview.");
    } finally {
      setEnteringInterviewId(null);
    }
  };

  const interviewRows = useMemo(() => {
    const rows = new Map<number, { id: number; jobRole: string; questionCount: number }>();

    assignments.forEach((assignment) => {
      const interviewId = assignment.interview?.id ?? assignment.jobId;
      const existing = rows.get(interviewId);
      rows.set(interviewId, {
        id: interviewId,
        jobRole: assignment.interview?.jobRole ?? existing?.jobRole ?? `Interview #${interviewId}`,
        questionCount: (existing?.questionCount ?? 0) + 1,
      });
    });

    return Array.from(rows.values()).sort((a, b) => a.id - b.id);
  }, [assignments]);
  const interviewIdsKey = useMemo(() => interviewRows.map((row) => row.id).join(","), [interviewRows]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || sessionUser._id !== candidateUserId || interviewRows.length === 0) {
      setInterviewCandidateByJobId({});
      return;
    }

    let isMounted = true;

    const loadInterviewCandidateTimes = async () => {
      const entries = await Promise.all(
        interviewRows.map(async (row) => {
          try {
            const record = await getMyInterviewCandidate(row.id);
            return [row.id, record] as const;
          } catch {
            return null;
          }
        })
      );

      if (!isMounted) return;
      setInterviewCandidateByJobId(
        Object.fromEntries(entries.filter((entry): entry is readonly [number, CandidateInterviewRecord] => entry !== null))
      );
    };

    void loadInterviewCandidateTimes();

    return () => {
      isMounted = false;
    };
  }, [candidateUserId, interviewIdsKey, interviewRows, isAuthenticated, sessionUser]);

  const getInterviewStatus = (jobId: number) => {
    const record = interviewCandidateByJobId[jobId];
    if (!record?.startTime || !record.endTime) {
      return { label: "Not Started", className: "text-muted-foreground" };
    }
    if (nowSeconds < record.startTime) {
      return { label: "Not Started", className: "text-muted-foreground" };
    }
    if (nowSeconds <= record.endTime) {
      return {
        label: `In Progress (${formatRemainingTime(record.endTime - nowSeconds)})`,
        className: "text-green-600",
      };
    }
    return { label: "Ended", className: "text-red-600" };
  };

  if (isLoadingUser || isLoadingAssignments) {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAuthenticated || !sessionUser) {
    return <div className="p-8">Please sign in.</div>;
  }
  if (!canViewCandidate) {
    return <div className="p-8">You do not have access rights.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Candidate Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">{candidateName}</p>
      {loadError && <p className="mt-3 text-sm text-red-500">{loadError}</p>}

      <div className="mt-6 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--sidebar-accent)]">
            <tr>
              <th className="px-4 py-3 text-left">Job Role</th>
              <th className="px-4 py-3 text-left">Total Questions</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {interviewRows.map((row) => {
              const status = getInterviewStatus(row.id);
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.jobRole}</td>
                  <td className="px-4 py-3">{row.questionCount}</td>
                  <td className={`px-4 py-3 font-medium ${status.className}`}>{status.label}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleEnterInterview(row)}
                      disabled={enteringInterviewId === row.id}
                      className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {enteringInterviewId === row.id ? "Entering..." : "Enter Interview"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {interviewRows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-muted-foreground" colSpan={4}>
                  No assigned questions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
