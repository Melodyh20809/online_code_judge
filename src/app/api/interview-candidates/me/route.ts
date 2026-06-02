import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import {
  getInterviewCandidateForUserJobWithPrivilegedToken,
  getPrivilegedBackendToken,
} from "@/lib/backendPrivilegedApi";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?._id;

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const jobId = Number(request.nextUrl.searchParams.get("jobId"));
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ message: "jobId is required." }, { status: 400 });
  }

  try {
    const token = await getPrivilegedBackendToken();
    const candidate = await getInterviewCandidateForUserJobWithPrivilegedToken(token, userId, jobId);

    if (!candidate) {
      return NextResponse.json({ message: "Interview candidate not found." }, { status: 404 });
    }

    return NextResponse.json(candidate);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load interview candidate." },
      { status: 500 }
    );
  }
}
