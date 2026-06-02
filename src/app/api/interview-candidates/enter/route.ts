import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import {
  getInterviewCandidateForUserJobWithPrivilegedToken,
  getPrivilegedBackendToken,
  updateInterviewCandidateTimeWithPrivilegedToken,
} from "@/lib/backendPrivilegedApi";

type EnterInterviewRequest = {
  jobId?: unknown;
  questionCount?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?._id;

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let payload: EnterInterviewRequest;
  try {
    payload = (await request.json()) as EnterInterviewRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const jobId = Number(payload.jobId);
  const questionCount = Number(payload.questionCount);

  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ message: "jobId is required." }, { status: 400 });
  }
  if (!Number.isInteger(questionCount) || questionCount <= 0) {
    return NextResponse.json({ message: "questionCount must be a positive integer." }, { status: 400 });
  }

  try {
    const token = await getPrivilegedBackendToken();
    const candidate = await getInterviewCandidateForUserJobWithPrivilegedToken(token, userId, jobId);

    if (!candidate) {
      return NextResponse.json({ message: "Interview candidate not found." }, { status: 404 });
    }

    if (candidate.startTime != null && candidate.endTime != null) {
      return NextResponse.json(candidate);
    }

    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + questionCount * 30 * 60;
    const updated = await updateInterviewCandidateTimeWithPrivilegedToken(
      token,
      candidate.id,
      startTime,
      endTime
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[enter-interview] failed", {
      jobId,
      userId,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to enter interview." },
      { status: 500 }
    );
  }
}
