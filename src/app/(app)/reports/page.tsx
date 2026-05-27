"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Calculator, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

interface CompensationEntry {
  userId: string;
  userName: string;
  totalCalls: number;
  totalDuration: number;
  callsBySeverity: Record<string, number>;
  regularCalls: number;
  weekendHolidayCalls: number;
  totalPtoRaw: number;
  totalHours: number;
  capped: boolean;
}

export default function ReportsPage() {
  const [periodStart, setPeriodStart] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [periodEnd, setPeriodEnd] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [data, setData] = useState<CompensationEntry[] | null>(null);
  const [periodCap, setPeriodCap] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCalculate() {
    setLoading(true);
    try {
      const result = await api.compensation.calculate(periodStart, periodEnd);
      setData(result.compensation as CompensationEntry[]);
      setPeriodCap(result.periodCap);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    window.open(
      `/api/compensation?action=export&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      "_blank"
    );
  }

  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  const totalHours = data?.reduce((sum, entry) => sum + entry.totalHours, 0) ?? 0;
  const totalDuration = data?.reduce((sum, entry) => sum + entry.totalDuration, 0) ?? 0;
  const cappedCount = data?.filter((entry) => entry.capped).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">PTO Compensation Report</h1>
        <p className="text-muted-foreground">
          Calculate and export PTO compensation based on on-call activity
        </p>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
          <CardDescription>
            Select a date range to calculate PTO compensation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <Button onClick={handleCalculate} disabled={loading}>
              <Calculator className="h-4 w-4 mr-2" />
              {loading ? "Calculating..." : "Calculate"}
            </Button>
            {data && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Engineers</p>
                <p className="text-2xl font-bold">{data.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total PTO Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Calls Handled</p>
                <p className="text-2xl font-bold">
                  {data.reduce((sum, e) => sum + e.totalCalls, 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Call Duration</p>
                <p className="text-2xl font-bold">{formatDuration(totalDuration)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Period Cap</p>
                <p className="text-2xl font-bold">
                  {periodCap !== null ? `${periodCap}h` : "None"}
                </p>
                {cappedCount > 0 && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {cappedCount} engineer{cappedCount > 1 ? "s" : ""} capped
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>Compensation Breakdown</CardTitle>
              <CardDescription>
                PTO = (call_base &times; time_mult &times; sev_mult) per call, capped at {periodCap ?? "no limit"}h
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Engineer</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Regular</TableHead>
                    <TableHead>Wknd/Holiday</TableHead>
                    <TableHead>P1</TableHead>
                    <TableHead>P2</TableHead>
                    <TableHead>P3</TableHead>
                    <TableHead>P4</TableHead>
                    <TableHead>Raw PTO</TableHead>
                    <TableHead className="font-bold">Final PTO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No on-call activity found for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((entry) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{entry.userName}</TableCell>
                        <TableCell>{entry.totalCalls}</TableCell>
                        <TableCell>{formatDuration(entry.totalDuration)}</TableCell>
                        <TableCell>{entry.regularCalls}</TableCell>
                        <TableCell>
                          {entry.weekendHolidayCalls > 0 ? (
                            <Badge variant="secondary">{entry.weekendHolidayCalls}</Badge>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.callsBySeverity.P1 > 0 && (
                            <Badge variant="destructive">{entry.callsBySeverity.P1}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.callsBySeverity.P2 > 0 && (
                            <Badge variant="destructive">{entry.callsBySeverity.P2}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.callsBySeverity.P3 > 0 && (
                            <Badge variant="secondary">{entry.callsBySeverity.P3}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.callsBySeverity.P4 > 0 && (
                            <Badge variant="outline">{entry.callsBySeverity.P4}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.totalPtoRaw.toFixed(1)}h
                        </TableCell>
                        <TableCell className="font-bold">
                          <span className="flex items-center gap-1">
                            {entry.totalHours.toFixed(1)}h
                            {entry.capped && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
