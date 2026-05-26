"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { X, PhoneCall } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

interface Props {
  currentScheduleId: string | null;
  schedules: { id: string; weekStart: string; userName: string }[];
}

export function NewCallForm({ currentScheduleId, schedules }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    scheduleId: currentScheduleId ?? "",
    severity: "",
    title: "",
    description: "",
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endTime: "",
    resolution: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.scheduleId || !form.severity || !form.title || !form.startTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      await api.calls.create({
        scheduleId: form.scheduleId,
        severity: form.severity,
        title: form.title,
        description: form.description || undefined,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
        resolution: form.resolution || undefined,
      });
      toast.success("Call logged successfully");
      router.push("/calls");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Call Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="schedule">On-Call Week *</Label>
            <Select
              value={form.scheduleId}
              onValueChange={(v) => updateField("scheduleId", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the on-call week" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Week of {format(parseISO(s.weekStart), "MMM d, yyyy")} ({s.userName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief summary of the call"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">Severity *</Label>
            <Select
              value={form.severity}
              onValueChange={(v) => updateField("severity", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select severity level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P1">P1 - Critical (service down, data loss)</SelectItem>
                <SelectItem value="P2">P2 - High (major degradation)</SelectItem>
                <SelectItem value="P3">P3 - Medium (minor impact)</SelectItem>
                <SelectItem value="P4">P4 - Low (informational)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateField("startTime", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => updateField("endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes / Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed notes about the call, what happened, steps taken..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
            />
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Textarea
              id="resolution"
              placeholder="How was the issue resolved?"
              value={form.resolution}
              onChange={(e) => updateField("resolution", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner /> : <PhoneCall className="h-4 w-4" />}
            {loading ? "Saving..." : "Log Call"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
