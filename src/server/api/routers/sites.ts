import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
          allowedDomains: input.allowedDomains,
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
        temperature: z.number().min(0).max(2).optional(),
        pineconeIndex: z.string().optional().nullable(),
        pineconeNs: z.string().optional().nullable(),
        liveVersion: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.site.update({ where: { id }, data });
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
