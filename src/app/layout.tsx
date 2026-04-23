import "~/styles/globals.css";

import { type Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { TRPCReactProvider } from "~/trpc/react";
import { SessionProvider } from "~/components/session-provider";

export const metadata: Metadata = {
  title: "ALT EGO",
  description: "Give your website an Ego Layer",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <SessionProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
