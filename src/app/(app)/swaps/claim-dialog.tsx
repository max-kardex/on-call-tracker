"use client";

import { useMemo, useState } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Hand, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { SerializedSwapPost } from "./swap-post-card";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SerializedSwapPost;
  mySchedules: { id: string; weekStart: string; weekEnd: string }[];
  onClaimed: () => void;
}

export function ClaimDialog({ open, onOpenChange, post, mySchedules, onClaimed }: Props) {
  const isSwap = post.postType === "SWAP";
  const isSpecificDays = post.coverageType === "SPECIFIC_DAYS";

  const [offeredWeekStart, setOfferedWeekStart] = useState("");
  const [offeredDays, setOfferedDays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedSchedule = useMemo(
    () => mySchedules.find((s) => s.weekStart === offeredWeekStart),
    [mySchedules, offeredWeekStart]
  );

  const offeredWeekDays = useMemo(() => {
    if (!selectedSchedule) return [];
    return eachDayOfInterval({
      start: parseISO(selectedSchedule.weekStart),
      end: parseISO(selectedSchedule.weekEnd),
    });
  }, [selectedSchedule]);

  const requiredDayCount = post.specificDays.length;

  function toggleDay(iso: string) {
    setOfferedDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    );
  }

  async function handleSubmit() {
    if (isSwap) {
      if (!offeredWeekStart) {
        toast.error("Please select a week to offer in return");
        return;
      }
      if (isSpecificDays && offeredDays.length !== requiredDayCount) {
        toast.error(`Please offer exactly ${requiredDayCount} day(s) in return`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/swaps/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          ...(isSwap && { offeredWeekStart }),
          ...(isSwap && isSpecificDays && { offeredDays }),
        }),
      });

      if (res.ok) {
        toast.success("Claim successful!");
        onOpenChange(false);
        onClaimed();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to claim");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const posterDaysLabel = isSpecificDays
    ? post.specificDays.map((d) => format(parseISO(d), "EEE MMM d")).join(", ")
    : `the full week of ${format(parseISO(post.weekStart), "MMM d, yyyy")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSwap ? "Offer a Trade" : "Claim This Post"}</DialogTitle>
          <DialogDescription>
            {isSwap
              ? `You will cover ${posterDaysLabel} in exchange for the days you offer below.`
              : `You will take over ${posterDaysLabel}.`}
          </DialogDescription>
        </DialogHeader>

        {isSwap && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Week to Offer *</Label>
              {mySchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have any upcoming scheduled weeks to trade.
                </p>
              ) : (
                <Select value={offeredWeekStart} onValueChange={(v) => setOfferedWeekStart(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    {mySchedules.map((s) => (
                      <SelectItem key={s.id} value={s.weekStart}>
                        {format(parseISO(s.weekStart), "MMM d")} -{" "}
                        {format(parseISO(s.weekEnd), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {isSpecificDays && selectedSchedule && (
              <div className="space-y-2">
                <Label>
                  Days to Offer * ({offeredDays.length} / {requiredDayCount})
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {offeredWeekDays.map((d) => {
                    const iso = d.toISOString();
                    const checked = offeredDays.includes(iso);
                    return (
                      <label
                        key={iso}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleDay(iso)}
                        />
                        <span className="text-sm">{format(d, "EEEE, MMM d, yyyy")}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || (isSwap && mySchedules.length === 0)}>
            {submitting ? <Spinner /> : <Hand className="h-4 w-4 mr-2" />}
            {isSwap ? "Submit Trade" : "Claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
