"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, CalendarPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

interface Engineer {
  id: string;
  fullName: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Props {
  engineers: Engineer[];
}

export function GenerateRotationForm({ engineers }: Props) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [weeks, setWeeks] = useState("12");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !weeks) return;

    setLoading(true);
    try {
      const data = await api.schedule.generate({
        startDate,
        weeks: parseInt(weeks),
        engineerIds: engineers.map((e) => e.id),
      });
      toast.success(`Generated ${data.count} schedule entries`);
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-9 px-4 py-2 text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Generate Rotation
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate On-Call Rotation</DialogTitle>
          <DialogDescription>
            Automatically create a round-robin rotation schedule for {engineers.length} engineers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date (Monday)</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeks">Number of Weeks</Label>
            <Input
              id="weeks"
              type="number"
              min="1"
              max="52"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              required
            />
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              This will create a round-robin rotation with the following {engineers.length} engineers:
            </p>
            <ul className="mt-2 text-sm space-y-1">
              {engineers.slice(0, 5).map((eng) => (
                <li key={eng.id}>{eng.fullName ?? eng.name ?? eng.email}</li>
              ))}
              {engineers.length > 5 && (
                <li className="text-muted-foreground">
                  ...and {engineers.length - 5} more
                </li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : <CalendarPlus className="h-4 w-4" />}
              {loading ? "Generating..." : "Generate Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
