"use client";

import { useEffect, useState, useCallback } from "react";
import { getSession } from "next-auth/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createInterview, addCandidateToInterview, deleteInterview, updateInterview, deleteCandidate, createAssignment, deleteAssignment } from "@/lib/mockData";
import { useMockData } from "@/hooks/useMockData";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export default function ExaminerPage() {
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { assignments, interviewCandidates, interviews, questions, users, isLoading: isLoadingData } =
    useMockData();
  const token = sessionUser?.accessToken || null;
  const [jobRole, setJobRole] = useState("");
  const [easyCount, setEasyCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localInterviews, setLocalInterviews] = useState(interviews);
  const [localCandidates, setLocalCandidates] = useState(interviewCandidates);
  const [candidateUsernames, setCandidateEmails] = useState<Record<number, string>>({});
  const [candidateErrors, setCandidateErrors] = useState<Record<number, string | null>>({});
  const [candidateSubmitting, setCandidateSubmitting] = useState<Record<number, boolean>>({});
  const [localAssignments, setLocalAssignments] = useState(assignments);
  const [editingCandidateKey, setEditingCandidateKey] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<Record<string, number | "random" | "">>({});
  const [selectedDifficulty, setSelectedDifficulty] = useState<Record<string, string>>({});
  const [comboboxOpen, setComboboxOpen] = useState<Record<string, boolean>>({});
  const [comboboxSearch, setComboboxSearch] = useState<Record<string, string>>({});
  const [expandedInterviews, setExpandedInterviews] = useState<Record<number, boolean>>({});
  const [editingInterviewId, setEditingInterviewId] = useState<number | null>(null);
  const [editingInterviewName, setEditingInterviewName] = useState("");
  const [deleteInterviewConfirm, setDeleteInterviewConfirm] = useState<number | null>(null);
  const [deleteCandidateConfirm, setDeleteCandidateConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "name">("newest");
  const getLatestToken = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    const session = await getSession();
    const fromSession = session?.user?.accessToken;
    return typeof fromSession === "string" && fromSession.length > 0 ? fromSession : null;
  }, [token]);
  const difficultyRank = useCallback((level: string) => {
    const v = String(level).toUpperCase();
    if (v === "EASY") return 1;
    if (v === "MEDIUM") return 2;
    if (v === "HARD") return 3;
    return 99;
  }, []);

  useEffect(() => {
    setLocalInterviews(interviews);
  }, [interviews]);

  useEffect(() => {
    setLocalCandidates(interviewCandidates);
  }, [interviewCandidates]);

  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  const handleAddCandidate = useCallback(async (interviewId: number) => {
    const username = candidateUsernames[interviewId]?.trim();
    if (!username) return;

    const foundUser = users.find((u) => u.username === username);
    if (!foundUser) {
      setCandidateErrors((prev) => ({ ...prev, [interviewId]: "User not found with this username." }));
      return;
    }

    const alreadyAdded = localCandidates.some(
      (c) => c.jobId === interviewId && c.userId === foundUser.id
    );
    if (alreadyAdded) {
      setCandidateErrors((prev) => ({ ...prev, [interviewId]: "This candidate is already in this interview." }));
      return;
    }

    try {
      setCandidateSubmitting((prev) => ({ ...prev, [interviewId]: true }));
      setCandidateErrors((prev) => ({ ...prev, [interviewId]: null }));
      const created = await addCandidateToInterview({
        jobId: interviewId,
        userId: foundUser.id,
      }, token);
      setLocalCandidates((prev) => [...prev, created]);
      setCandidateEmails((prev) => ({ ...prev, [interviewId]: "" }));
    } catch (error) {
      setCandidateErrors((prev) => ({
        ...prev,
        [interviewId]: error instanceof Error ? error.message : "Failed to add candidate.",
      }));
    } finally {
      setCandidateSubmitting((prev) => ({ ...prev, [interviewId]: false }));
    }
  }, [candidateUsernames, users, localCandidates, token]);

  const handleDeleteCandidate = useCallback(async (candidateId: number) => {
    try {
      const candidate = localCandidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      const relatedAssignments = localAssignments.filter(
        (a) => a.jobId === candidate.jobId && a.userId === candidate.userId
      );

      await Promise.all(
        relatedAssignments.map((assignment) => deleteAssignment(assignment.id, token))
      );
      await deleteCandidate(candidateId, token);

      setLocalAssignments((prev) =>
        prev.filter((a) => !(a.jobId === candidate.jobId && a.userId === candidate.userId))
      );
      setLocalCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (error) {
      console.error("Failed to delete candidate:", error);
    }
  }, [localCandidates, localAssignments, token]);

  const handleRemoveAssignment = useCallback(async (assignmentId: number) => {
    try {
      await deleteAssignment(assignmentId, token);
      setLocalAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error("Failed to remove assignment:", error);
    }
  }, [token]);

  const handleAssignQuestion = useCallback(async (userId: string, questionId: number, jobId: number) => {
    try {
      const created = await createAssignment({ jobId, userId, problemId: questionId }, token);
      setLocalAssignments((prev) => [...prev, {
        ...created,
        userId,
      }]);
    } catch (error) {
      console.error("Failed to assign question:", error);
    }
  }, [token]);

  const toggleEdit = useCallback((key: string) => {
    setEditingCandidateKey((prev) => (prev === key ? null : key));
  }, []);

  const toggleInterview = useCallback((interviewId: number) => {
    setExpandedInterviews((prev) => ({ ...prev, [interviewId]: !prev[interviewId] }));
  }, []);

  const handleDeleteInterview = useCallback(async (interviewId: number) => {
    try {
      const relatedAssignments = localAssignments.filter((a) => a.jobId === interviewId);
      const relatedCandidates = localCandidates.filter((c) => c.jobId === interviewId);

      await Promise.all(relatedAssignments.map((a) => deleteAssignment(a.id, token)));
      await Promise.all(relatedCandidates.map((c) => deleteCandidate(c.id, token)));
      await deleteInterview(interviewId, token);

      setLocalAssignments((prev) => prev.filter((a) => a.jobId !== interviewId));
      setLocalCandidates((prev) => prev.filter((c) => c.jobId !== interviewId));
      setLocalInterviews((prev) => prev.filter((i) => i.id !== interviewId));
    } catch (error) {
      console.error("Failed to delete interview:", error);
    }
  }, [localAssignments, localCandidates, token]);

  const handleRenameInterview = useCallback(async (interviewId: number, newName: string) => {
    if (!newName.trim()) return;
    try {
      const activeToken = await getLatestToken();
      if (!activeToken) {
        throw new Error("Missing auth token.");
      }
      await updateInterview(interviewId, { jobRole: newName.trim() }, activeToken);
      setLocalInterviews((prev) =>
        prev.map((i) => (i.id === interviewId ? { ...i, jobRole: newName.trim() } : i))
      );
      setEditingInterviewId(null);
    } catch (error) {
      console.error("Failed to rename interview:", error);
    }
  }, [getLatestToken]);

  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }
  if (!isAuthenticated || !sessionUser) {
    return <div className="p-8">Please sign in.</div>;
  }
  if (sessionUser.role !== "ADMIN" && sessionUser.role !== "EXAMINER") {
    return <div className="p-8">You do not have access rights.</div>;
  }

  const myInterviews = localInterviews
    .filter((interview) =>
      interview.jobRole.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.jobRole.localeCompare(b.jobRole);
      return b.id - a.id;
    });

  const handleAddInterview = async () => {
    if (!sessionUser?.username || !jobRole.trim() || !token) {
      return;
    }
    const examiner = users.find((u) => u.username === sessionUser.username);
    if (!examiner?.id) {
      setSubmitError("Cannot resolve examiner user id from /api/v1/users.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const createdInterview = await createInterview({
        jobRole: jobRole.trim(),
        examinerEmpId: examiner.id,
      }, token);
      setLocalInterviews((prev) => [...prev, createdInterview]);
      setJobRole("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create interview.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Examiner Dashboard</h1>
      <section className="rounded-md border bg-[var(--sidebar-accent)] p-4">
        <h2 className="text-lg font-semibold">Add Interview</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={jobRole}
            onChange={(event) => setJobRole(event.target.value)}
            placeholder="Enter job role name"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleAddInterview}
            disabled={isSubmitting || !jobRole.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">Easy</p>
            <select
              value={easyCount}
              onChange={(e) => setEasyCount(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">Medium</p>
            <select
              value={mediumCount}
              onChange={(e) => setMediumCount(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">Hard</p>
            <select
              value={hardCount}
              onChange={(e) => setHardCount(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs text-muted-foreground">Start Time</label>
            <DateTimePicker value={startTime} onChange={setStartTime} placeholder="Pick start time" />
          </div>
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-xs text-muted-foreground">End Time</label>
            <DateTimePicker value={endTime} onChange={setEndTime} placeholder="Pick end time" />
          </div>
        </div>
        {submitError && <p className="mt-2 text-sm text-red-500">{submitError}</p>}
      </section>

      {/* Filter & Sort */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search interviews..."
          className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="newest">Newest</option>
            <option value="name">Name</option>

          </select>
        </div>
      </div>

      {myInterviews.map((interview) => {
        const myCandidates = localCandidates
          .filter((candidate) => candidate.jobId === interview.id)
          .filter(
            (candidate, index, arr) =>
              arr.findIndex((x) => x.jobId === candidate.jobId && x.userId === candidate.userId) === index
          );

        return (
          <section key={interview.id} className="rounded-md border bg-[var(--sidebar-accent)] p-4">
            <div className="flex items-start justify-between">
              <div>
                {editingInterviewId === interview.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingInterviewName}
                      onChange={(e) => setEditingInterviewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameInterview(interview.id, editingInterviewName);
                        if (e.key === "Escape") setEditingInterviewId(null);
                      }}
                      className="rounded-md border bg-background px-2 py-1 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRenameInterview(interview.id, editingInterviewName)}
                      className="rounded-md border-2 border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingInterviewId(null)}
                      className="rounded-md border-2 border-foreground/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-lg font-semibold cursor-pointer select-none"
                      onDoubleClick={() => {
                        setEditingInterviewId(interview.id);
                        setEditingInterviewName(interview.jobRole);
                      }}
                      title="Double-click to edit"
                    >
                      {interview.jobRole}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setDeleteInterviewConfirm(interview.id)}
                      className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
                      title="Delete Interview"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {myCandidates.length} candidate{myCandidates.length !== 1 ? "s" : ""}
                  {interview.startTime && (
                    <> · Start: {new Date(interview.startTime).toLocaleString("en-US")}</>
                  )}
                  {interview.endTime && (
                    <> · End: {new Date(interview.endTime).toLocaleString("en-US")}</>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/examiner/report?interviewId=${interview.id}`}
                  className="rounded-md bg-primary/60 px-8 py-2.5 text-xs font-medium text-center text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  View Interview Report
                </Link>
              </div>
            </div>

            {expandedInterviews[interview.id] && (<>
            <div className="mt-3 flex gap-3">
              <input
                type="text"
                value={candidateUsernames[interview.id] ?? ""}
                onChange={(e) =>
                  setCandidateEmails((prev) => ({ ...prev, [interview.id]: e.target.value }))
                }
                placeholder="Enter candidate username"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => handleAddCandidate(interview.id)}
                disabled={candidateSubmitting[interview.id] || !candidateUsernames[interview.id]?.trim()}
                className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-80"
              >
                {candidateSubmitting[interview.id] ? "Adding..." : "Add Candidate"}
              </button>
            </div>
            {candidateErrors[interview.id] && (
              <p className="mt-2 text-sm text-red-500">{candidateErrors[interview.id]}</p>
            )}

            <div className="mt-4 space-y-3">
              {myCandidates.map((candidate) => {
                const user = users.find((item) => item.id === candidate.userId);
                const candidateAssignments = localAssignments.filter(
                  (a) =>
                    a.userId === candidate.userId &&
                    a.jobId === interview.id
                );
                const editKey = `${interview.id}-${candidate.userId}`;
                const isEditing = editingCandidateKey === editKey;
                const assignedQuestionIds = new Set(candidateAssignments.map((a) => a.problemId));
                const availableQuestions = questions.filter(
                  (q) => Number.isFinite(q.id) && !assignedQuestionIds.has(q.id)
                );

                return (
                  <div key={candidate.id} className="rounded-md border bg-background p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user?.username ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEdit(editKey)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            isEditing
                              ? "bg-primary text-primary-foreground hover:bg-primary/80"
                              : "bg-primary/60 text-primary-foreground hover:bg-primary/80"
                          }`}
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidateConfirm(candidate.id)}
                          className="rounded-md bg-red-500/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500/80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...candidateAssignments]
                        .sort((a, b) => {
                          const qa = questions.find((item) => item.id === a.problemId);
                          const qb = questions.find((item) => item.id === b.problemId);
                          return difficultyRank(qa?.difficulty ?? "") - difficultyRank(qb?.difficulty ?? "");
                        })
                        .map((a) => {
                        const q = questions.find((item) => item.id === a.problemId);
                        return (
                          <span
                            key={a.id}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${q?.difficulty === "EASY" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : q?.difficulty === "MEDIUM" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : q?.difficulty === "HARD" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}
                          >
                            {q?.title ?? `Q#${a.problemId}`}
                          </span>
                        );
                      })}
                      {candidateAssignments.length === 0 && (
                        <span className="text-xs text-muted-foreground">No questions assigned</span>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-4 space-y-3 rounded-lg border border-amber-400/30 bg-amber-50 p-4 shadow-md dark:border-amber-500/20 dark:bg-amber-950/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Assigned Questions
                        </p>
                        {candidateAssignments.length > 0 ? (
                          <div className="space-y-2">
                            {[...candidateAssignments]
                              .sort((a, b) => {
                                const qa = questions.find((item) => item.id === a.problemId);
                                const qb = questions.find((item) => item.id === b.problemId);
                                return difficultyRank(qa?.difficulty ?? "") - difficultyRank(qb?.difficulty ?? "");
                              })
                              .map((a) => {
                              const q = questions.find((item) => item.id === a.problemId);
                              return (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between rounded-md border px-3 py-2"
                                >
                                  <span className="text-sm">{q?.title ?? `Q#${a.problemId}`}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(a.id)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">None</p>
                        )}

                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Add Question
                        </p>
                        <div className="flex gap-2">
                          <select
                            value={selectedDifficulty[editKey] ?? ""}
                            onChange={(e) =>
                              setSelectedDifficulty((prev) => ({ ...prev, [editKey]: e.target.value }))
                            }
                            className="w-28 shrink-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">All</option>
                            <option value="EASY">Easy</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HARD">Hard</option>
                          </select>

                          <Popover
                            open={comboboxOpen[editKey] ?? false}
                            onOpenChange={(open) =>
                              setComboboxOpen((prev) => ({ ...prev, [editKey]: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-ring"
                              >
                                {selectedQuestionId[editKey] === "random" ? (
                                  <span>Random Assign</span>
                                ) : selectedQuestionId[editKey] ? (
                                  <span>
                                    {availableQuestions.find((q) => q.id === selectedQuestionId[editKey])?.title ?? "Select a question..."}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Random Assign or select a question</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Search questions..."
                                  value={comboboxSearch[editKey] ?? ""}
                                  onValueChange={(value) =>
                                    setComboboxSearch((prev) => ({ ...prev, [editKey]: value }))
                                  }
                                />
                                <CommandList>
                                  <CommandEmpty>No questions found.</CommandEmpty>
                                  <CommandGroup>
                                    {!(comboboxSearch[editKey]?.trim()) && (
                                      <CommandItem
                                        onSelect={() => {
                                          setSelectedQuestionId((prev) => ({ ...prev, [editKey]: "random" }));
                                          setComboboxOpen((prev) => ({ ...prev, [editKey]: false }));
                                          setComboboxSearch((prev) => ({ ...prev, [editKey]: "" }));
                                        }}
                                        className="font-medium"
                                      >
                                        Random Assign
                                      </CommandItem>
                                    )}
                                    {availableQuestions
                                      .filter((q) => {
                                        const diff = selectedDifficulty[editKey];
                                        if (diff && String(q.difficulty).toUpperCase() !== diff) return false;
                                        const search = comboboxSearch[editKey]?.trim().toLowerCase();
                                        if (search && !q.title.toLowerCase().includes(search)) return false;
                                        return true;
                                      })
                                      .map((q) => (
                                        <CommandItem
                                          key={`${editKey}-${q.id}`}
                                          onSelect={() => {
                                            setSelectedQuestionId((prev) => ({ ...prev, [editKey]: q.id }));
                                            setComboboxOpen((prev) => ({ ...prev, [editKey]: false }));
                                            setComboboxSearch((prev) => ({ ...prev, [editKey]: "" }));
                                          }}
                                        >
                                          <span className="flex items-center gap-2">
                                            {q.title}
                                            <span className={`text-xs font-medium ${q.difficulty === "EASY" ? "text-green-600 dark:text-green-400" : q.difficulty === "MEDIUM" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                                              {q.difficulty}
                                            </span>
                                          </span>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          <button
                            type="button"
                            onClick={() => {
                              const selection = selectedQuestionId[editKey];
                              if (!selection) return;

                              let qId: number;
                              if (selection === "random") {
                                const diff = selectedDifficulty[editKey];
                                const filtered = diff
                                  ? availableQuestions.filter((q) => String(q.difficulty).toUpperCase() === diff)
                                  : availableQuestions;
                                if (filtered.length === 0) return;
                                const randomIndex = Math.floor(Math.random() * filtered.length);
                                qId = filtered[randomIndex].id;
                              } else {
                                qId = selection;
                              }
                              if (!Number.isFinite(qId)) return;
                              handleAssignQuestion(candidate.userId, qId, interview.id);
                              setSelectedQuestionId((prev) => ({ ...prev, [editKey]: "" }));
                            }}
                            disabled={!selectedQuestionId[editKey]}
                            className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-80"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {myCandidates.length === 0 && (
                <p className="text-sm text-muted-foreground">No candidates in this interview.</p>
              )}
            </div>
            </>)}

            <button
              type="button"
              onClick={() => toggleInterview(interview.id)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{expandedInterviews[interview.id] ? "See Less" : "See More"}</span>
              <span className={`text-[10px] transition-transform ${expandedInterviews[interview.id] ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
          </section>
        );
      })}

      {myInterviews.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No interviews found for this test user as examiner.
        </p>
      )}

      <Dialog
        open={deleteInterviewConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteInterviewConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Interview</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this interview? This action cannot be undone, and all candidates and assignments under this interview will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                if (deleteInterviewConfirm !== null) {
                  handleDeleteInterview(deleteInterviewConfirm);
                  setDeleteInterviewConfirm(null);
                }
              }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setDeleteInterviewConfirm(null)}
              className="rounded-md border-2 border-foreground/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteCandidateConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteCandidateConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Candidate</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this candidate from the interview? All their question assignments will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                if (deleteCandidateConfirm !== null) {
                  handleDeleteCandidate(deleteCandidateConfirm);
                  setDeleteCandidateConfirm(null);
                }
              }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setDeleteCandidateConfirm(null)}
              className="rounded-md border-2 border-foreground/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
