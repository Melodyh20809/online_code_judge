"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMockData } from "@/hooks/useMockData";
import { getUserById } from "@/lib/mockData";

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const {
    interviewCandidates,
    interviews,
    users,
    isLoading: isLoadingData,
  } = useMockData();
  const { id } = params;
  const candidate =
    getUserById(users, id) ?? users.find((user) => user.username === id) ?? null;
  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAuthenticated || !sessionUser) {
    return <div className="p-8">Please sign in.</div>;
  }

  const candidateUserId = candidate?.id ?? id;
  const candidateInterviewRows = interviewCandidates
    .filter((row) => row.userId === candidateUserId)
    .map((row) => {
      const interview = interviews.find((job) => job.id === row.jobId);
      const examiner = users.find((user) => user.id === interview?.examinerEmpId);
      return { interview: interview ?? null, examinerName: examiner?.username ?? "Unknown" };
    })
    .filter((row) => row.interview !== null);

  if (!candidate) {
    return <div className="p-8">Candidate not found.</div>;
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Candidate Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {candidate.username} ({candidate.email})
      </p>

      <div className="mt-6 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--sidebar-accent)]">
            <tr>
              <th className="px-4 py-3 text-left">Interview ID</th>
              <th className="px-4 py-3 text-left">Job Role</th>
              <th className="px-4 py-3 text-left">Examiner</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {candidateInterviewRows.map((row) => (
              <tr key={row.interview!.id} className="border-t">
                <td className="px-4 py-3">{row.interview!.id}</td>
                <td className="px-4 py-3">{row.interview!.jobRole}</td>
                <td className="px-4 py-3">{row.examinerName}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/candidates/${candidateUserId}/${row.interview!.id}`}
                    className="rounded-md border px-3 py-1.5"
                  >
                    Enter Interview
                  </Link>
                </td>
              </tr>
            ))}
            {candidateInterviewRows.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-muted-foreground" colSpan={4}>
                  No interviews assigned for you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
