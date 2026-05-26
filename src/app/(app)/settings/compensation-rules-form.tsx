"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Trash2, Plus, Calendar } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/api-client";

interface Rule {
  id?: string;
  name: string;
  description: string | null;
  ruleType: string;
  value: number;
  severity: string | null;
  isActive: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  isCustom: boolean;
}

interface Props {
  initialRules: Rule[];
  isAdmin: boolean;
}

export function CompensationRulesForm({ initialRules, isAdmin }: Props) {
  // Parse initial rules into structured state
  const getMultiplier = (severity: string) => {
    const rule = initialRules.find(
      (r) => r.ruleType === "severity_multiplier" && r.severity === severity && r.isActive
    );
    return rule?.value ?? 1;
  };
  const getCapValue = () => {
    const rule = initialRules.find((r) => r.ruleType === "period_cap" && r.isActive);
    return rule?.value ?? 24;
  };
  const getRuleValue = (ruleType: string, defaultVal: number) => {
    const rule = initialRules.find((r) => r.ruleType === ruleType && r.isActive);
    return rule?.value ?? defaultVal;
  };

  const [p1Mult, setP1Mult] = useState(getMultiplier("P1"));
  const [p2Mult, setP2Mult] = useState(getMultiplier("P2"));
  const [p3Mult, setP3Mult] = useState(getMultiplier("P3"));
  const [p4Mult, setP4Mult] = useState(getMultiplier("P4"));
  const [weekendMult, setWeekendMult] = useState(getRuleValue("weekend_multiplier", 2));
  const [holidayMult, setHolidayMult] = useState(getRuleValue("holiday_multiplier", 2));
  const [periodCap, setPeriodCap] = useState(getCapValue());
  const [loading, setLoading] = useState(false);

  // Holiday management
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);

  useEffect(() => {
    fetchHolidays();
  }, [holidayYear]);

  async function fetchHolidays() {
    try {
      const data = await api.holidays.list(holidayYear);
      setHolidays(data);
    } catch {
      // Silently fail
    }
  }

  async function handleSaveRules() {
    setLoading(true);
    try {
      const rules = [
        { name: "Weekend Multiplier", description: "Multiplier for Saturday/Sunday calls", ruleType: "weekend_multiplier", value: weekendMult, severity: null, isActive: true },
        { name: "Holiday Multiplier", description: "Multiplier for holiday calls (takes precedence over weekend)", ruleType: "holiday_multiplier", value: holidayMult, severity: null, isActive: true },
        { name: "P1 Multiplier", description: "Multiplier for P1 severity calls", ruleType: "severity_multiplier", value: p1Mult, severity: "P1", isActive: true },
        { name: "P2 Multiplier", description: "Multiplier for P2 severity calls", ruleType: "severity_multiplier", value: p2Mult, severity: "P2", isActive: true },
        { name: "P3 Multiplier", description: "Multiplier for P3 severity calls", ruleType: "severity_multiplier", value: p3Mult, severity: "P3", isActive: true },
        { name: "P4 Multiplier", description: "Multiplier for P4 severity calls", ruleType: "severity_multiplier", value: p4Mult, severity: "P4", isActive: true },
        { name: "Period Cap", description: "Maximum PTO hours per engineer per period", ruleType: "period_cap", value: periodCap, severity: null, isActive: true },
      ];

      await api.compensation.saveRules(rules);
      toast.success("Compensation rules saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName) {
      toast.error("Date and name are required");
      return;
    }

    setHolidayLoading(true);
    try {
      await api.holidays.create(newHolidayDate, newHolidayName);
      toast.success("Holiday added");
      setNewHolidayDate("");
      setNewHolidayName("");
      fetchHolidays();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setHolidayLoading(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    setDeletingHolidayId(id);
    try {
      await api.holidays.delete(id);
      toast.success("Holiday removed");
      fetchHolidays();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setDeletingHolidayId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Formula explanation */}
      <Card>
        <CardHeader>
          <CardTitle>PTO Compensation Formula</CardTitle>
          <CardDescription>
            PTO is calculated per call handled during on-call shifts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted/50 rounded-md p-4 font-mono text-sm space-y-1">
            <p>For each call:</p>
            <p className="ml-4">call_base = ceil(duration / 60 min) &mdash; 1 PTO hour per started hour</p>
            <p className="ml-4">time_mult = holiday ? holiday_rate : weekend ? weekend_rate : 1x</p>
            <p className="ml-4">sev_mult  = configured per severity below</p>
            <p className="ml-4 font-bold">call_pto  = call_base &times; time_mult &times; sev_mult</p>
            <p className="mt-2 font-bold">Total PTO = min( &Sigma; call_pto, period_cap )</p>
          </div>
        </CardContent>
      </Card>

      {/* Severity Multipliers + Time Multipliers + Cap */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation Rules</CardTitle>
          <CardDescription>
            Configure time multipliers, severity multipliers, and the per-period cap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Time Multipliers */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Time Multipliers</Label>
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Weekend (Sat/Sun)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="1"
                  value={weekendMult}
                  onChange={(e) => setWeekendMult(parseFloat(e.target.value) || 1)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Holiday</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="1"
                  value={holidayMult}
                  onChange={(e) => setHolidayMult(parseFloat(e.target.value) || 1)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Holiday takes precedence over weekend when both apply (no stacking).
            </p>
          </div>

          {/* Severity Multipliers */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Severity Multipliers</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">P1 (Critical)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={p1Mult}
                  onChange={(e) => setP1Mult(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">P2 (High)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={p2Mult}
                  onChange={(e) => setP2Mult(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">P3 (Medium)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={p3Mult}
                  onChange={(e) => setP3Mult(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">P4 (Low)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={p4Mult}
                  onChange={(e) => setP4Mult(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>

          {/* Period Cap */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Period Cap (max PTO hours per engineer per period)</Label>
            <div className="max-w-xs">
              <Input
                type="number"
                step="1"
                min="1"
                value={periodCap}
                onChange={(e) => setPeriodCap(parseFloat(e.target.value) || 0)}
                disabled={!isAdmin}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Engineers cannot earn more than this many PTO hours in a single report period.
            </p>
          </div>
        </CardContent>
        {isAdmin && (
          <CardFooter>
            <Button onClick={handleSaveRules} disabled={loading}>
              {loading ? <Spinner /> : <Save className="h-4 w-4" />}
              {loading ? "Saving..." : "Save Rules"}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Holiday Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Holiday Calendar
          </CardTitle>
          <CardDescription>
            US federal holidays are included automatically. Add custom company holidays below.
            Calls on weekends or holidays earn 2x time multiplier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <Label>Year:</Label>
            <Input
              type="number"
              className="w-24"
              value={holidayYear}
              onChange={(e) => setHolidayYear(parseInt(e.target.value) || new Date().getFullYear())}
            />
          </div>

          {/* Holiday list */}
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No holidays loaded</p>
            ) : (
              holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-24">
                      {format(new Date(holiday.date), "MMM d")}
                    </span>
                    <span className="text-sm">{holiday.name}</span>
                    {holiday.isCustom ? (
                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Federal</Badge>
                    )}
                  </div>
                  {isAdmin && holiday.isCustom && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      disabled={deletingHolidayId === holiday.id}
                    >
                      {deletingHolidayId === holiday.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add custom holiday */}
          {isAdmin && (
            <div className="flex items-end gap-3 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Holiday Name</Label>
                <Input
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="e.g., Company Day Off"
                />
              </div>
              <Button onClick={handleAddHoliday} disabled={holidayLoading}>
                {holidayLoading ? <Spinner /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
