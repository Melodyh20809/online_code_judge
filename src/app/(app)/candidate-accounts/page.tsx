"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hashPasswordToSHA256 } from "@/lib/passwordHash";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

type CandidateAccountRow = {
  id: number;
  username: string;
  password: string;
  status: "idle" | "created" | "failed";
  message?: string;
};

type CandidateUser = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type RawBackendUser = {
  id?: unknown;
  username?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isAdmin?: unknown;
  isExaminer?: unknown;
  isQuestioner?: unknown;
  isCandidate?: unknown;
};

const PASSWORD_GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*+-_?",
] as const;
const PASSWORD_CHARACTERS = PASSWORD_GROUPS.join("");
const GENERATED_PASSWORD_LENGTH = 16;

const getRandomIndex = (maxExclusive: number) => {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % maxExclusive;
};

const pickRandomCharacter = (characters: string) =>
  characters[getRandomIndex(characters.length)];

const shuffleCharacters = (characters: string[]) => {
  const shuffled = [...characters];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.join("");
};

const generatePassword = () => {
  const requiredCharacters = PASSWORD_GROUPS.map(pickRandomCharacter);
  const remainingCharacters = Array.from(
    { length: GENERATED_PASSWORD_LENGTH - requiredCharacters.length },
    () => pickRandomCharacter(PASSWORD_CHARACTERS)
  );

  return shuffleCharacters([...requiredCharacters, ...remainingCharacters]);
};

const createRows = (count: number, startId = 1): CandidateAccountRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: startId + index,
    username: "",
    password: generatePassword(),
    status: "idle",
  }));

