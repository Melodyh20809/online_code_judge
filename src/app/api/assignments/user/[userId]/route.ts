import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import {
  getAssignmentsForUserWithPrivilegedToken,
  getPrivilegedBackendToken,
} from "@/lib/backendPrivilegedApi";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const { userId } = await context.params;

  if (!sessionUser?._id) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const canReadAssignments =
    sessionUser._id === userId ||
    sessionUser.role === "ADMIN" ||
    sessionUser.role === "EXAMINER" ||
    sessionUser.role === "QUESTIONER";

  if (!canReadAssignments) {
    return NextResponse.json({ message: "Insufficient permissions." }, { status: 403 });
  }

  try {
    const token = await getPrivilegedBackendToken();
    const assignments = await getAssignmentsForUserWithPrivilegedToken(token, userId);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("[assignments-user-proxy] failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load assignments." },
      { status: 500 }
    );
  }
}
