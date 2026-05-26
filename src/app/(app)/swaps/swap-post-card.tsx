"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Hand, X, ArrowLeftRight, Gift } from "lucide-react";
import { ClaimDialog } from "./claim-dialog";
import { api, ApiError } from "@/lib/api-client";

interface SerializedUser {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  image: string | null;
}

export interface SerializedSwapPost {
  id: string;
  status: string;
  postType: string;
  coverageType: string;
  weekStart: string;
  specificDays: string[];
  offeredWeekStart: string | null;
  offeredDays: string[];
  reason: string | null;
  claimedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  poster: SerializedUser;
  claimer: SerializedUser | null;
}

interface Props {
  post: SerializedSwapPost;
  currentUserId: string;
  mySchedules: { id: string; weekStart: string; weekEnd: string }[];
}

function userLabel(u: SerializedUser | null) {
  if (!u) return "—";
  return u.fullName ?? u.name ?? u.email ?? "Unknown";
}

function statusVariant(status: string) {
  switch (status) {
    case "OPEN":
      return "default" as const;
    case "CLAIMED":
      return "secondary" as const;
    case "CANCELLED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export function SwapPostCard({ post, currentUserId, mySchedules }: Props) {
  const router = useRouter();
  const [claimOpen, setClaimOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const isPoster = post.poster.id === currentUserId;
  const isOpen = post.status === "OPEN";
  const isSwap = post.postType === "SWAP";
  const isSpecificDays = post.coverageType === "SPECIFIC_DAYS";

  async function handleCancel() {
    if (!confirm("Cancel this swap post?")) return;
    setWorking(true);
    try {
      await api.swaps.cancel(post.id);
      toast.success("Post cancelled");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setWorking(false);
    }
  }

  const weekLabel = `${format(parseISO(post.weekStart), "MMM d, yyyy")}`;
  const daysLabel = isSpecificDays
    ? post.specificDays
        .map((d) => format(parseISO(d), "EEE MMM d"))
        .join(", ")
    : "Full week";

  return (
    <>
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isSwap ? (
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Gift className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{userLabel(post.poster)}</span>
                <span className="text-muted-foreground">
                  {isSwap ? "wants to swap" : "wants to give away"}
                </span>
                <Badge variant="outline">{daysLabel}</Badge>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm">Week of {weekLabel}</span>
              </div>

              {post.reason && (
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;{post.reason}&rdquo;
                </p>
              )}

              {post.status === "CLAIMED" && post.claimer && (
                <p className="text-sm text-muted-foreground">
                  Claimed by <span className="font-medium">{userLabel(post.claimer)}</span>
                  {post.offeredWeekStart && (
                    <>
                      {" · offered week of "}
                      <span className="font-medium">
                        {format(parseISO(post.offeredWeekStart), "MMM d, yyyy")}
                      </span>
                    </>
                  )}
                  {post.offeredDays.length > 0 && (
                    <>
                      {" · "}
                      {post.offeredDays
                        .map((d) => format(parseISO(d), "EEE MMM d"))
                        .join(", ")}
                    </>
                  )}
                </p>
              )}
            </div>

            <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
          </div>

          {isOpen && (
            <div className="flex items-center justify-end gap-2">
              {!isPoster && (
                <Button
                  size="sm"
                  onClick={() => setClaimOpen(true)}
                  disabled={working}
                >
                  <Hand className="h-4 w-4 mr-2" />
                  {isSwap ? "Offer Trade" : "Claim"}
                </Button>
              )}
              {isPoster && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={working}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Post
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isOpen && !isPoster && (
        <ClaimDialog
          open={claimOpen}
          onOpenChange={setClaimOpen}
          post={post}
          mySchedules={mySchedules}
          onClaimed={() => router.refresh()}
        />
      )}
    </>
  );
}
