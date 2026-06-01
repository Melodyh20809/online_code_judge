"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCandidateAssignments, type CandidateAssignment } from "@/lib/candidateApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { id } = params;
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
              <th className="px-4 py-3 text-left">Interview ID</th>
              <th className="px-4 py-3 text-left">Job Role</th>
              <th className="px-4 py-3 text-left">Questions</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {interviewRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{row.id}</td>
                <td className="px-4 py-3">{row.jobRole}</td>
                <td className="px-4 py-3">{row.questionCount}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/candidates/${candidateUserId}/${row.id}`}
                    className="rounded-md border px-3 py-1.5"
                  >
                    Enter Interview
                  </Link>
                </td>
              </tr>
            ))}
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
