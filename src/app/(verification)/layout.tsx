import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default async function VerificationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  // If already verified, move them forward
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { verified: true, onboarded: true },
    });

    if (user?.verified) {
      redirect(user.onboarded ? "/dashboard" : "/onboarding");
    }
  }

  return <>{children}</>;
}
