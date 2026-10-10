"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { api, type User } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/check", label: "Check something" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await api.logout();
    router.replace("/login");
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground lg:inline">{user.email}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
      <nav aria-label="Main (mobile)" className="flex gap-1 border-t border-border px-4 py-2 sm:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium",
              pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
