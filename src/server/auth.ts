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
    } & DefaultSession["user"];
  }
}

function getResendClient() {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const magicLinkFrom =
  env.RESEND_FROM ?? "RoboRacer <noreply@roboracer.ai>";

export const authOptions: NextAuthOptions = {
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        orgId: (user as { orgId?: string | null }).orgId ?? null,
      },
    }),
  },
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  providers: [
    EmailProvider({
      from: magicLinkFrom,
      sendVerificationRequest: async ({ identifier, url }) => {
        if (env.NODE_ENV === "development") {
          console.log(`\n[DEV] Magic link for ${identifier}:\n${url}\n`);
          return;
        }
        const resend = getResendClient();
        if (!resend) {
          throw new Error(
            "RESEND_API_KEY is not set. Add it in Railway (Variables) to send magic links.",
          );
        }
        const { error } = await resend.emails.send({
          from: magicLinkFrom,
          to: identifier,
          subject: "Sign in to RoboRacer",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2>Sign in to RoboRacer</h2>
              <p>Click the button below to sign in. This link expires in 24 hours.</p>
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Sign in
              </a>
              <p style="color:#666;font-size:12px;margin-top:24px">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
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
