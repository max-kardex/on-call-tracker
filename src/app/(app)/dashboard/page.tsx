import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, ArrowLeftRight, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Current on-call engineer
  const currentSchedule = await prisma.schedule.findFirst({
    where: {
      weekStart: { lte: now },
      weekEnd: { gte: now },
    },
    include: { user: true },
  });

  // Upcoming schedules (next 4 weeks)
  const upcomingSchedules = await prisma.schedule.findMany({
    where: {
      weekStart: { gt: weekEnd },
    },
    include: { user: true },
    orderBy: { weekStart: "asc" },
    take: 4,
  });

  // Recent calls this week
  const recentCalls = await prisma.callLog.findMany({
    where: {
      startTime: { gte: weekStart, lte: weekEnd },
    },
    include: { user: true },
    orderBy: { startTime: "desc" },
    take: 5,
  });

  // Pending swap requests for current user
  const pendingSwaps = await prisma.swapRequest.findMany({
    where: {
      OR: [
        { requesterId: session?.user?.id },
        { targetId: session?.user?.id },
      ],
      status: "PENDING",
    },
    include: {
      requester: true,
      target: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Stats
  const totalCallsThisWeek = await prisma.callLog.count({
    where: { startTime: { gte: weekStart, lte: weekEnd } },
  });

  const pendingSwapCount = await prisma.swapRequest.count({
    where: { status: "PENDING" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name ?? "Engineer"}. Here&apos;s your on-call overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current On-Call</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentSchedule?.user.name ?? "Unassigned"}
            </div>
            <p className="text-xs text-muted-foreground">
              Week of {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCallsThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Total calls logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Swaps</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSwapCount}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next On-Call</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingSchedules[0]?.user.name ?? "TBD"}
            </div>
            <p className="text-xs text-muted-foreground">
              {upcomingSchedules[0]
                ? `Week of ${format(upcomingSchedules[0].weekStart, "MMM d")}`
                : "No upcoming schedule"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls & Upcoming Rotation */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Latest call logs this week</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls logged this week.</p>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{call.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {call.user.name} &middot; {format(call.startTime, "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        call.severity === "P1" ? "destructive" :
                        call.severity === "P2" ? "destructive" :
                        "secondary"
                      }
                    >
                      {call.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/calls"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              View all calls
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Rotation */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Rotation</CardTitle>
            <CardDescription>Next 4 weeks on-call schedule</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming schedule configured.{" "}
                <Link href="/schedule" className="text-primary hover:underline">
                  Generate rotation
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {schedule.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(schedule.weekStart, "MMM d")} - {format(schedule.weekEnd, "MMM d")}
                      </p>
                    </div>
                    {schedule.isOverride && (
                      <Badge variant="outline">Override</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/schedule"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              View full schedule
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Pending Swaps */}
      {pendingSwaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Swap Requests</CardTitle>
            <CardDescription>Requests that need your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSwaps.map((swap) => (
                <div key={swap.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {swap.requester.name} wants to swap with {swap.target.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Week of {format(swap.originalWeekStart, "MMM d, yyyy")}
                      {swap.reason && ` - ${swap.reason}`}
                    </p>
                  </div>
                  <Badge>Pending</Badge>
                </div>
              ))}
            </div>
            <Link
              href="/swaps"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Manage swaps
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
