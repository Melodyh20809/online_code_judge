import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const { pushMock, useSessionMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

describe("Home", () => {
  beforeEach(() => {
    pushMock.mockClear();
    useSessionMock.mockReset();
  });

  it("sends unauthenticated users to sign in", async () => {
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<Home />);

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(pushMock).toHaveBeenCalledWith("/sign-in");
  });

  it.each([
    ["ADMIN", "/questioner"],
    ["QUESTIONER", "/questioner"],
    ["EXAMINER", "/examiner"],
    ["CANDIDATE", "/candidates/user-123"],
  ])("routes %s users to the correct portal", async (role, expectedPath) => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          _id: "user-123",
          role,
        },
      },
      status: "authenticated",
    });

    render(<Home />);

    await userEvent.click(screen.getByRole("button", { name: /go to my portal/i }));

    expect(pushMock).toHaveBeenCalledWith(expectedPath);
  });
});
