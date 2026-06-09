"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";

export const useCurrentUser = (): {
  sessionUser: Session["user"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
} => {
  const { data: session, status } = useSession();

  return {
    sessionUser: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
};
