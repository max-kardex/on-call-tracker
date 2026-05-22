"use client";

import { ReactNode, useState } from "react";
import { Calendar, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  calendarView: ReactNode;
  listView: ReactNode;
}

export function ScheduleViewToggle({ calendarView, listView }: Props) {
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <Button
          variant={view === "calendar" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("calendar")}
          className="gap-1.5"
        >
          <Calendar className="h-4 w-4" />
          Calendar
        </Button>
        <Button
          variant={view === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("list")}
          className="gap-1.5"
        >
          <List className="h-4 w-4" />
          List
        </Button>
      </div>

      {view === "calendar" ? calendarView : listView}
    </div>
  );
}
