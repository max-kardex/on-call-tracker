"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
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

interface Props {
  mySchedules: { id: string; weekStart: string; weekEnd: string }[];
  engineers: { id: string; name: string | null; email: string | null }[];
}

export function NewSwapForm({ mySchedules, engineers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    weekStart: "",
    targetId: "",
    swapType: "FULL_WEEK",
    reason: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.weekStart || !form.targetId) {
      toast.error("Please select a week and target engineer");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: form.targetId,
          swapType: form.swapType,
          originalWeekStart: form.weekStart,
          reason: form.reason || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Swap request sent!");
        router.push("/swaps");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create swap request");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Swap Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mySchedules.length === 0 ? (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have any upcoming on-call weeks assigned. You can only
                swap weeks that are assigned to you.
              </p>
            </div>
          ) : (
            <>
              {/* Week to swap */}
              <div className="space-y-2">
                <Label>Your On-Call Week *</Label>
                <Select
                  value={form.weekStart}
                  onValueChange={(v) => updateField("weekStart", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select week to swap" />
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

              {/* Swap type */}
              <div className="space-y-2">
                <Label>Swap Type</Label>
                <Select
                  value={form.swapType}
                  onValueChange={(v) => updateField("swapType", v ?? "")}
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

              {/* Target engineer */}
              <div className="space-y-2">
                <Label>Swap With *</Label>
                <Select
                  value={form.targetId}
                  onValueChange={(v) => updateField("targetId", v ?? "")}
                >
                  <SelectTrigger>
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
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="Why are you requesting this swap?"
                  value={form.reason}
                  onChange={(e) => updateField("reason", e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || mySchedules.length === 0}
          >
            {loading ? "Sending..." : "Send Swap Request"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
