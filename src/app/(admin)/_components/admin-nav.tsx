"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CreditCard,
  Globe2,
  LayoutDashboard,
  LogOut,
  Mail,
  UserRound,
} from "lucide-react";

import { BrandLogo } from "~/components/brand-logo";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/sites",
    label: "Widgets",
    icon: Globe2,
  },
  {
    href: "/subscription",
    label: "Plans",
    icon: CreditCard,
  },
];

export function AdminNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; plan?: string | null };
}) {
  const pathname = usePathname();
  const planLabel = user.plan ? user.plan.toUpperCase() : "FREE";

  return (
    <aside className="sticky top-0 z-40 flex w-full flex-col border-b border-gray-200 bg-white lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      {/* Brand */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 lg:px-5 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size="sm" className="block shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold uppercase text-gray-900">
              ALT EGO LABS
            </p>
            <p className="hidden truncate text-[11px] font-medium text-gray-500 sm:block">
              Admin console
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Link
            href="/contact"
            aria-label="Feedback"
            title="Feedback"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <Mail className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-2 lg:flex-1 lg:px-4 lg:py-4">
        <p className="hidden px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 lg:block">
          Workspace
        </p>
        <div className="grid grid-cols-3 gap-1.5 lg:block lg:space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 ${
                  isActive
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors lg:h-8 lg:w-8 ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-gray-100 text-gray-700 group-hover:bg-gray-200"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="hidden border-t border-gray-200/70 p-4 lg:block">
        <Link href="/subscription" className="mb-3 block" aria-label="View plan and limits">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm transition-colors hover:bg-gray-50">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <CreditCard className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Current plan
                </span>
                <span className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    Beta access
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {planLabel}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px] font-medium text-gray-500">
                  Manage usage and limits
                </span>
              </span>
            </div>
          </div>
        </Link>

        <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm ring-1 ring-gray-200">
            <UserRound className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-900">
              {user.name ?? user.email}
            </p>
            {user.name ? (
              <p className="truncate text-[11px] font-medium text-gray-500">
                {user.email}
              </p>
            ) : (
              <p className="truncate text-[11px] font-medium text-gray-500">
                Signed in
              </p>
            )}
          </div>
        </div>
        <Link
          href="/contact"
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <Mail className="h-4 w-4" aria-hidden />
          Feedback
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
