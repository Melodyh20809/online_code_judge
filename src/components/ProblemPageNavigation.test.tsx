import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProblemPageNavigation from "./ProblemPageNavigation";

describe("ProblemPageNavigation", () => {
  it.each([
    ["Description", "description"],
    ["Solutions", "solutions"],
    ["Submissions", "submissions"],
    ["Test Result", "testResult"],
  ])("selects the %s tab", async (label, expectedTab) => {
    const setCurrentTab = vi.fn();

    render(<ProblemPageNavigation currentTab="description" setCurrentTab={setCurrentTab} />);

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(setCurrentTab).toHaveBeenCalledWith(expectedTab);
  });
});
