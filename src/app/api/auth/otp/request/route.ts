import { NextResponse } from "next/server";
import { z } from "zod";

import { getRealIp, rateLimit } from "~/lib/rate-limit";
import { createEmailOtp, normalizeOtpEmail } from "~/server/email-otp";

const requestSchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = normalizeOtpEmail(parsed.data.email);
  const ip = getRealIp(req);
  const ipAllowed = rateLimit(`auth-otp:ip:${ip}`, 10, 10 * 60 * 1000);
  const emailAllowed = rateLimit(`auth-otp:email:${email}`, 5, 10 * 60 * 1000);

  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  try {
    await createEmailOtp(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth] Could not send OTP email:", error);
    return NextResponse.json(
      {
        error:
          "We could not send the sign-in code. Check Resend API key, verified sender domain, and server logs.",
      },
      { status: 500 },
    );
  }
}
