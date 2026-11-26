import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { linkGoogleAccount, type GoogleProfile } from "@/lib/googleAccount";

/** The Google button only appears when the app has been given Google keys. */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Needed outside Vercel (Docker, Fly, Railway…), where Auth.js otherwise refuses to run in
  // production ("UntrustedHost"). In production, set AUTH_URL to the real address (for example
  // https://sagedew.com) so links and sign-in redirects never depend on the request's Host header.
  trustHost: true,
  session: { strategy: "jwt" },
  // Errors (for example an unverified Google address) come back to the login
  // page as ?error=..., where a plain-language message is shown.
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleEnabled ? [Google] : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // No password on file means a Google-only account: this door stays shut.
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return profile?.email_verified === true;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        // Google's own id is not ours: find or create our account by email.
        const linked = await linkGoogleAccount((profile ?? {}) as GoogleProfile);
        if (!linked.ok) throw new Error("Google did not verify this email address.");
        token.id = linked.userId;
      } else if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
