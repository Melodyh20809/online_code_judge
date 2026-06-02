import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-6">
      <div
        className="w-full max-w-md space-y-4 rounded-md border bg-[var(--sidebar-accent)] p-6"
      >
        <h1 className="text-2xl font-semibold">Account creation is managed by admins</h1>
        <p className="text-sm text-muted-foreground">
          Candidate accounts are created by an admin. Please sign in with the account you received.
        </p>

        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
