import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/nav/sidebar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { UserNav } from "@/components/nav/user-nav";
import { NotificationBell } from "@/components/nav/notification-bell";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Protect all routes under (app) - redirects to /login if not authenticated
  const session = await requireAuth();

  // Redirect to onboarding if user hasn't completed it
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboarded: true },
    });

    if (user && !user.onboarded) {
      redirect("/onboarding");
    }
  }

  return (
    <div className="h-full">
      <Sidebar />
      <div className="md:pl-64 flex flex-col h-full">
        {/* Top header bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-6">
          <MobileNav />
          <div className="flex-1" />
          <NotificationBell />
          <ThemeSwitcher />
          <UserNav />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
