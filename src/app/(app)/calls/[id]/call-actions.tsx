"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CallActions({ callId }: { callId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this call log?")) return;

    try {
      const res = await fetch(`/api/calls/${callId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Call log deleted");
        router.push("/calls");
      } else {
        toast.error("Failed to delete call log");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive flex items-center gap-2"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
