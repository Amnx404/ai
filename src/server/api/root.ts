import { createTRPCRouter } from "~/server/api/trpc";
import { analyticsRouter } from "~/server/api/routers/analytics";
import { sitesRouter } from "~/server/api/routers/sites";

export const appRouter = createTRPCRouter({
  sites: sitesRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
