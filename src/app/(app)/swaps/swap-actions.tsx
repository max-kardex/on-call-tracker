"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, X } from "lucide-react";

interface Props {
  swapId: string;
  isRequester: boolean;
  isTarget: boolean;
}

export function SwapActions({ swapId, isRequester, isTarget }: Props) {
  const router = useRouter();

  async function handleAction(action: "approve" | "reject" | "cancel") {
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const messages = {
          approve: "Swap approved! Schedule has been updated.",
          reject: "Swap rejected.",
          cancel: "Swap request cancelled.",
        };
        toast.success(messages[action]);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isTarget && (
        <>
          <Button size="sm" onClick={() => handleAction("approve")}>
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleAction("reject")}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </>
      )}
      {isRequester && (
        <Button size="sm" variant="ghost" onClick={() => handleAction("cancel")}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );
}
