import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const analyticsRouter = createTRPCRouter({
  summary: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.siteId, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const [totalSessions, totalMessages, outOfScope] = await Promise.all([
        ctx.db.chatSession.count({ where: { siteId: input.siteId } }),
        ctx.db.message.count({
          where: { session: { siteId: input.siteId }, role: "user" },
        }),
        ctx.db.analyticsEvent.count({
          where: { siteId: input.siteId, type: "out_of_scope" },
        }),
      ]);

      return { totalSessions, totalMessages, outOfScope };
    }),

  recentSessions: protectedProcedure
    .input(z.object({ siteId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.siteId, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.chatSession.findMany({
        where: { siteId: input.siteId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }),

  /** Lightweight rows for the site monitor sidebar (newest first). */
  monitorSessions: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.siteId, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await ctx.db.chatSession.findMany({
        where: { siteId: input.siteId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          createdAt: true,
          _count: { select: { messages: true } },
          messages: {
            where: { role: "user" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { content: true },
          },
        },
      });

      return rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        messageCount: r._count.messages,
        firstUserQuestion: r.messages[0]?.content ?? null,
      }));
    }),

  /** Full transcript for one session (same org/site guard). */
  sessionThread: protectedProcedure
    .input(z.object({ siteId: z.string(), sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.siteId, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const chatSession = await ctx.db.chatSession.findFirst({
        where: { id: input.sessionId, siteId: input.siteId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!chatSession) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        id: chatSession.id,
        createdAt: chatSession.createdAt,
        messages: chatSession.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt,
        })),
      };
    }),

  dailyChats: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        days: z.number().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { orgId: true },
      });
      const site = await ctx.db.site.findFirst({
        where: { id: input.siteId, orgId: user?.orgId ?? "" },
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const events = await ctx.db.analyticsEvent.findMany({
        where: {
          siteId: input.siteId,
          type: "chat_start",
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      // Group by day
      const byDay: Record<string, number> = {};
      for (const e of events) {
        const day = e.createdAt.toISOString().split("T")[0]!;
        byDay[day] = (byDay[day] ?? 0) + 1;
      }

      return Object.entries(byDay).map(([date, count]) => ({ date, count }));
    }),
});
