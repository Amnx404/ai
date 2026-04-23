import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Forward-compatible validation for scrape config presets.
    // (We will later enforce per-site limits based on these.)
    if (
      req.nextUrl.pathname.startsWith("/api/v1/knowledge-base/") &&
      req.nextUrl.pathname !== "/api/v1/knowledge-base/run/callback"
    ) {
      const plan = ((req as unknown as { nextauth?: { token?: { plan?: string } } }).nextauth
        ?.token?.plan ?? "FREE") as string;
      const coverage = req.headers.get("x-kb-coverage");
      const speed = req.headers.get("x-kb-speed");
      const okCoverage =
        !coverage ||
        coverage === "basic" ||
        (plan === "PRO" && coverage === "wide") ||
        (plan === "MAX" && (coverage === "wide" || coverage === "thorough"));
      const okSpeed =
        !speed ||
        speed === "quick" ||
        (plan === "PRO" && speed === "speedy") ||
        (plan === "MAX" && (speed === "speedy" || speed === "fastest"));
      if (!okCoverage || !okSpeed) {
        return NextResponse.json(
          { error: "Knowledge base config not available yet" },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        // Scraper service calls this endpoint without user auth.
        if (req.nextUrl.pathname === "/api/v1/knowledge-base/run/callback") return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/sites/:path*", "/api/v1/knowledge-base/:path*"],
};
