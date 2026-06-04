import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it("submits credentials without redirecting through next-auth", async () => {
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });

    render(<SignInPage />);

    await userEvent.type(screen.getByPlaceholderText(/username/i), "admin");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        username: "admin",
        password: "secret",
        redirect: false,
      });
    });
  });

  it("shows a friendly message for invalid credentials", async () => {
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });

    render(<SignInPage />);

    await userEvent.type(screen.getByPlaceholderText(/username/i), "wrong");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "bad-password");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  it("shows a backend hint when sign in times out", async () => {
    vi.useFakeTimers();
    signInMock.mockReturnValue(new Promise(() => undefined));

    render(<SignInPage />);

    fireEvent.change(screen.getByPlaceholderText(/username/i), {
      target: { value: "kelly" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "secret" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /^sign in$/i }).closest("form")!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByText(/backend is running/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
