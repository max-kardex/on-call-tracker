import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { CallFilters } from "./call-filters";

export const dynamic = "force-dynamic";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; userId?: string; page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = 20;

  const where: Record<string, unknown> = {};
  if (params.severity) where.severity = params.severity;
  if (params.userId) where.userId = params.userId;

  const [calls, total, engineers] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, fullName: true, email: true, image: true } },
        schedule: { select: { weekStart: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.callLog.count({ where }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, fullName: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  function getSeverityVariant(severity: string) {
    switch (severity) {
      case "P1": return "destructive" as const;
      case "P2": return "destructive" as const;
      case "P3": return "secondary" as const;
      default: return "outline" as const;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Call Log</h1>
          <p className="text-muted-foreground">
            {total} total calls logged
          </p>
        </div>
        <Link href="/calls/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Log Call
          </Button>
        </Link>
      </div>

      <CallFilters engineers={engineers} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No calls logged yet.{" "}
                    <Link href="/calls/new" className="text-primary hover:underline">
                      Log your first call
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Link
                        href={`/calls/${call.id}`}
                        className="font-medium hover:underline"
                      >
                        {call.title}
                      </Link>
                      {call.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {call.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityVariant(call.severity)}>
                        {call.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{call.user.fullName ?? call.user.name ?? call.user.email}</TableCell>
                    <TableCell>
                      {format(call.startTime, "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      {call.duration ? `${call.duration} min` : "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/calls/${call.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/calls?page=${page - 1}${params.severity ? `&severity=${params.severity}` : ""}${params.userId ? `&userId=${params.userId}` : ""}`}>
              <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" />Previous</Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/calls?page=${page + 1}${params.severity ? `&severity=${params.severity}` : ""}${params.userId ? `&userId=${params.userId}` : ""}`}>
              <Button variant="outline" size="sm">Next<ChevronRight className="h-4 w-4" /></Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
