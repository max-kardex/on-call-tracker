"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { X, Send, Gift, ArrowLeftRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api-client";

interface Props {
  mySchedules: { id: string; weekStart: string; weekEnd: string }[];
}

export function NewSwapPostForm({ mySchedules }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState<"GIVE_AWAY" | "SWAP">("GIVE_AWAY");
  const [coverageType, setCoverageType] = useState<"FULL_WEEK" | "SPECIFIC_DAYS">(
    "FULL_WEEK"
  );
  const [weekStart, setWeekStart] = useState("");
  const [specificDays, setSpecificDays] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const selectedSchedule = useMemo(
    () => mySchedules.find((s) => s.weekStart === weekStart),
    [mySchedules, weekStart]
  );

  const weekDays = useMemo(() => {
    if (!selectedSchedule) return [];
    return eachDayOfInterval({
      start: parseISO(selectedSchedule.weekStart),
      end: parseISO(selectedSchedule.weekEnd),
    });
  }, [selectedSchedule]);

  function toggleDay(iso: string) {
    setSpecificDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!weekStart) {
      toast.error("Please select a week");
      return;
    }
    if (coverageType === "SPECIFIC_DAYS" && specificDays.length === 0) {
      toast.error("Please select at least one day");
      return;
    }

    setLoading(true);
    try {
      await api.swaps.create({
        postType,
        coverageType,
        weekStart,
        specificDays: coverageType === "SPECIFIC_DAYS" ? specificDays : [],
        reason: reason || undefined,
      });
      toast.success("Swap post created!");
      router.push("/swaps");
      router.refresh();
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
          <CardTitle>Post Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mySchedules.length === 0 ? (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have any upcoming on-call weeks assigned. You can
                only post weeks that are assigned to you.
              </p>
            </div>
          ) : (
            <>
              {/* Post type toggle */}
              <div className="space-y-2">
                <Label>Post Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostType("GIVE_AWAY")}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-4 py-3 text-left transition-colors",
                      postType === "GIVE_AWAY"
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Gift className="h-4 w-4" />
                    <div>
                      <div className="font-medium text-sm">Give Away</div>
                      <div className="text-xs text-muted-foreground">
                        Someone takes your shift, no return needed
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType("SWAP")}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-4 py-3 text-left transition-colors",
                      postType === "SWAP"
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    <div>
                      <div className="font-medium text-sm">Swap</div>
                      <div className="text-xs text-muted-foreground">
                        Trade for one of their weeks/days
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Week to post */}
              <div className="space-y-2">
                <Label>Your On-Call Week *</Label>
                <Select
                  value={weekStart}
                  onValueChange={(v) => {
                    setWeekStart(v ?? "");
                    setSpecificDays([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select week" />
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
              </div>

              {/* Coverage type */}
              <div className="space-y-2">
                <Label>Coverage</Label>
                <Select
                  value={coverageType}
                  onValueChange={(v) => {
                    setCoverageType((v as "FULL_WEEK" | "SPECIFIC_DAYS") ?? "FULL_WEEK");
                    setSpecificDays([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_WEEK">Full Week</SelectItem>
                    <SelectItem value="SPECIFIC_DAYS">Specific Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Day picker for SPECIFIC_DAYS */}
              {coverageType === "SPECIFIC_DAYS" && selectedSchedule && (
                <div className="space-y-2">
                  <Label>Select Days *</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {weekDays.map((d) => {
                      const iso = d.toISOString();
                      const checked = specificDays.includes(iso);
                      return (
                        <label
                          key={iso}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleDay(iso)}
                          />
                          <span className="text-sm">
                            {format(d, "EEEE, MMM d, yyyy")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="Why are you posting this?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading || mySchedules.length === 0}>
            {loading ? <Spinner /> : <Send className="h-4 w-4 mr-2" />}
            {loading ? "Posting..." : "Post"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
