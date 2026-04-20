import "server-only";

import { cache } from "react";

import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";

const createContext = cache(() => {
  return createTRPCContext({});
});

const createCaller = appRouter.createCaller;

const caller = createCaller(createContext as Parameters<typeof createCaller>[0]);

export { caller as api };
