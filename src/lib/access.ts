import type { MockAssignment } from "@/lib/mockData";

type RoleUser = {
  id: string;
  role: string;
} | null;

export const getRoleHomePath = (user: RoleUser): string => {
  if (!user) return "/";
  const role = user.role;
  if (role === "ADMIN" || role === "EXAMINER") return "/examiner";
  if (role === "QUESTIONER") return "/questioner";
  return `/candidates/${user.id}`;
};

export const canAccessQuestion = (
  user: RoleUser,
  questionId: number,
  assignments: MockAssignment[]
): boolean => {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "EXAMINER") return true;
  return assignments.some(
    (assignment) => assignment.userId === user.id && assignment.problemId === questionId
  );
};
