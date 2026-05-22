"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Check, X, UserRoundPen, Trash2, Hand, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

// Parse YYYY-MM-DD at noon local to avoid timezone day-shift
function toDisplayDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

interface ScheduleEntry {
  id: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  isOverride: boolean;
  isSelfAssigned: boolean;
  notes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Engineer {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface OpenWeek {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
}

interface Props {
  schedules: ScheduleEntry[];
  engineers: Engineer[];
  isAdmin: boolean;
  openWeeks: OpenWeek[];
  currentUserId: string;
}

interface ListItem {
  type: "schedule" | "open";
  weekStart: string;
  weekEnd: string;
  schedule?: ScheduleEntry;
}

export function ScheduleCalendar({ schedules, engineers, isAdmin, openWeeks, currentUserId }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string>("");
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const router = useRouter();

  const todayStr = new Date().toISOString().split("T")[0];

  // Build a merged list: assigned weeks + open weeks, sorted by date
  const items: ListItem[] = [
    ...schedules.map((s) => ({
      type: "schedule" as const,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      schedule: s,
    })),
    ...openWeeks.map((ow) => ({
      type: "open" as const,
      weekStart: ow.weekStart,
      weekEnd: ow.weekEnd,
    })),
  ].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  async function handleReassign(scheduleId: string) {
    if (!editUserId) return;

    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scheduleId, userId: editUserId }),
      });

      if (res.ok) {
        toast.success("Schedule updated successfully");
        setEditingId(null);
        setEditUserId("");
        router.refresh();
      } else {
        toast.error("Failed to update schedule");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm("Are you sure you want to delete this schedule entry?")) return;

    try {
      const res = await fetch(`/api/schedule?id=${scheduleId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Schedule entry deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete schedule entry");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  async function handleSelfAssign(weekStart: string) {
    setLoadingWeek(weekStart);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "self-assign", weekStart }),
      });

      if (res.ok) {
        toast.success("You've taken this on-call week!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to self-assign");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoadingWeek(null);
    }
  }

  async function handleWithdraw(scheduleId: string) {
    setWithdrawingId(scheduleId);
    try {
      const res = await fetch(`/api/schedule?id=${scheduleId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Withdrawn from on-call week");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to withdraw");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setWithdrawingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No rotation schedule configured yet. Use the &quot;Generate Rotation&quot; button to create one, or self-assign a week below.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        if (item.type === "open") {
          const isFuture = item.weekStart >= todayStr;
          const displayStart = toDisplayDate(item.weekStart);
          const displayEnd = toDisplayDate(item.weekEnd);

          return (
            <Card
              key={`open-${item.weekStart}`}
              className="border-dashed hover:shadow-sm transition-shadow"
            >
              <CardContent className="flex items-center gap-4 py-4">
                {/* Date range */}
                <div className="w-48 shrink-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {format(displayStart, "MMM d")} -{" "}
                    {format(displayEnd, "MMM d, yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Week of {format(displayStart, "MMMM d")}
                  </p>
                </div>

                {/* Available indicator */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <CalendarPlus className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground italic">Available</p>
                </div>

                {/* Self-assign button */}
                {isFuture && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelfAssign(item.weekStart)}
                    disabled={loadingWeek === item.weekStart}
                  >
                    {loadingWeek === item.weekStart ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Hand className="h-4 w-4" />
                    )}
                    Take This Week
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        }

        // Assigned week
        const schedule = item.schedule!;
        const isEditing = editingId === schedule.id;
        const initials = schedule.user.name
          ?.split(" ")
          .map((n) => n[0])
          .join("") ?? "?";
        const isOwnSelfAssigned =
          schedule.isSelfAssigned && schedule.user.id === currentUserId;
        const displayStart = toDisplayDate(schedule.weekStart);
        const displayEnd = toDisplayDate(schedule.weekEnd);

        return (
          <Card key={schedule.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="flex items-center gap-4 py-4">
              {/* Date range */}
              <div className="w-48 shrink-0">
                <p className="text-sm font-medium">
                  {format(displayStart, "MMM d")} -{" "}
                  {format(displayEnd, "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Week of {format(displayStart, "MMMM d")}
                </p>
              </div>

              {/* Engineer */}
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={schedule.user.image ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{schedule.user.name ?? schedule.user.email}</p>
                  {schedule.notes && (
                    <p className="text-xs text-muted-foreground">{schedule.notes}</p>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                {schedule.isSelfAssigned && (
                  <Badge variant="secondary" className="gap-1">
                    <Hand className="h-3 w-3" />
                    Volunteered
                  </Badge>
                )}
                {schedule.isOverride && (
                  <Badge variant="outline">Override</Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Non-admin: withdraw own self-assigned */}
                {isOwnSelfAssigned && !isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleWithdraw(schedule.id)}
                    disabled={withdrawingId === schedule.id}
                  >
                    {withdrawingId === schedule.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Withdraw
                  </Button>
                )}

                {/* Admin actions */}
                {isAdmin && (
                  <>
                    {isEditing ? (
                      <>
                        <Select value={editUserId} onValueChange={(v) => setEditUserId(v ?? "")}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select engineer" />
                          </SelectTrigger>
                          <SelectContent>
                            {engineers.map((eng) => (
                              <SelectItem key={eng.id} value={eng.id}>
                                {eng.name ?? eng.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleReassign(schedule.id)}>
                          <Check className="h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(schedule.id);
                            setEditUserId(schedule.user.id);
                          }}
                        >
                          <UserRoundPen className="h-4 w-4" />
                          Reassign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
