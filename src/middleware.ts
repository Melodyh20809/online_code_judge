import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { NEXT_AUTH_SECRET } from "@/lib/authSecret";

type AuthToken = {
  _id?: string;
  role?: string;
};

const getHomePathFromToken = (token: AuthToken | null) => {
  const role = token?.role?.toUpperCase();
  if (role === "ADMIN" || role === "QUESTIONER") return "/questioner";
  if (role === "EXAMINER") return "/examiner";
  if (role === "USER" || role === "CANDIDATE") return `/candidates/${token?._id}`;
  return `/candidates/${token?._id}`;
};

export async function middleware(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: NEXT_AUTH_SECRET,
  })) as AuthToken | null;
  const url = request.nextUrl;

  if (
    token &&
    (url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up"))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isProtected =
    url.pathname.startsWith("/examiner") ||
    url.pathname.startsWith("/questioner") ||
    url.pathname.startsWith("/candidates") ||
    url.pathname.startsWith("/question");

  if (!token && isProtected) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirect /candidates to /candidates/:id
  if (token && url.pathname === "/candidates") {
    return NextResponse.redirect(new URL(`/candidates/${token._id}`, request.url));
  }

  // Role-based guards
  if (token) {
    const role = token.role?.toUpperCase();
    if (url.pathname.startsWith("/examiner") && role !== "ADMIN" && role !== "EXAMINER") {
      return NextResponse.redirect(new URL(getHomePathFromToken(token), request.url));
    }
    if (url.pathname.startsWith("/questioner") && role !== "ADMIN" && role !== "QUESTIONER") {
      return NextResponse.redirect(new URL(getHomePathFromToken(token), request.url));
    }
    if (
      url.pathname.startsWith("/candidates") &&
      role !== "ADMIN" &&
      role !== "CANDIDATE" &&
      role !== "USER"
    ) {
      return NextResponse.redirect(new URL(getHomePathFromToken(token), request.url));
    }
    if (
      url.pathname.startsWith("/question") &&
      role !== "ADMIN" &&
      role !== "CANDIDATE" &&
      role !== "USER"
    ) {
      return NextResponse.redirect(new URL(getHomePathFromToken(token), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/sign-in",
    "/sign-up",
    "/examiner/:path*",
    "/questioner/:path*",
    "/candidates/:path*",
    "/question/:path*",
  ],
};
