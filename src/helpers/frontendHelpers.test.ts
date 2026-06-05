import { afterEach, describe, expect, it, vi } from "vitest";
import { levelWiseProblemSeperate } from "./levelWiseProblemSeparate";
import { timeAgoFunction } from "./timeAgoFunction";
import type { IProblem } from "@/models/Problem";

describe("timeAgoFunction", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats recent times into the nearest useful unit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));

    expect(timeAgoFunction(new Date("2026-06-04T11:59:30Z"))).toBe("30 seconds ago");
    expect(timeAgoFunction(new Date("2026-06-04T11:45:00Z"))).toBe("15 minutes ago");
    expect(timeAgoFunction(new Date("2026-06-04T09:00:00Z"))).toBe("3 hours ago");
    expect(timeAgoFunction(new Date("2026-06-02T12:00:00Z"))).toBe("2 days ago");
  });

  it("handles invalid and future dates predictably", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));

    expect(timeAgoFunction(new Date("not-a-date"))).toBe("Invalid Date");
    expect(timeAgoFunction(new Date("2026-06-04T12:00:05Z"))).toBe("just now");
  });
});

describe("levelWiseProblemSeperate", () => {
  it("counts unique problem titles by difficulty", () => {
    const problems = [
      { title: "Two Sum", level: "Easy" },
      { title: "Two Sum", level: "Easy" },
      { title: "Course Schedule", level: "Medium" },
      { title: "Median of Two Sorted Arrays", level: "Hard" },
    ] as IProblem[];

    expect(levelWiseProblemSeperate(problems)).toEqual({ e: 1, m: 1, h: 1 });
  });
});
