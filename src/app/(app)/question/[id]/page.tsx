"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMockData } from "@/hooks/useMockData";
import { canAccessQuestion } from "@/lib/access";
import { getQuestionById, fetchQuestionDetail, type QuestionDetail } from "@/lib/mockData";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

// ?? Submission Result Types ????????????????????????????????
type SubmissionResult = {
  id: string;
  status: string;
  score: number;
  executionTimeMs: number | null;
  memoryUsageKb: number | null;
  passedCases: number;
  totalCases: number;
  compileMessage: string;
  submittedAt: string;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  WRONG_ANSWER: { label: "Wrong Answer", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  TLE: { label: "Time Limit Exceeded", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400" },
  MLE: { label: "Memory Limit Exceeded", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400" },
  COMPILE_ERROR: { label: "Compile Error", color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" },
};
const FINAL_STATUSES = new Set([
  "ACCEPTED",
  "WRONG_ANSWER",
  "TLE",
  "MLE",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
]);

function buildStarterCode(language: string, functionName?: string) {
  const safeFunctionName = (functionName || "solve").replace(/[^a-zA-Z0-9_$]/g, "") || "solve";
  if (language === "python") {
    return [
      "from typing import *",
      "",
      "class Solution:",
      `    def ${safeFunctionName}(self, nums1: List[int], nums2: List[int]) -> float:`,
      "        # TODO: implement",
      "        pass",
      "",
    ].join("\n");
  }
  if (language === "cpp") {
    return [
      "#include <vector>",
      "using namespace std;",
      "",
      "class Solution {",
      "public:",
      `    double ${safeFunctionName}(vector<int>& nums1, vector<int>& nums2) {`,
      "        // TODO: implement",
      "        return 0.0;",
      "    }",
      "};",
      "",
    ].join("\n");
  }
  if (language === "java") {
    return [
      "import java.util.*;",
      "",
      "class Solution {",
      `    public double ${safeFunctionName}(int[] nums1, int[] nums2) {`,
      "        // TODO: implement",
      "        return 0.0;",
      "    }",
      "}",
      "",
    ].join("\n");
  }
  return [
    "/**",
    " * @param {number[]} nums1",
    " * @param {number[]} nums2",
    " * @return {number}",
    " */",
    `var ${safeFunctionName} = function(nums1, nums2) {`,
    "  // TODO: implement",
    "};",
    "",
    "module.exports = {",
    `  ${safeFunctionName},`,
    "}",
  ].join("\n");
}

function renderDescription(description: string, title?: string) {
  const chunks = description.replace(/\r\n/g, "\n").split("```");
  return chunks.map((chunk, idx) => {
    const isCode = idx % 2 === 1;
    if (isCode) {
      return (
        <pre key={`code-${idx}`} className="mt-3 overflow-auto rounded-md border bg-muted p-3 text-xs">
          <code>{chunk.trim()}</code>
        </pre>
      );
    }

    return chunk
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .map((line, lineIdx) => {
        if (!line.trim()) return <div key={`sp-${idx}-${lineIdx}`} className="h-2" />;
        const normalized = line.replace(/^#{1,3}\s+/, "").trim().toLowerCase();
        if (title && normalized === title.trim().toLowerCase()) {
          return null;
        }
        if (line.startsWith("### ")) {
          return <h3 key={`h3-${idx}-${lineIdx}`} className="mt-4 text-base font-semibold">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={`h2-${idx}-${lineIdx}`} className="mt-5 text-lg font-semibold">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={`h1-${idx}-${lineIdx}`} className="mt-5 text-xl font-semibold">{line.slice(2)}</h1>;
        }
        return <p key={`p-${idx}-${lineIdx}`} className="text-sm leading-6">{line}</p>;
      });
  });
}

export default function QuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { sessionUser, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { assignments, questions, users, isLoading: isLoadingData } = useMockData();
  const [sourceCode, setSourceCode] = useState<string>("");
  const [language, setLanguage] = useState<string>("javascript");
  const [leftTab, setLeftTab] = useState<"description" | "result">("description");
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionResult[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(null);

  const questionId = Number(params.id);
  const question = useMemo(() => getQuestionById(questions, questionId), [questionId, questions]);
  const token = sessionUser?.accessToken || null;

  useEffect(() => {
    if (!questionId) return;
    fetchQuestionDetail(questionId, token).then((detail) => {
      if (detail) setQuestionDetail(detail);
    });
  }, [questionId, token]);

  useEffect(() => {
    if (!questionDetail) return;
    if (sourceCode.trim().length > 0) return;
    setSourceCode(buildStarterCode(language, questionDetail.functionName));
  }, [questionDetail, sourceCode, language]);

  const handleLanguageChange = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    setSourceCode(buildStarterCode(nextLanguage, questionDetail?.functionName));
  };
  if (isLoadingUser || isLoadingData) {
    return <div className="p-8">Loading...</div>;
  }

  if (!question) {
    return (
      <div className="p-8">
        <p className="text-lg font-medium">Question not found.</p>
        <Link href="/" className="text-sm text-blue-500 underline">
          Back to home
        </Link>
      </div>
    );
  }
  if (!isAuthenticated || !sessionUser) {
    return <div className="p-8">Please sign in.</div>;
  }

  const resolvedUserId =
    users.find((u) => u.username === sessionUser.username)?.id ??
    users.find((u) => u.id === sessionUser._id)?.id ??
    sessionUser._id ??
    "";

  if (
    !canAccessQuestion(
      {
        id: resolvedUserId,
        role: sessionUser.role ?? "CANDIDATE",
      },
      questionId,
      assignments
    )
  ) {
    return <div className="p-8">You do not have access rights.</div>;
  }

  const handleSubmit = async () => {
    if (!sessionUser || !question) {
      toast.error("Unable to submit right now.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/submissions`,
        {
          problem_id: questionId,
          source_code: sourceCode,
          language,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const submission = response.data ?? {};
      const submissionId = String(submission.submission_id ?? submission.id ?? "");

      const pendingResult: SubmissionResult = {
        id: submissionId || `local-${Date.now()}`,
        status: String(submission.status ?? "PENDING"),
        score: Number(submission.score ?? 0),
        executionTimeMs: null,
        memoryUsageKb: null,
        passedCases: 0,
        totalCases: 0,
        compileMessage: "",
        submittedAt: new Date().toISOString(),
      };

      setSubmissionHistory((prev) => [pendingResult, ...prev]);
      setSelectedSubmission(pendingResult);
      setLeftTab("result");
      toast.success("Submitted. Waiting for judge result...");

      if (!submissionId) return;

      const maxTries = 20;
      for (let i = 0; i < maxTries; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        try {
          const resultRes = await axios.get(`${API_BASE_URL}/api/v1/submissions/${submissionId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const latest = resultRes.data ?? {};
          const updated: SubmissionResult = {
            id: String(latest.submission_id ?? submissionId),
            status: String(latest.status ?? "PENDING"),
            score: Number(latest.score ?? 0),
            executionTimeMs: Number(latest.metrics?.execution_time_ms ?? 0) || null,
            memoryUsageKb: Number(latest.metrics?.memory_usage_kb ?? 0) || null,
            passedCases: Number(latest.passedCases ?? 0),
            totalCases: Number(latest.totalCases ?? 0),
            compileMessage: String(latest.compile_message ?? ""),
            submittedAt: String(latest.submitted_at ?? pendingResult.submittedAt),
          };

          setSubmissionHistory((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          setSelectedSubmission((prev) => (prev?.id === updated.id ? updated : prev));

          if (FINAL_STATUSES.has(updated.status)) {
            break;
          }
        } catch {
          // keep polling
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Submit failed.");
      } else {
        toast.error("Submit failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const latestResult = submissionHistory[0] ?? null;
  const bestScore = submissionHistory.length > 0 ? Math.max(...submissionHistory.map((s) => s.score)) : null;
  const displayResult = selectedSubmission;
  const hasExampleInDescription = Boolean(
    questionDetail?.description && /(^|\n)\s*#{0,3}\s*example\b/i.test(questionDetail.description)
  );

  return (
    <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 gap-3 p-3 md:grid-cols-2">
      {/* Left Panel */}
      <section className="flex flex-col rounded-md border bg-[var(--sidebar-accent)]">
        {/* Tabs */}
        <div className="flex items-center border-b">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setLeftTab("description")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              leftTab === "description"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Description
          </button>
          <button
            type="button"
            onClick={() => setLeftTab("result")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              leftTab === "result"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Result
            {latestResult && (
              <span className={`ml-1.5 inline-block h-2 w-2 rounded-full ${latestResult.status === "ACCEPTED" ? "bg-green-500" : "bg-red-500"}`} />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-5">
          {leftTab === "description" && (
            <>
              <h1 className="text-xl font-semibold">{question.title}</h1>
              {questionDetail ? (
                <>
                  <div className="mt-4 space-y-1">{renderDescription(questionDetail.description, question.title)}</div>

                  {questionDetail.sampleTestCases.length > 0 && !hasExampleInDescription && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-semibold">Sample Test Cases</h3>
                      {questionDetail.sampleTestCases.map((tc, i) => (
                        <div key={i} className="rounded-md border bg-background p-3 text-sm">
                          <p className="text-xs font-medium text-muted-foreground">Example {i + 1}</p>
                          <div className="mt-1">
                            <span className="text-xs text-muted-foreground">Input:</span>
                            <pre className="mt-0.5 rounded bg-muted p-2 text-xs">{tc.input}</pre>
                          </div>
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">Output:</span>
                            <pre className="mt-0.5 rounded bg-muted p-2 text-xs">{tc.output}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Loading description...</p>
              )}
            </>
          )}

          {leftTab === "result" && submissionHistory.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No submission yet. Submit your code to see results.</p>
            </div>
          )}

          {leftTab === "result" && submissionHistory.length > 0 && displayResult && (
            <div className="space-y-5">
              {/* Current Result */}
              <div className="space-y-4">
                {/* Status + Score */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${(statusConfig[displayResult.status] ?? { color: "bg-gray-100 text-gray-800" }).color}`}>
                    {(statusConfig[displayResult.status] ?? { label: displayResult.status }).label}
                  </span>
                  <span className={`text-2xl font-bold ${displayResult.score >= 80 ? "text-green-600 dark:text-green-400" : displayResult.score >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                    {displayResult.score} pts
                  </span>
                </div>

                {/* Test Case Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Test Cases</span>
                    <span className="font-medium">{displayResult.passedCases}/{displayResult.totalCases} passed</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${displayResult.totalCases > 0 ? (displayResult.passedCases / displayResult.totalCases) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Execution Time</p>
                    <p className="mt-1 text-sm font-medium">
                      {displayResult.executionTimeMs != null ? `${displayResult.executionTimeMs} ms` : "-"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Memory Usage</p>
                    <p className="mt-1 text-sm font-medium">
                      {displayResult.memoryUsageKb != null ? `${(displayResult.memoryUsageKb / 1024).toFixed(1)} MB` : "-"}
                    </p>
                  </div>
                </div>

                {/* Compile Error */}
                {displayResult.compileMessage && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    <p className="font-medium">Compile Error</p>
                    <pre className="mt-1 text-xs">{displayResult.compileMessage}</pre>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Submissions</span>
                  <span className="font-medium">{submissionHistory.length}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Best Score</span>
                  <span className={`font-bold ${bestScore! >= 80 ? "text-green-600 dark:text-green-400" : bestScore! >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                    {bestScore} pts
                  </span>
                </div>
              </div>

              {/* Submission History */}
              <div>
                <p className="text-sm font-medium">Submission History</p>
                <div className="mt-2 space-y-2">
                  {submissionHistory.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${selectedSubmission?.id === sub.id ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(statusConfig[sub.status] ?? { color: "bg-gray-100 text-gray-800" }).color}`}>
                          {(statusConfig[sub.status] ?? { label: sub.status }).label}
                        </span>
                        <span className="font-medium">{sub.score} pts</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{sub.passedCases}/{sub.totalCases}</span>
                        <span>{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Right Panel - Code Editor */}
      <section className="rounded-md border bg-[var(--sidebar-accent)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Code Editor</h2>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>
        </div>
        <div className="h-[58vh] overflow-hidden rounded-md border">
          <Editor
            height="100%"
            language={language}
            value={sourceCode}
            onChange={(value) => setSourceCode(value ?? "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              padding: { top: 12 },
            }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md bg-primary/60 px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Run
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-green-600/80 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </section>
    </div>
  );
}

