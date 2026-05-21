import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Clock, User, Calendar } from "lucide-react";
import { CallActions } from "./call-actions";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const call = await prisma.callLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      schedule: { select: { id: true, weekStart: true, weekEnd: true } },
    },
  });

  if (!call) {
    notFound();
  }

  function getSeverityLabel(severity: string) {
    switch (severity) {
      case "P1": return "Critical";
      case "P2": return "High";
      case "P3": return "Medium";
      case "P4": return "Low";
      default: return severity;
    }
  }

  function getSeverityVariant(severity: string) {
    switch (severity) {
      case "P1": return "destructive" as const;
      case "P2": return "destructive" as const;
      case "P3": return "secondary" as const;
      default: return "outline" as const;
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calls">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">{call.title}</h1>
          <p className="text-muted-foreground">
            Logged {format(call.createdAt, "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <CallActions callId={call.id} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Severity
            </div>
            <Badge variant={getSeverityVariant(call.severity)} className="text-sm">
              {call.severity} - {getSeverityLabel(call.severity)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <User className="h-4 w-4" />
              Handled By
            </div>
            <p className="font-medium">{call.user.name ?? call.user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Duration
            </div>
            <p className="font-medium">
              {call.duration ? `${call.duration} minutes` : "Not recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium">{format(call.startTime, "MMM d, yyyy h:mm a")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Time</p>
              <p className="font-medium">
                {call.endTime ? format(call.endTime, "MMM d, yyyy h:mm a") : "Ongoing / Not recorded"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">On-Call Week</p>
            <p className="font-medium">
              {format(call.schedule.weekStart, "MMM d")} - {format(call.schedule.weekEnd, "MMM d, yyyy")}
            </p>
          </div>
        </CardContent>
      </Card>

      {call.description && (
        <Card>
          <CardHeader>
            <CardTitle>Notes / Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{call.description}</p>
          </CardContent>
        </Card>
      )}

      {call.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{call.resolution}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
