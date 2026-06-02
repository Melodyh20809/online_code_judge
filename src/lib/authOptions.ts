import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { NEXT_AUTH_SECRET } from "./authSecret";
import { hashPasswordToSHA256 } from "./passwordHash";

type CredentialsInput = {
  username: string;
  password: string;
};

type BackendJwtPayload = {
  sub?: string;
  username?: string;
  role?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";
const LOGIN_TIMEOUT_MS = 8_000;

const decodeBackendJwt = (token: string): BackendJwtPayload => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return {};

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );

    return JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf-8")) as BackendJwtPayload;
  } catch {
    return {};
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const safeCredentials = credentials as CredentialsInput | undefined;
        if (!safeCredentials?.username || !safeCredentials?.password) {
          throw new Error("Missing username or password.");
        }

        const hashedPassword = hashPasswordToSHA256(safeCredentials.password);

        let response: Response;
        try {
          response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
            body: JSON.stringify({
              username: safeCredentials.username,
              passwordSha256: hashedPassword,
            }),
          });
        } catch (error) {
          const isTimeout =
            error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
          throw new Error(
            isTimeout
              ? "Backend login timed out. Please try again later."
              : "Cannot connect to backend login service."
          );
        }

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Invalid username or password.");
          }

          let message = `Backend login failed with HTTP ${response.status}.`;
          try {
            const body = (await response.json()) as { message?: string | string[] };
            if (Array.isArray(body.message)) message = body.message.join(", ");
            if (typeof body.message === "string") message = body.message;
          } catch {
            // Keep the HTTP status message when the backend does not return JSON.
          }
          throw new Error(message);
        }

        const data = await response.json() as Record<string, unknown>;
        const role = String(data.user_role ?? "USER");
        const token = String(data.token ?? "");
        const expiresIn = String(data.expires_in ?? "");

        if (!token) {
          throw new Error("Login response missing token.");
        }

        const jwtPayload = decodeBackendJwt(token);
        const backendUserId = jwtPayload.sub ?? safeCredentials.username;
        const backendUsername = jwtPayload.username ?? safeCredentials.username;
        const backendRole = jwtPayload.role ?? role;

        return {
          id: backendUserId,
          _id: backendUserId,
          username: backendUsername,
          email: "",
          role: backendRole,
          empId: backendUserId,
          accessToken: token,
          expiresIn,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token._id = user._id;
        token.username = user.username;
        token.email = user.email;
        token.role = user.role;
        token.empId = user.empId;
        token.accessToken = user.accessToken;
        token.expiresIn = user.expiresIn;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user._id = token._id;
        session.user.username = token.username;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.empId = token.empId;
        session.user.accessToken = token.accessToken;
        session.user.expiresIn = token.expiresIn;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 1 * 24 * 60 * 60,
  },
  secret: NEXT_AUTH_SECRET,
};
