"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Calculator, AlertTriangle } from "lucide-react";

interface CallRow {
  id: string;
  duration: number; // minutes
  dayType: "weekday" | "weekend" | "holiday";
  severity: "P1" | "P2" | "P3" | "P4";
}

interface Props {
  severityMultipliers: Record<string, number>;
  periodCap: number | null;
  weekendMult: number;
  holidayMult: number;
}

function computeCallPto(
  row: CallRow,
  severityMultipliers: Record<string, number>,
  weekendMult: number,
  holidayMult: number
): { pto: number; callBase: number; timeMult: number; sevMult: number } {
  const callBase = Math.ceil(row.duration / 60);
  const timeMult =
    row.dayType === "holiday"
      ? holidayMult
      : row.dayType === "weekend"
        ? weekendMult
        : 1;
  const sevMult = severityMultipliers[row.severity] ?? 1;
  return { pto: callBase * timeMult * sevMult, callBase, timeMult, sevMult };
}

let nextId = 1;
function generateId() {
  return `call-${nextId++}`;
}

export function CompensationCalculator({
  severityMultipliers,
  periodCap,
  weekendMult,
  holidayMult,
}: Props) {
  const [calls, setCalls] = useState<CallRow[]>([
    { id: generateId(), duration: 30, dayType: "weekday", severity: "P3" },
  ]);

  function addCall() {
    setCalls((prev) => [
      ...prev,
      { id: generateId(), duration: 30, dayType: "weekday", severity: "P3" },
    ]);
  }

  function removeCall(id: string) {
    setCalls((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCall(id: string, field: keyof Omit<CallRow, "id">, value: string | number) {
    setCalls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  // Compute totals
  const results = calls.map((call) => ({
    call,
    ...computeCallPto(call, severityMultipliers, weekendMult, holidayMult),
  }));
  const rawTotal = results.reduce((sum, r) => sum + r.pto, 0);
  const isCapped = periodCap !== null && rawTotal > periodCap;
  const finalTotal = isCapped ? periodCap! : rawTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          PTO Calculator
        </CardTitle>
        <CardDescription>
          Add hypothetical calls to estimate your PTO earnings for a period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Call rows */}
        <div className="space-y-3">
          {results.map(({ call, pto, callBase, timeMult, sevMult }, index) => (
            <div
              key={call.id}
              className="flex items-center gap-3 p-3 border rounded-md bg-muted/30"
            >
              <span className="text-xs text-muted-foreground font-mono w-6">
                #{index + 1}
              </span>

              {/* Duration (numeric minutes) */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={call.duration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) {
                      updateCall(call.id, "duration", val);
                    }
                  }}
                  className="w-[70px] h-9 rounded-md border bg-background px-2 text-sm font-mono text-center"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>

              {/* Day type */}
              <Select
                value={call.dayType}
                onValueChange={(v) => updateCall(call.id, "dayType", v ?? "weekday")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Weekday (1x)</SelectItem>
                  <SelectItem value="weekend">Weekend ({weekendMult}x)</SelectItem>
                  <SelectItem value="holiday">Holiday ({holidayMult}x)</SelectItem>
                </SelectContent>
              </Select>

              {/* Severity */}
              <Select
                value={call.severity}
                onValueChange={(v) => updateCall(call.id, "severity", v ?? "P3")}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="P3">P3</SelectItem>
                  <SelectItem value="P4">P4</SelectItem>
                </SelectContent>
              </Select>

              {/* Per-call PTO result */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {callBase}&times;{timeMult}&times;{sevMult}=
                </span>
                <Badge variant="secondary" className="font-mono">
                  {pto.toFixed(1)}h
                </Badge>
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeCall(call.id)}
                disabled={calls.length === 1}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add call button */}
        <Button variant="outline" size="sm" onClick={addCall}>
          <Plus className="h-4 w-4 mr-1" />
          Add Call
        </Button>

        {/* Summary */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total calls</span>
            <span className="font-medium">{calls.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Raw PTO</span>
            <span className="font-mono">{rawTotal.toFixed(1)}h</span>
          </div>
          {periodCap !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period cap</span>
              <span className="font-mono">{periodCap}h</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span>Final PTO</span>
            <span className="flex items-center gap-1.5">
              {finalTotal.toFixed(1)}h
              {isCapped && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
            </span>
          </div>
          {isCapped && (
            <p className="text-xs text-amber-500">
              Capped at {periodCap}h (raw total was {rawTotal.toFixed(1)}h)
            </p>
          )}
        </div>

        {/* Current multiplier reference */}
        <div className="border-t pt-4 mt-2">
          <p className="text-xs text-muted-foreground mb-2">Active multipliers:</p>
          <div className="flex flex-wrap gap-3">
            {["P1", "P2", "P3", "P4"].map((sev) => (
              <span key={sev} className="text-xs font-mono">
                {sev}={severityMultipliers[sev] ?? 1}x
              </span>
            ))}
            <span className="text-xs font-mono">Weekend={weekendMult}x</span>
            <span className="text-xs font-mono">Holiday={holidayMult}x</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