const extractList = (raw: unknown): RawBackendUser[] => {
  if (Array.isArray(raw)) return raw as RawBackendUser[];
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;
  for (const key of ["items", "data", "list", "results", "rows", "users"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as RawBackendUser[];
    if (value && typeof value === "object") {
      const nested = extractList(value);
      if (nested.length > 0) return nested;
    }
  }

  return [];
};

const normalizeUser = (user: RawBackendUser): CandidateUser => {
  const rawRole = String(user.role ?? "").toUpperCase();
  let role = rawRole || "CANDIDATE";

  if (!rawRole) {
    if (user.isAdmin) role = "ADMIN";
    else if (user.isExaminer) role = "EXAMINER";
    else if (user.isQuestioner) role = "QUESTIONER";
    else if (user.isCandidate) role = "CANDIDATE";
  }

  return {
    id: String(user.id ?? ""),
    username: String(user.username ?? user.name ?? user.email ?? ""),
    email: String(user.email ?? ""),
    role,
  };
};

export default function CandidateAccountsPage() {
  const { data: session, status } = useSession();
  const [count, setCount] = useState(3);
  const [rows, setRows] = useState<CandidateAccountRow[]>(() => createRows(3));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [candidateUsers, setCandidateUsers] = useState<CandidateUser[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateListError, setCandidateListError] = useState<string | null>(null);

  const sessionUser = session?.user ?? null;
  const isAdmin = sessionUser?.role?.toUpperCase() === "ADMIN";
  const token = sessionUser?.accessToken;
  const nextRowId = useMemo(() => Math.max(0, ...rows.map((row) => row.id)) + 1, [rows]);
  const filteredCandidateUsers = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();
    if (!query) return candidateUsers;

    return candidateUsers.filter((candidate) =>
      [candidate.username, candidate.email, candidate.id]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [candidateSearch, candidateUsers]);

  const loadCandidateUsers = useCallback(async () => {
    if (!isAdmin || !token) return;

    setIsLoadingCandidates(true);
    setCandidateListError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Failed to load users with HTTP ${response.status}.`);
      }

      const users = extractList(await response.json())
        .map(normalizeUser)
        .filter((user) => user.role === "CANDIDATE" || user.role === "USER")
        .sort((a, b) => a.username.localeCompare(b.username));

      setCandidateUsers(users);
    } catch (error) {
      setCandidateListError(error instanceof Error ? error.message : "Failed to load candidates.");
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    void loadCandidateUsers();
  }, [loadCandidateUsers]);

  const handleGenerateRows = () => {
    const safeCount = Math.max(1, Math.min(50, Number.isFinite(count) ? count : 1));
    setCount(safeCount);
    setSummary(null);
    setRows(createRows(safeCount));
  };

  const updateRow = (id: number, field: "username" | "password", value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === id ? { ...row, [field]: value, status: "idle", message: undefined } : row
      )
    );
  };

  const addRow = () => {
    setRows((currentRows) => [
      ...currentRows,
      {
        id: nextRowId,
        username: "",
        password: generatePassword(),
        status: "idle",
      },
    ]);
    setCount((currentCount) => currentCount + 1);
  };

  const removeRow = (id: number) => {
    setRows((currentRows) => {
      const nextRows = currentRows.filter((row) => row.id !== id);
      setCount(nextRows.length || 1);
      return nextRows.length ? nextRows : createRows(1);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSummary(null);

    const updatedRows: CandidateAccountRow[] = [];

    for (const row of rows) {
      const username = row.username.trim();
      const password = row.password.trim();

      if (!username || !password) {
        updatedRows.push({
          ...row,
          status: "failed",
          message: "Username and password are required.",
        });
        continue;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email: `${username}@candidate.local`,
            passwordSha256: hashPasswordToSHA256(password),
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Signup failed with HTTP ${response.status}.`);
        }

        updatedRows.push({ ...row, username, password, status: "created", message: "Created" });
      } catch (error) {
        updatedRows.push({
          ...row,
          status: "failed",
          message: error instanceof Error ? error.message : "Failed to create account.",
        });
      }
    }

    const createdCount = updatedRows.filter((row) => row.status === "created").length;
    const failedCount = updatedRows.filter((row) => row.status === "failed").length;

    setRows(updatedRows);
    setSummary(`${createdCount} account${createdCount === 1 ? "" : "s"} created, ${failedCount} failed.`);
    setIsSubmitting(false);
    if (createdCount > 0) {
      void loadCandidateUsers();
    }
  };

  if (status === "loading") {
    return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Candidate Accounts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only admins can manage candidate accounts.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Candidate Accounts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create candidate login accounts with generated passwords.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">
            Number of accounts
            <Input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-36"
            />
          </label>
          <Button type="button" variant="outline" onClick={handleGenerateRows}>
            <Plus />
            Generate
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_120px_56px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>#</span>
            <span>Username</span>
            <span>Generated Password</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_120px_56px] items-start gap-3 px-4 py-3"
              >
                <span className="pt-2 text-sm text-muted-foreground">{index + 1}</span>
                <Input
                  value={row.username}
                  onChange={(event) => updateRow(row.id, "username", event.target.value)}
                  placeholder={`candidate${String(index + 1).padStart(3, "0")}`}
                  disabled={isSubmitting}
                  required
                />
                <Input
                  value={row.password}
                  onChange={(event) => updateRow(row.id, "password", event.target.value)}
                  disabled={isSubmitting}
                  required
                  minLength={12}
                  autoComplete="off"
                />
                <div className="pt-2 text-sm">
                  {row.status === "created" && <span className="text-green-600">Created</span>}
                  {row.status === "failed" && <span className="text-red-500">Failed</span>}
                  {row.status === "idle" && <span className="text-muted-foreground">Ready</span>}
                  {row.message && row.status === "failed" && (
                    <p className="mt-1 line-clamp-2 text-xs text-red-500" title={row.message}>
                      {row.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={isSubmitting}
                  aria-label="Remove account row"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={addRow} disabled={isSubmitting}>
            <Plus />
            Add row
          </Button>
          <div className="flex items-center gap-4">
            {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
            <Button type="submit" disabled={isSubmitting || rows.length === 0}>
              <Save />
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>

      <section className="mt-10 border-t pt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Existing Candidates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidateUsers.length} candidate account{candidateUsers.length === 1 ? "" : "s"} found.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder="Search username, email, or id"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={loadCandidateUsers} disabled={isLoadingCandidates}>
              <RefreshCw className={isLoadingCandidates ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        {candidateListError && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {candidateListError}
          </p>
        )}

        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,2fr)_120px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>Username</span>
            <span>Email</span>
            <span>User ID</span>
            <span>Role</span>
          </div>
          <div className="divide-y">
            {isLoadingCandidates ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">Loading candidates...</div>
            ) : filteredCandidateUsers.length > 0 ? (
              filteredCandidateUsers.map((candidate) => (
                <div
                  key={candidate.id || candidate.username}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,2fr)_120px] gap-3 px-4 py-3 text-sm"
                >
                  <span className="truncate font-medium">{candidate.username || "-"}</span>
                  <span className="truncate text-muted-foreground">{candidate.email || "-"}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{candidate.id || "-"}</span>
                  <span>{candidate.role}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-5 text-sm text-muted-foreground">
                No candidate accounts match your search.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
