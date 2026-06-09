"use client";
import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function NavLinks({
  theme,
  pathname,
}: {
  theme: string | undefined;
  pathname: string;
}) {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const role = user?.role?.toUpperCase();
  const links: Array<{ href: string; label: string; active: boolean }> = [
    { href: "/", label: "Home", active: pathname === "/" },
  ];

  if (role === "ADMIN" || role === "EXAMINER") {
    links.push({ href: "/examiner", label: "Examiner", active: pathname === "/examiner" });
    links.push({ href: "/examiner/report", label: "Report", active: pathname === "/examiner/report" });
  }
  if (role === "ADMIN") {
    links.push({
      href: "/candidate-accounts",
      label: "Candidate Accounts",
      active: pathname === "/candidate-accounts",
    });
  }
  if (role === "ADMIN" || role === "QUESTIONER") {
    links.push({ href: "/questioner", label: "Questioner", active: pathname === "/questioner" });
  }

  const getLinkColor = (active: boolean) =>
    theme === "dark" ? (active ? "text-white" : "text-neutral-300") : active ? "" : "text-neutral-400";

  return (
    <div className="flex gap-4 w-[80%] text-sm">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={getLinkColor(link.active)}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
