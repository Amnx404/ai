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

function orgNameFromEmail(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return "My Org";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 80) || "My Org";
}

type SessionDbUser = {
  id: string;
  orgId: string | null;
  plan: "FREE" | "PRO" | "MAX";
};

async function ensureUserOrganization(userId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { orgId: true, email: true },
    });
    if (!user) return null;
    if (user.orgId) return user.orgId;

    const org = await tx.organization.create({
      data: { name: orgNameFromEmail(user.email) },
      select: { id: true },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: { orgId: org.id },
      select: { orgId: true },
    });

    return updated.orgId;
  });
}

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
        try {
          let userId = (typeof token.id === "string" ? token.id : token.sub) as string;
          let dbUser = (await db.user.findUnique({
            where: { id: userId },
            // Prisma types can be stale across migrations in dev.
            select: { id: true, plan: true, orgId: true } as any,
          }) as unknown) as SessionDbUser | null;

          if (!dbUser && typeof token.email === "string" && token.email.includes("@")) {
            dbUser = (await db.user.upsert({
              where: { email: token.email },
              update: {},
              create: { email: token.email, emailVerified: new Date() },
              select: { id: true, plan: true, orgId: true } as any,
            }) as unknown) as SessionDbUser;
            userId = dbUser.id;
            token.id = userId;
            token.sub = userId;
          }

          const orgId = dbUser ? await ensureUserOrganization(userId) : null;
          token.plan = (dbUser?.plan as "FREE" | "PRO" | "MAX" | undefined) ?? "FREE";
          token.orgId = (dbUser?.orgId as string | null | undefined) ?? orgId ?? token.orgId ?? null;
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
        const html = `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2>Sign in to Alt Ego Labs</h2>
              <p>Click the button below to sign in. This link expires in 24 hours.</p>
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Sign in
              </a>
              <p style="color:#666;font-size:12px;margin-top:24px">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `;

        if (env.NODE_ENV === "development") {
          console.log(
            `\n[DEV] Magic link for ${identifier}. Paste this URL in the browser to sign in:\n${url}\n`,
          );
          return;
        }

        const resend = getResendClient();
        if (resend) {
          const { error } = await resend.emails.send({
            from: magicLinkFrom,
            to: identifier,
            subject: "Sign in to Alt Ego Labs",
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
    error: "/auth/signin",
  },
};

export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
