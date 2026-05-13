import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const submitted = String(credentials?.password ?? "");
        const expected =
          process.env.STRATEGY_TRACKER_PASSWORD ??
          (process.env.NODE_ENV === "production" ? "" : "strategy");

        if (expected && submitted === expected) {
          return {
            id: "owner",
            name: "Strategy Researcher",
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico"
      ) {
        return true;
      }

      return Boolean(session?.user);
    },
  },
});
