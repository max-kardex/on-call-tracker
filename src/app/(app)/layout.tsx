import { Sidebar } from "@/components/nav/sidebar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { UserNav } from "@/components/nav/user-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full">
      <Sidebar />
      <div className="md:pl-64 flex flex-col h-full">
        {/* Top header bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-6">
          <MobileNav />
          <div className="flex-1" />
          <UserNav />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
