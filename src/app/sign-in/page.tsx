"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Sign in timed out.")), 15000);
    });

    const result = await Promise.race([
      signIn("credentials", {
        username,
        password,
        redirect: false,
      }),
      timeout,
    ]).catch((signInError) => {
      setError(
        signInError instanceof Error && signInError.message === "Sign in timed out."
          ? "Sign in timed out. Please check that the backend is running, then try again."
          : "Sign in failed. Please try again."
      );
      setIsSubmitting(false);
      return null;
    });

    if (!result) return;

    if (result?.error) {
      setError(result.error === "CredentialsSignin" ? "Invalid username or password." : result.error);
      setIsSubmitting(false);
      return;
    }

    window.location.assign("/");
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-md border bg-[var(--sidebar-accent)] p-6"
      >
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <p className="text-sm text-muted-foreground">Use your username and password to continue.</p>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          required
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
