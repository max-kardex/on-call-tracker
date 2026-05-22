import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { SwapPostCard } from "./swap-post-card";

export const dynamic = "force-dynamic";

export default async function SwapsPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [posts, mySchedules] = await Promise.all([
    prisma.swapPost.findMany({
      include: {
        poster: { select: { id: true, name: true, fullName: true, email: true, image: true } },
        claimer: { select: { id: true, name: true, fullName: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    currentUserId
      ? prisma.schedule.findMany({
          where: { userId: currentUserId, weekStart: { gte: weekStart } },
          orderBy: { weekStart: "asc" },
          take: 24,
          select: { id: true, weekStart: true, weekEnd: true },
        })
      : Promise.resolve([]),
  ]);

  const mySchedulesSerialized = mySchedules.map((s) => ({
    id: s.id,
    weekStart: s.weekStart.toISOString(),
    weekEnd: s.weekEnd.toISOString(),
  }));

  const openPosts = posts.filter((p) => p.status === "OPEN");
  const historyPosts = posts.filter((p) => p.status !== "OPEN");

  function serializePost(p: typeof posts[number]) {
    return {
      id: p.id,
      status: p.status,
      postType: p.postType,
      coverageType: p.coverageType,
      weekStart: p.weekStart.toISOString(),
      specificDays: p.specificDays.map((d) => d.toISOString()),
      offeredWeekStart: p.offeredWeekStart?.toISOString() ?? null,
      offeredDays: p.offeredDays.map((d) => d.toISOString()),
      reason: p.reason,
      claimedAt: p.claimedAt?.toISOString() ?? null,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      poster: p.poster,
      claimer: p.claimer,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Swap Bulletin Board</h1>
          <p className="text-muted-foreground">
            Post weeks or days you need covered, or claim posts from others.
          </p>
        </div>
        <Link href="/swaps/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">Open ({openPosts.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historyPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
          {openPosts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No open posts.{" "}
                  <Link href="/swaps/new" className="text-primary hover:underline">
                    Create one
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {openPosts.map((p) => (
                <SwapPostCard
                  key={p.id}
                  post={serializePost(p)}
                  currentUserId={currentUserId}
                  mySchedules={mySchedulesSerialized}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyPosts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No past posts yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {historyPosts.map((p) => (
                <SwapPostCard
                  key={p.id}
                  post={serializePost(p)}
                  currentUserId={currentUserId}
                  mySchedules={mySchedulesSerialized}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
