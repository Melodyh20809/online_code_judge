"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  createProblem,
  deleteProblem,
  getProblemDetail,
  getProblemResults,
  getProblems,
} from "@/lib/problemApi";
import type { ApiDifficulty } from "@/types/problem";

type Difficulty = "Easy" | "Medium" | "Hard";
type DifficultyFilter = Difficulty | "All";
type SortOption = "newest" | "oldest" | "passRateDesc" | "passRateAsc";

type TestCase = {
  id: number;
  input: string;
  expectedOutput: string;
};

type QuestionForm = {
  id: number;
  title: string;
  difficulty: Difficulty;
  prompt: string;
  example: string;
  exampleAns: string;
  testCases: TestCase[];
  timeLimitMs: number;
  authorUsername: string;
  passRate: number;
};

type QuestionResultStats = {
  assignedCount: number;
  submittedCount: number;
  acceptedCount: number;
  failedCount: number;
  passRate: number;
  candidates: Array<{
    id: string;
    name: string;
    email: string;
    status: "Pending" | "Submitted" | "Accepted" | "Failed";
    passedCases: number;
    totalCases: number;
    score?: number;
    submittedAt?: string;
  }>;
};

const createEmptyForm = (): QuestionForm => ({
  id: 0,
  title: "",
  difficulty: "Easy",
  prompt: "",
  example: "",
  exampleAns: "",
  testCases: [
    {
      id: 1,
      input: "",
      expectedOutput: "",
    },
    {
      id: 2,
      input: "",
      expectedOutput: "",
    },
  ],
  timeLimitMs: 1000,
  authorUsername: "",
  passRate: 0,
});

const apiDifficultyToUi = (difficulty: ApiDifficulty): Difficulty => {
  if (difficulty === "MEDIUM") return "Medium";
  if (difficulty === "HARD") return "Hard";
  return "Easy";
};

const uiDifficultyToApi = (difficulty: Difficulty): ApiDifficulty => {
  if (difficulty === "Medium") return "MEDIUM";
  if (difficulty === "Hard") return "HARD";
  return "EASY";
};

const normalizeRole = (role?: string | null) => role?.trim().toUpperCase();

