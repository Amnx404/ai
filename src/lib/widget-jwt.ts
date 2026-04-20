import { SignJWT, jwtVerify } from "jose";
import { env } from "~/env.js";

const secret = new TextEncoder().encode(env.WIDGET_JWT_SECRET);

export interface WidgetTokenPayload {
  siteId: string;
  sessionId: string;
}

export async function signWidgetToken(payload: WidgetTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function verifyWidgetToken(token: string): Promise<WidgetTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as WidgetTokenPayload;
}
