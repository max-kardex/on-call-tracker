"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  engineers: { id: string; name: string | null }[];
}

export function CallFilters({ engineers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/calls?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/calls");
  }

  const hasSeverity = searchParams.get("severity");
  const hasUserId = searchParams.get("userId");
  const hasFilters = hasSeverity || hasUserId;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={hasSeverity ?? "all"}
        onValueChange={(v) => updateFilter("severity", v === "all" ? null : v ?? null)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severity</SelectItem>
          <SelectItem value="P1">P1 - Critical</SelectItem>
          <SelectItem value="P2">P2 - High</SelectItem>
          <SelectItem value="P3">P3 - Medium</SelectItem>
          <SelectItem value="P4">P4 - Low</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={hasUserId ?? "all"}
        onValueChange={(v) => updateFilter("userId", v === "all" ? null : v ?? null)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Engineer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Engineers</SelectItem>
          {engineers.map((eng) => (
            <SelectItem key={eng.id} value={eng.id}>
              {eng.name ?? "Unknown"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
