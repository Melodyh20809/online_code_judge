"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "./ui/button";
import Link from "next/link";
import NavLinks from "./NavLinks";
import NavRunButtonsContainer from "./NavRunButtonsContainer";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function Header() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfile) return;
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showProfile]);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const sessionUser = session?.user ?? null;
  const isGuest = status !== "authenticated";
  const initials = useMemo(
    () =>
      sessionUser?.username
        ?.trim()
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() ?? "G",
    [sessionUser?.username]
  );

  useEffect(() => {
    setMounted(true);
  }, []);


  // this line help us to avoid theme hydration error
  if (!mounted) {
    return null;
  }

  return (
    <header className="relative z-30 flex h-12 w-full items-center justify-between border-b-2 px-8">
      <div className="h-6 w-6" aria-hidden="true" />
      {pathname.startsWith("/problem/") ? (
        <NavRunButtonsContainer theme={theme} session={null} />
      ) : (
        <NavLinks theme={theme} pathname={pathname} />
      )}
      <div className="flex items-center gap-4">
        {isGuest ? (
          <div className="flex items-center gap-4">
            <Link href="/sign-up">
              <Button variant="outline" className="cursor-pointer font-semibold">
                Sign up
              </Button>
            </Link>
            <p>or</p>
            <Link href="/sign-in">
              <Button variant="outline" className="cursor-pointer font-semibold">
                Sign in
              </Button>
            </Link>
          </div>
        ) : (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfile((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--sidebar-accent)] text-xs font-semibold"
            >
              {initials}
            </button>
            {showProfile && sessionUser && (
              <div className="absolute right-0 mt-2 w-60 rounded-md border bg-background p-3 text-sm shadow-md">
                <p className="font-semibold">{sessionUser.username ?? "User"}</p>
                <p className="text-muted-foreground">{sessionUser.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Role: {sessionUser.role ?? "CANDIDATE"}
                </p>
                <button
                  type="button"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="mt-3 w-full rounded-md border px-3 py-2 text-left text-sm"
                >
                  {resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="mt-2 w-full rounded-md border px-3 py-2 text-left text-sm"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
