import { createHash, randomInt } from "node:crypto";
import { Resend } from "resend";

import { env } from "~/env.js";
import { rateLimit } from "~/lib/rate-limit";
import { db } from "~/server/db";

const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;

const otpFrom = env.RESEND_FROM ?? "Alt Ego Team <onboarding@altegolabs.com>";

export type OtpUser = {
  id: string;
  email: string;
  name: string | null;
  orgId: string | null;
  plan: "FREE" | "PRO" | "MAX";
};

function getResendClient() {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function normalizeOtpEmail(email: string) {
  return email.trim().toLowerCase();
}

function otpHash(email: string, code: string) {
  return createHash("sha256")
    .update(`${email}:${code}:${env.NEXTAUTH_SECRET}`)
    .digest("hex");
}

function generateOtpCode() {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function orgNameFromEmail(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return "My Org";
  return (
    localPart
      .replace(/[._-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(" ")
      .slice(0, 80) || "My Org"
  );
}

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

async function sendOtpEmail(email: string, code: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Sign in to Alt Ego Labs</h2>
      <p>Enter this verification code to sign in. It expires in ${OTP_TTL_MINUTES} minutes.</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;margin:24px 0;color:#111827">
        ${code}
      </div>
      <p style="color:#666;font-size:12px;margin-top:24px">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  if (env.NODE_ENV === "development") {
    console.log(`\n[DEV] OTP code for ${email}: ${code}\n`);
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it in Railway (Variables) to send OTP codes.",
    );
  }

  const { error } = await resend.emails.send({
    from: otpFrom,
    to: email,
    subject: "Your Alt Ego Labs sign-in code",
    html,
  });

  if (error) {
    console.error("[auth] Resend rejected OTP email:", error);
    const msg =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Resend could not send the email (check API key and domain).";
    throw new Error(msg);
  }
}

export async function createEmailOtp(email: string) {
  const normalizedEmail = normalizeOtpEmail(email);
  const code = generateOtpCode();
  const token = otpHash(normalizedEmail, code);
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  await db.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  });

  try {
    await sendOtpEmail(normalizedEmail, code);
  } catch (error) {
    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail, token },
    });
    throw error;
  }
}

export async function authorizeEmailOtp(
  email: string,
  code: string,
): Promise<OtpUser | null> {
  const normalizedEmail = normalizeOtpEmail(email);
  const normalizedCode = code.replace(/\D/g, "");
  if (normalizedCode.length !== OTP_LENGTH) return null;
  if (!rateLimit(`auth-otp-verify:${normalizedEmail}`, 10, 10 * 60 * 1000)) {
    return null;
  }

  const token = otpHash(normalizedEmail, normalizedCode);
  const verificationToken = await db.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: normalizedEmail,
        token,
      },
    },
  });

  if (!verificationToken) return null;

  await db.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: normalizedEmail,
        token,
      },
    },
  });

  if (verificationToken.expires < new Date()) {
    return null;
  }

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: {
      emailVerified: new Date(),
    },
    create: {
      email: normalizedEmail,
      emailVerified: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      orgId: true,
      plan: true,
    },
  });

  const orgId = await ensureUserOrganization(user.id);

  return {
    id: user.id,
    email: user.email ?? normalizedEmail,
    name: user.name,
    orgId: user.orgId ?? orgId,
    plan: user.plan,
  };
}
