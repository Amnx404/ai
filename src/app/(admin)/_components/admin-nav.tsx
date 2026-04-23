"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    href: "/sites",
    label: "Sites",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v15.86zm2 0V4.07c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93z" />
      </svg>
    ),
  },
  {
    href: "/subscription",
    label: "Subscription",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 1.5 3 6v6c0 5.25 3.84 10.05 9 10.5 5.16-.45 9-5.25 9-10.5V6l-9-4.5zm0 2.24L19 7v5c0 4.17-2.92 8.1-7 8.5-4.08-.4-7-4.33-7-8.5V7l7-3.26z" />
      </svg>
    ),
  },
];

export function AdminNav({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
        <svg
          viewBox="0 0 48 32"
          className="block"
          style={{ width: 26, height: 18 }}
          aria-hidden="true"
        >
            <rect
              x="0"
              y="0"
              width="15"
              height="32"
              fill="none"
              stroke="#0057FF"
              strokeWidth="2"
            />
            <rect x="22" y="0" width="15" height="32" fill="#0057FF" />
        </svg>
        <div className="min-w-0">
          <p
            className="truncate uppercase text-gray-900"
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.28em",
            }}
          >
            ALTER EGO LABS
          </p>
          <p className="truncate text-[11px] font-medium text-gray-500">Admin console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Workspace
        </p>
        <div className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "bg-gray-100 text-gray-700 group-hover:bg-gray-200"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-gray-200/70 p-4">
        <Link
          href="/subscription"
          className="mb-3 block"
          aria-label="Subscribe"
        >
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.18),transparent_60%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Subscribe</p>
                <p className="truncate text-[11px] font-medium text-gray-500">
                  Unlock better models + limits
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-[11px] font-semibold text-white">
                Coming soon
              </span>
            </div>
          </div>
        </Link>

        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm ring-1 ring-gray-200">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
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
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M21 6.5V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6.5l9 6 9-6zM19 4H5c-1.1 0-2 .9-2 2l9 6 9-6c0-1.1-.9-2-2-2z" />
          </svg>
          Feedback
        </Link>
        <button
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
