"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFakeCurrentUser } from "@/hooks/useFakeCurrentUser";
import { useMockData } from "@/hooks/useMockData";

type Difficulty = "Easy" | "Medium" | "Hard";

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
  authorUserId: number | string;
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
    status: "Pending";
  }>;
};

//查看測試結果的數據(建立空白題目表單)
const createEmptyForm = (authorUserId: number | string): QuestionForm => ({
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
  ],
  timeLimitMs: 1000,
  authorUserId,
});

export default function QuestionerPage() {
  const { currentUser, isLoading: isLoadingUser } = useFakeCurrentUser();
  const { assignments, questions, users, isLoading: isLoadingData } = useMockData();

  const [form, setForm] = useState<QuestionForm>(() => createEmptyForm(0));
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionList, setQuestionList] = useState<QuestionForm[]>([]);
  //查看測試結果的數據(目前開啟彈出視窗的題目ID)
  const [resultQuestionId, setResultQuestionId] = useState<number | null>(null);

  useEffect(() => {
    setQuestionList(
      questions.map((question) => ({
        id: question.id,
        title: question.title,
        difficulty: "Easy",
        prompt: question.prompt,
        example: question.example,
        exampleAns: question.exampleAns,
        testCases: [
          {
            id: 1,
            input: question.testcase,
            expectedOutput: question.testcaseAns,
          },
        ],
        timeLimitMs: 1000,
        authorUserId: question.authorUserId,
      }))
    );
  }, [questions]);

  //查看測試結果的數據(依照每題整理統計數據)
  const resultStatsByQuestionId = useMemo<Record<number, QuestionResultStats>>(() => {
    return questionList.reduce<Record<number, QuestionResultStats>>((stats, question) => {
      const relatedAssignments = assignments.filter(
        (assignment) => assignment.questionId === question.id
      );

      //查看測試結果的數據(目前後端尚未儲存提交結果所以先顯示Pending)
      stats[question.id] = {
        assignedCount: relatedAssignments.length,
        submittedCount: 0,
        acceptedCount: 0,
        failedCount: 0,
        passRate: 0,
        candidates: relatedAssignments.map((assignment) => {
          const user = users.find((candidate) => candidate.id === assignment.userId);

          return {
            id: assignment.userId,
            name: user?.username ?? `User ${assignment.userId}`,
            email: user?.email ?? "",
            status: "Pending",
          };
        }),
      };

      return stats;
    }, {});
  }, [assignments, questionList, users]);

  //查看測試結果的數據(彈出視窗目前選到的題目)
  const resultQuestion =
    questionList.find((question) => question.id === resultQuestionId) ?? null;
  //查看測試結果的數據(彈出視窗目前選到題目的統計)
  const resultStats = resultQuestion ? resultStatsByQuestionId[resultQuestion.id] : null;

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

  const handleSaveQuestion = () => {
    if (!currentUser) return;

    if (!form.title.trim() || !form.prompt.trim()) {
      return;
    }

    if (editingQuestionId) {
      setQuestionList((prev) =>
        prev.map((question) =>
          question.id === editingQuestionId
            ? {
                ...form,
                id: editingQuestionId,
                authorUserId: question.authorUserId,
              }
            : question
        )
      );
    } else {
      const newQuestion: QuestionForm = {
        ...form,
        id: Date.now(),
        authorUserId: currentUser.id,
      };

      setQuestionList((prev) => [...prev, newQuestion]);
    }

    setForm(createEmptyForm(currentUser.id));
    setEditingQuestionId(null);
  };

  const handleEditQuestion = (question: QuestionForm) => {
    setForm(question);
    setEditingQuestionId(question.id);
  };

  const handleDeleteQuestion = (questionId: number) => {
    setQuestionList((prev) => prev.filter((question) => question.id !== questionId));

    if (editingQuestionId === questionId && currentUser) {
      setForm(createEmptyForm(currentUser.id));
      setEditingQuestionId(null);
    }

    if (resultQuestionId === questionId) {
      setResultQuestionId(null);
    }
  };

  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }

  if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "QUESTIONER")) {
    return <div className="p-8">You do not have access rights.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Questioner Console</h1>
      <p className="text-sm text-muted-foreground">
        Current test user: {currentUser.username}. The written-by-me flag is based on
        question.authorUserId.
      </p>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--sidebar-accent)]">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-left">Time Limit</th>
              <th className="px-4 py-3 text-left">Written by me</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questionList.map((question) => (
              <tr key={question.id} className="border-t">
                <td className="px-4 py-3">{question.id}</td>
                <td className="px-4 py-3">{question.title}</td>
                <td className="px-4 py-3">{question.difficulty}</td>
                <td className="px-4 py-3">{question.timeLimitMs} ms</td>
                <td className="px-4 py-3">
                  {question.authorUserId === currentUser.id ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      //查看測試結果的數據(開啟該題結果彈出視窗)
                      onClick={() => setResultQuestionId(question.id)}
                    >
                      Results
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditQuestion(question)}
                    >
                      Edit
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuestion(question.id)}
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
        <h2 className="font-semibold">
          {editingQuestionId ? "Edit Question" : "Create Question"}
        </h2>

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
              onChange={(event) =>
                updateForm("difficulty", event.target.value as Difficulty)
              }
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
              onChange={(event) =>
                updateForm("timeLimitMs", Number(event.target.value))
              }
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
            <Button type="button" onClick={handleSaveQuestion}>
              {editingQuestionId ? "Save Changes" : "Create Question"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!currentUser) return;
                setForm(createEmptyForm(currentUser.id));
                setEditingQuestionId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </section>

      {resultQuestion && resultStats && (
        //查看測試結果的數據(結果彈出視窗背景遮罩)
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-results-title"
          onClick={() => setResultQuestionId(null)}
        >
          <div
            //查看測試結果的數據(結果彈出視窗內容)
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
              <Button type="button" variant="outline" size="sm" onClick={() => setResultQuestionId(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-5">
                {/* //查看測試結果的數據(統計卡片區塊) */}
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

              <div className="rounded-md border">
                {/* //查看測試結果的數據(該題測試案例列表) */}
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
                {/* //查看測試結果的數據(候選人結果列表) */}
                <table className="w-full text-sm">
                  <thead className="bg-[var(--sidebar-accent)]">
                    <tr>
                      <th className="px-4 py-3 text-left">Candidate</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Passed Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultStats.candidates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No assigned candidates.
                        </td>
                      </tr>
                    ) : (
                      resultStats.candidates.map((candidate) => (
                        <tr key={candidate.id} className="border-t">
                          <td className="px-4 py-3">{candidate.name}</td>
                          <td className="px-4 py-3">{candidate.email || "N/A"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{candidate.status}</td>
                          <td className="px-4 py-3">0/{resultQuestion.testCases.length}</td>
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
