"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useSession } from "next-auth/react";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  const goPath = useMemo(() => {
    if (!user) return "/";
    const role = user.role;
    if (role === "ADMIN" || role === "QUESTIONER") return "/questioner";
    if (role === "EXAMINER") return "/examiner";
    return `/candidates/${user._id}`;
  }, [user]);

  const handleGo = () => router.push(goPath);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-8">
      <div className="w-full max-w-3xl rounded-lg border bg-[var(--sidebar-accent)] p-10">
        <h1 className="text-center text-5xl font-bold tracking-tight">Online Code Test</h1>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sign in to access your portal.
        </p>
        <div className="mt-8 rounded-md border bg-background p-6">
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={handleGo}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to my portal
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/sign-in")}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
