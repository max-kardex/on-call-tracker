import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // If already verified, redirect forward
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { verified: true, onboarded: true },
  });

  if (user?.verified) {
    redirect(user.onboarded ? "/dashboard" : "/onboarding");
  }

  return <VerifyForm />;
}
