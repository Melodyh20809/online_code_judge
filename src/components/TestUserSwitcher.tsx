"use client";

import { useSession } from "next-auth/react";

export default function TestUserSwitcher() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;
  const isGuest = status !== "authenticated";

  return (
    <div className="text-xs text-muted-foreground">
      {isGuest ? "Guest mode" : `Signed in: ${user?.email ?? "Unknown"}`}
    </div>
  );
}