export default function QuestionerPage() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user ?? null;
  const sessionUserRole = normalizeRole(sessionUser?.role);
  const isAuthenticated = status === "authenticated";
  const isLoadingUser = status === "loading";
  const canManageProblems =
    sessionUserRole === "ADMIN" || sessionUserRole === "QUESTIONER";
  const accessToken = sessionUser?.accessToken;

  const [form, setForm] = useState<QuestionForm>(() => createEmptyForm());
  const [questionList, setQuestionList] = useState<QuestionForm[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("All");
  const [sortOption, setSortOption] = useState<SortOption>("oldest");
  const [resultQuestionId, setResultQuestionId] = useState<number | null>(null);
  const [resultStatsByQuestionId, setResultStatsByQuestionId] = useState<
    Record<number, QuestionResultStats>
  >({});

  useEffect(() => {
    if (!isAuthenticated || !canManageProblems) {
      setIsLoadingData(false);
      return;
    }

    let isMounted = true;

    const loadProblems = async () => {
      try {
        setIsLoadingData(true);
        setLoadError(null);

        const problemList = await getProblems();
        const problemDetails = await Promise.all(
          problemList.map(async (problem) => {
            const id = problem.id;
            const detail = await getProblemDetail(id);

            return {
              id,
              title: detail.title,
              difficulty: apiDifficultyToUi(detail.difficulty ?? "EASY"),
              prompt: detail.prompt,
              example: detail.example,
              exampleAns: detail.exampleAns,
              testCases: detail.testCases?.length
                ? detail.testCases.map((testCase, index) => ({
                    id: Number(testCase.id ?? index + 1),
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                  }))
                : [
                    {
                      id: 1,
                      input: detail.testcase,
                      expectedOutput: detail.testcaseAns,
                    },
                  ],
              timeLimitMs: detail.timeLimitMs ?? 1000,
              authorUsername: detail.author?.name ?? detail.author?.email ?? "Backend",
              passRate: 0,
            };
          })
        );

        if (!isMounted) return;
        setQuestionList(problemDetails);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load problems.");
      } finally {
        if (!isMounted) return;
        setIsLoadingData(false);
      }
    };

    void loadProblems();

    return () => {
      isMounted = false;
    };
  }, [canManageProblems, isAuthenticated]);

  useEffect(() => {
    if (!resultQuestionId) return;

    let isMounted = true;
    void getProblemResults(resultQuestionId, accessToken).then((stats) => {
      if (!isMounted) return;
      setResultStatsByQuestionId((prev) => ({
        ...prev,
        [resultQuestionId]: stats,
      }));
    });

    return () => {
      isMounted = false;
    };
  }, [accessToken, resultQuestionId]);

  const resultQuestion =
    questionList.find((question) => question.id === resultQuestionId) ?? null;
  const resultStats = resultQuestion ? resultStatsByQuestionId[resultQuestion.id] : null;

  const displayedQuestions = useMemo(() => {
    const filteredQuestions =
      difficultyFilter === "All"
        ? questionList
        : questionList.filter((question) => question.difficulty === difficultyFilter);

    return [...filteredQuestions].sort((a, b) => {
      const newestFirst = b.id - a.id;

      if (sortOption === "newest") return newestFirst;
      if (sortOption === "oldest") return a.id - b.id;

      const aPassRate = resultStatsByQuestionId[a.id]?.passRate ?? a.passRate;
      const bPassRate = resultStatsByQuestionId[b.id]?.passRate ?? b.passRate;

      if (aPassRate === bPassRate) return newestFirst;
      return sortOption === "passRateDesc" ? bPassRate - aPassRate : aPassRate - bPassRate;
    });
  }, [difficultyFilter, questionList, resultStatsByQuestionId, sortOption]);

  const updateForm = <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const addTestCase = () => {
    setForm((prev) => ({
      ...prev,
      testCases: [
        ...prev.testCases,
        {
          id: Date.now(),
          input: "",
          expectedOutput: "",
        },
      ],
    }));
  };

  const updateTestCase = (
    testCaseId: number,
    key: "input" | "expectedOutput",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      testCases: prev.testCases.map((testCase) =>
        testCase.id === testCaseId ? { ...testCase, [key]: value } : testCase
      ),
    }));
  };

  const removeTestCase = (testCaseId: number) => {
    setForm((prev) => ({
      ...prev,
      testCases:
        prev.testCases.length === 1
          ? prev.testCases
          : prev.testCases.filter((testCase) => testCase.id !== testCaseId),
    }));
  };

  const handleSaveQuestion = async () => {
    if (!sessionUser) return;
    if (!form.title.trim() || !form.prompt.trim()) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const firstTestCase = form.testCases[0] ?? {
        input: "",
        expectedOutput: "",
      };
      const createdProblem = await createProblem(
        {
          title: form.title.trim(),
          difficulty: uiDifficultyToApi(form.difficulty),
          prompt: form.prompt.trim(),
          example: form.example.trim(),
          exampleAns: form.exampleAns.trim(),
          testcase: firstTestCase.input.trim(),
          testcaseAns: firstTestCase.expectedOutput.trim(),
          authorUserId: 0,
          timeLimitMs: form.timeLimitMs,
          testCases: form.testCases.map((testCase) => ({
            input: testCase.input.trim(),
            expectedOutput: testCase.expectedOutput.trim(),
            isHidden: false,
          })),
        },
        accessToken
      );

      const detail = await getProblemDetail(createdProblem.id);

      const newQuestion: QuestionForm = {
        id: detail.id,
        title: detail.title,
        difficulty: apiDifficultyToUi(detail.difficulty ?? uiDifficultyToApi(form.difficulty)),
        prompt: detail.prompt,
        example: detail.example,
        exampleAns: detail.exampleAns,
        testCases: detail.testCases?.length
          ? detail.testCases.map((testCase, index) => ({
              id: Number(testCase.id ?? index + 1),
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
            }))
          : [
              {
                id: 1,
                input: detail.testcase,
                expectedOutput: detail.testcaseAns,
              },
            ],
        timeLimitMs: detail.timeLimitMs ?? form.timeLimitMs,
        authorUsername: sessionUser.name ?? sessionUser.email ?? "Backend",
        passRate: 0,
      };

      setQuestionList((prev) => [...prev, newQuestion]);

      setForm(createEmptyForm());
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save problem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    try {
      setSubmitError(null);
      await deleteProblem(questionId, accessToken);
      setQuestionList((prev) => prev.filter((question) => question.id !== questionId));

      if (resultQuestionId === questionId) {
        setResultQuestionId(null);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to delete problem.");
    }
  };

  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }

  if (!isAuthenticated || !sessionUser || !canManageProblems) {
    return <div className="p-8">You do not have access rights.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Questioner Console</h1>
      <p className="text-sm text-muted-foreground">
        Current backend user: {sessionUser.username}. Problems are loaded from the v1 backend API.
      </p>
      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      <div className="flex flex-col gap-4 rounded-md border bg-[var(--sidebar-accent)] p-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <label htmlFor="difficulty-filter" className="text-sm font-medium">
            Difficulty Filter
          </label>
          <select
            id="difficulty-filter"
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value as DifficultyFilter)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-48"
          >
            <option value="All">All</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="question-sort" className="text-sm font-medium">
            Sort By
          </label>
          <select
            id="question-sort"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-56"
          >
            <option value="newest">Newest to Oldest</option>
            <option value="oldest">Oldest to Newest</option>
            <option value="passRateDesc">Pass Rate High to Low</option>
            <option value="passRateAsc">Pass Rate Low to High</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--sidebar-accent)]">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-left">Time Limit</th>
              <th className="px-4 py-3 text-left">Pass Rate</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedQuestions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No questions match the selected filters.
                </td>
              </tr>
            )}
            {displayedQuestions.map((question) => (
              <tr key={question.id} className="border-t">
                <td className="px-4 py-3">{question.id}</td>
                <td className="px-4 py-3">{question.title}</td>
                <td className="px-4 py-3">{question.difficulty}</td>
                <td className="px-4 py-3">{question.timeLimitMs} ms</td>
                <td className="px-4 py-3">
                  {(resultStatsByQuestionId[question.id]?.passRate ?? question.passRate).toFixed(0)}%
                </td>
                <td className="px-4 py-3">{question.authorUsername}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResultQuestionId(question.id)}
                    >
                      Results
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDeleteQuestion(question.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-md border bg-[var(--sidebar-accent)] p-4">
        <h2 className="font-semibold">Create Question</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Test cases are sent to the backend as visible sample cases for the problem detail page.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="Two Sum"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(event) => updateForm("difficulty", event.target.value as Difficulty)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <textarea
              value={form.prompt}
              onChange={(event) => updateForm("prompt", event.target.value)}
              className="min-h-28 w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Describe the problem..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Example</label>
            <textarea
              value={form.example}
              onChange={(event) => updateForm("example", event.target.value)}
              className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Input: nums = [2,7,11,15], target = 9"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Example Answer</label>
            <textarea
              value={form.exampleAns}
              onChange={(event) => updateForm("exampleAns", event.target.value)}
              className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Output: [0,1]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time Limit ms</label>
            <input
              type="number"
              min={100}
              step={100}
              value={form.timeLimitMs}
              onChange={(event) => updateForm("timeLimitMs", Number(event.target.value))}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Test Cases</label>
              <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
                Add Test Case
              </Button>
            </div>

            {form.testCases.map((testCase, index) => (
              <div key={testCase.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Test Case {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTestCase(testCase.id)}
                  >
                    Remove
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium">Input</label>
                  <textarea
                    value={testCase.input}
                    onChange={(event) =>
                      updateTestCase(testCase.id, "input", event.target.value)
                    }
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium">Expected Output</label>
                  <textarea
                    value={testCase.expectedOutput}
                    onChange={(event) =>
                      updateTestCase(testCase.id, "expectedOutput", event.target.value)
                    }
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={() => void handleSaveQuestion()} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Create Question"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(createEmptyForm());
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </section>

      {resultQuestion && resultStats && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-results-title"
          onClick={() => setResultQuestionId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-md border bg-background shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 id="question-results-title" className="text-xl font-semibold">
                  {resultQuestion.title} Results
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Question ID: {resultQuestion.id}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResultQuestionId(null)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="mt-1 text-2xl font-semibold">{resultStats.assignedCount}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="mt-1 text-2xl font-semibold">{resultStats.submittedCount}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="mt-1 text-2xl font-semibold text-green-600">
                    {resultStats.acceptedCount}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="mt-1 text-2xl font-semibold text-red-600">
                    {resultStats.failedCount}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                  <p className="mt-1 text-2xl font-semibold">{resultStats.passRate}%</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Results are assembled from existing assignments and candidate submission history.
              </p>

              <div className="rounded-md border">
                <div className="border-b bg-[var(--sidebar-accent)] px-4 py-3 font-semibold">
                  Test Cases
                </div>
                <div className="divide-y">
                  {resultQuestion.testCases.map((testCase, index) => (
                    <div key={testCase.id} className="grid gap-3 p-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium">Case {index + 1} Input</p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
                          {testCase.input || "N/A"}
                        </pre>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Expected Output</p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
                          {testCase.expectedOutput || "N/A"}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--sidebar-accent)]">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultStats.candidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          No assigned candidates.
                        </td>
                      </tr>
                    ) : (
                      resultStats.candidates.map((candidate) => (
                        <tr key={candidate.id} className="border-t">
                          <td className="px-4 py-3">{candidate.name}</td>
                          <td className="px-4 py-3">{candidate.email || "N/A"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{candidate.status}</td>
                          <td className="px-4 py-3">
                            {candidate.score ?? "N/A"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {candidate.submittedAt
                              ? new Date(candidate.submittedAt).toLocaleString("en-US")
                              : "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
