import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { SwapActions } from "./swap-actions";

export const dynamic = "force-dynamic";

export default async function SwapsPage() {
  const session = await auth();

  const swaps = await prisma.swapRequest.findMany({
    include: {
      requester: { select: { id: true, name: true, email: true, image: true } },
      target: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  function getStatusVariant(status: string) {
    switch (status) {
      case "PENDING": return "default" as const;
      case "APPROVED": return "secondary" as const;
      case "REJECTED": return "destructive" as const;
      case "CANCELLED": return "outline" as const;
      default: return "outline" as const;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Swap Requests</h1>
          <p className="text-muted-foreground">
            Manage on-call rotation swaps between engineers
          </p>
        </div>
        <Link href="/swaps/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Request Swap
          </Button>
        </Link>
      </div>

      {swaps.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No swap requests yet.{" "}
              <Link href="/swaps/new" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {swaps.map((swap) => (
            <Card key={swap.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {swap.requester.name ?? swap.requester.email}
                    </p>
                    <span className="text-muted-foreground">wants to swap with</span>
                    <p className="font-medium">
                      {swap.target.name ?? swap.target.email}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {swap.swapType === "FULL_WEEK" ? "Full week" : "Specific days"} &middot;
                    Week of {format(swap.originalWeekStart, "MMM d, yyyy")}
                    {swap.reason && ` — "${swap.reason}"`}
                  </p>
                  {swap.responseNote && (
                    <p className="text-sm text-muted-foreground italic">
                      Response: {swap.responseNote}
                    </p>
                  )}
                </div>

                <Badge variant={getStatusVariant(swap.status)}>
                  {swap.status}
                </Badge>

                {swap.status === "PENDING" && (
                  <SwapActions
                    swapId={swap.id}
                    isRequester={swap.requesterId === session?.user?.id}
                    isTarget={swap.targetId === session?.user?.id}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
