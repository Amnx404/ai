import { PrismaAdapter } from "@auth/prisma-adapter";
import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";

import { env } from "~/env.js";
import { db } from "~/server/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      orgId: string | null;
      plan: "FREE" | "PRO" | "MAX";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string | null;
    plan?: "FREE" | "PRO" | "MAX";
  }
}

function getResendClient() {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const magicLinkFrom =
  env.RESEND_FROM ?? "Alt Ego Team <onboarding@altegolabs.com>";

export const authOptions: NextAuthOptions = {
  // Database sessions are opaque tokens; `next-auth/middleware` uses `getToken()` which
  // only decrypts JWT cookies — so middleware always saw "logged out". JWT strategy
  // keeps the Prisma adapter for users/verification tokens while exposing a JWT cookie.
  session: { strategy: "jwt" },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as { id: string; orgId?: string | null; plan?: "FREE" | "PRO" | "MAX" };
        token.id = u.id;
        token.sub = u.id;
        token.orgId = u.orgId ?? null;
        token.plan = u.plan ?? "FREE";
      }
      // Keep plan/orgId in sync with Postgres (so tier changes take effect immediately).
      if (typeof token.id === "string" || typeof token.sub === "string") {
        const userId = (typeof token.id === "string" ? token.id : token.sub) as string;
        try {
          const dbUser = await db.user.findUnique({
            where: { id: userId },
            // Prisma types can be stale across migrations in dev.
            select: { plan: true, orgId: true } as any,
          });
          token.plan = (dbUser?.plan as "FREE" | "PRO" | "MAX" | undefined) ?? "FREE";
          token.orgId = (dbUser?.orgId as string | null | undefined) ?? token.orgId ?? null;
        } catch {
          token.plan = (token.plan ?? "FREE") as "FREE" | "PRO" | "MAX";
        }
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: (typeof token.id === "string" ? token.id : token.sub) as string,
        orgId: token.orgId ?? null,
        plan: (token.plan ?? "FREE") as "FREE" | "PRO" | "MAX",
      },
    }),
  },
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  providers: [
    EmailProvider({
      from: magicLinkFrom,
      sendVerificationRequest: async ({ identifier, url }) => {
        const resend = getResendClient();
        const html = `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2>Sign in to Alter Ego</h2>
              <p>Click the button below to sign in. This link expires in 24 hours.</p>
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Sign in
              </a>
              <p style="color:#666;font-size:12px;margin-top:24px">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `;

        if (resend) {
          const { error } = await resend.emails.send({
            from: magicLinkFrom,
            to: identifier,
            subject: "Sign in to Alter Ego",
            html,
          });
          if (error) {
            console.error("[auth] Resend rejected magic link email:", error);
            const msg =
              typeof error === "object" &&
              error !== null &&
              "message" in error &&
              typeof (error as { message: unknown }).message === "string"
                ? (error as { message: string }).message
                : "Resend could not send the email (check API key and domain).";
            throw new Error(msg);
          }
          if (env.NODE_ENV === "development") {
            console.log(
              `\n[DEV] Magic link email sent via Resend to ${identifier}. (Link for debugging:)\n${url}\n`,
            );
          }
          return;
        }

        if (env.NODE_ENV === "development") {
          console.log(
            `\n[DEV] RESEND_API_KEY is not set — no email is sent locally. Paste this URL in the browser to sign in:\n${url}\n`,
          );
          return;
        }

        throw new Error(
          "RESEND_API_KEY is not set. Add it in Railway (Variables) to send magic links.",
        );
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
  },
};

export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
