"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function AdminSessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

