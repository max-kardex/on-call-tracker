"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Rule {
  id?: string;
  name: string;
  description: string | null;
  ruleType: string;
  value: number;
  severity: string | null;
  isActive: boolean;
}

interface Props {
  initialRules: Rule[];
  isAdmin: boolean;
}

export function CompensationRulesForm({ initialRules, isAdmin }: Props) {
  const [rules, setRules] = useState<Rule[]>(
    initialRules.length > 0
      ? initialRules
      : [
          { name: "Base Weekly Hours", description: "Hours earned per week on-call", ruleType: "base_weekly", value: 4, severity: null, isActive: true },
          { name: "Per Call Hours", description: "Base hours per call handled", ruleType: "per_call", value: 1, severity: null, isActive: true },
          { name: "P1 Multiplier", description: "Multiplier for P1 severity calls", ruleType: "severity_multiplier", value: 3, severity: "P1", isActive: true },
          { name: "P2 Multiplier", description: "Multiplier for P2 severity calls", ruleType: "severity_multiplier", value: 2, severity: "P2", isActive: true },
          { name: "P3 Multiplier", description: "Multiplier for P3 severity calls", ruleType: "severity_multiplier", value: 1, severity: "P3", isActive: true },
          { name: "P4 Multiplier", description: "Multiplier for P4 severity calls", ruleType: "severity_multiplier", value: 0.5, severity: "P4", isActive: true },
        ]
  );
  const [loading, setLoading] = useState(false);

  function updateRule(index: number, field: string, value: string | number | boolean) {
    setRules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addRule() {
    setRules((prev) => [
      ...prev,
      { name: "", description: null, ruleType: "per_call", value: 0, severity: null, isActive: true },
    ]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/compensation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_rules", rules }),
      });

      if (res.ok) {
        toast.success("Compensation rules saved");
      } else {
        toast.error("Failed to save rules");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PTO Compensation Rules</CardTitle>
        <CardDescription>
          Configure how PTO hours are calculated based on on-call activity.
          Formula: Base Weekly Hours + (Per Call Hours x Severity Multiplier) per call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="flex items-end gap-3 p-3 border rounded-md">
            <div className="flex-1 space-y-2">
              <Label>Name</Label>
              <Input
                value={rule.name}
                onChange={(e) => updateRule(index, "name", e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="w-40 space-y-2">
              <Label>Type</Label>
              <Select
                value={rule.ruleType}
                onValueChange={(v) => updateRule(index, "ruleType", v ?? "")}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base_weekly">Base Weekly</SelectItem>
                  <SelectItem value="per_call">Per Call</SelectItem>
                  <SelectItem value="severity_multiplier">Severity Multiplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                step="0.5"
                value={rule.value}
                onChange={(e) => updateRule(index, "value", parseFloat(e.target.value))}
                disabled={!isAdmin}
              />
            </div>
            {rule.ruleType === "severity_multiplier" && (
              <div className="w-24 space-y-2">
                <Label>Severity</Label>
                <Select
                  value={rule.severity ?? ""}
                   onValueChange={(v) => updateRule(index, "severity", v ?? "")}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1</SelectItem>
                    <SelectItem value="P2">P2</SelectItem>
                    <SelectItem value="P3">P3</SelectItem>
                    <SelectItem value="P4">P4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeRule(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {isAdmin && (
          <Button variant="outline" onClick={addRule}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        )}
      </CardContent>
      {isAdmin && (
        <CardFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Spinner /> : <Save className="h-4 w-4" />}
            {loading ? "Saving..." : "Save Rules"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
