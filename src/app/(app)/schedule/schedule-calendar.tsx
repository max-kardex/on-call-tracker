"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScheduleEntry {
  id: string;
  weekStart: string;
  weekEnd: string;
  isOverride: boolean;
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

interface Props {
  schedules: ScheduleEntry[];
  engineers: Engineer[];
  isAdmin: boolean;
}

export function ScheduleCalendar({ schedules, engineers, isAdmin }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string>("");

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
        // Refresh page to show updated data
        window.location.reload();
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
        window.location.reload();
      } else {
        toast.error("Failed to delete schedule entry");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No rotation schedule configured yet. Use the &quot;Generate Rotation&quot; button to create one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {schedules.map((schedule) => {
        const isEditing = editingId === schedule.id;
        const initials = schedule.user.name
          ?.split(" ")
          .map((n) => n[0])
          .join("") ?? "?";

        return (
          <Card key={schedule.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="flex items-center gap-4 py-4">
              {/* Date range */}
              <div className="w-48 shrink-0">
                <p className="text-sm font-medium">
                  {format(parseISO(schedule.weekStart), "MMM d")} -{" "}
                  {format(parseISO(schedule.weekEnd), "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Week of {format(parseISO(schedule.weekStart), "MMMM d")}
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
                {schedule.isOverride && (
                  <Badge variant="outline">Override</Badge>
                )}
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex items-center gap-2">
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
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
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
                        Reassign
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
