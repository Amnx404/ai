import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env.js";
import {
  getUserFacingAllowedDomains,
  normalizeAllowedDomains,
} from "~/lib/allowed-domains";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";

function withAppDomain(domains: string[]) {
  const set = new Set(normalizeAllowedDomains(domains));
  try {
    const appHost = new URL(env.NEXTAUTH_URL).host;
    if (appHost) set.add(appHost);
  } catch {
    // ignore
  }
  return [...set];
}

export const sitesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { orgId: true },
    });
    if (!user?.orgId) return [];
    return ctx.db.site.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.id, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });
      return site;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        primaryUrl: z.string().url(),
        allowedDomains: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true, email: true },
      });

      // Auto-create org on first site
      if (!user?.orgId) {
        const org = await ctx.db.organization.create({
          data: { name: user?.email?.split("@")[0] ?? "My Org" },
        });
        user = await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { orgId: org.id },
          select: { orgId: true, email: true },
        });
      }

      return ctx.db.site.create({
        data: {
          orgId: user!.orgId!,
          name: input.name,
          primaryUrl: input.primaryUrl,
          allowedDomains: withAppDomain(input.allowedDomains),
          modelId: "google/gemini-2.5-flash",
          temperature: 0.45,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        title: z.string().max(60).optional(),
        greeting: z.string().max(200).optional(),
        primaryUrl: z.string().url().optional(),
        // Can be a normal URL or a data URL (base64) stored in Postgres.
        logoUrl: z.string().max(500_000).optional().nullable(),
        allowedDomains: z.array(z.string()).optional(),
        allowedTopics: z.array(z.string()).optional(),
        modelId: z.string().optional(),
        temperature: z.number().min(0).max(1).optional(),
        livePineconePrefix: z.string().min(1).max(200).optional().nullable(),
        scrapeConfig: z.record(z.unknown()).optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const user = (await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        // Prisma types may be temporarily stale in dev until `prisma generate`.
        select: { orgId: true, plan: true } as any,
      })) as { orgId: string | null; plan?: "FREE" | "PRO" | "MAX" } | null;
      const site = await ctx.db.site.findFirst({
        where: { id, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const requestedAllowedDomains =
        typeof data.allowedDomains === "undefined"
          ? undefined
          : withAppDomain(data.allowedDomains);

      // Free tier: lock model choice.
      if (typeof data.modelId === "string") {
        const plan = (user?.plan as "FREE" | "PRO" | "MAX" | undefined) ?? "FREE";
        if (plan === "FREE" && data.modelId !== "google/gemini-2.5-flash") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Upgrade required to use this model.",
          });
        }
      }

      // Enforce active-widget limits when publishing a site.
      if (data.isActive === true && site.isActive === false) {
        const plan = (user?.plan as "FREE" | "PRO" | "MAX" | undefined) ?? "FREE";
        const limit = plan === "MAX" ? 10 : plan === "PRO" ? 3 : 1;
        const nextPrimaryUrl =
          typeof data.primaryUrl === "string" ? data.primaryUrl : site.primaryUrl;
        const nextAllowedDomains = requestedAllowedDomains ?? site.allowedDomains;
        if (!nextPrimaryUrl.trim()) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Set a website URL before publishing.",
          });
        }
        if (getUserFacingAllowedDomains(nextAllowedDomains, env.NEXTAUTH_URL).length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Add at least one allowed domain before publishing.",
          });
        }
        if (!site.livePineconeNs) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Add knowledge before publishing.",
          });
        }
        const activeCount = await ctx.db.site.count({
          where: { orgId: user?.orgId ?? "", isActive: true },
        });
        if (activeCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              plan === "FREE"
                ? "Free tier can only have 1 active widget."
                : plan === "PRO"
                  ? "Pro tier can only have 3 active widgets."
                  : "Max tier can only have 10 active widgets.",
          });
        }
      }

      const { scrapeConfig, allowedDomains: ignoredAllowedDomains, ...rest } = data;
      void ignoredAllowedDomains;
      const normalizedScrapeConfig =
        typeof scrapeConfig === "undefined"
          ? undefined
          : scrapeConfig === null
            ? undefined
            : normalizeScrapeConfigObject(scrapeConfig);
      return ctx.db.site.update({
        where: { id },
        data: {
          ...rest,
          ...(typeof requestedAllowedDomains === "undefined"
            ? {}
            : { allowedDomains: requestedAllowedDomains }),
          ...(typeof scrapeConfig === "undefined"
            ? {}
            : scrapeConfig === null
              ? { scrapeConfig: undefined }
              : { scrapeConfig: normalizedScrapeConfig as never }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.id, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.site.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
