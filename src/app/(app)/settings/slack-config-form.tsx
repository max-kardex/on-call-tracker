"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface SlackConfigData {
  id?: string;
  webhookUrl: string;
  channelName: string | null;
  notifyOnRotation: boolean;
  notifyOnSwap: boolean;
  notifyOnHighSeverity: boolean;
}

interface Props {
  initialConfig: SlackConfigData | null;
  isAdmin: boolean;
}

export function SlackConfigForm({ initialConfig, isAdmin }: Props) {
  const [config, setConfig] = useState<SlackConfigData>(
    initialConfig ?? {
      webhookUrl: "",
      channelName: "",
      notifyOnRotation: true,
      notifyOnSwap: true,
      notifyOnHighSeverity: true,
    }
  );
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string | boolean) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!config.webhookUrl) {
      toast.error("Webhook URL is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "slack", ...config }),
      });

      if (res.ok) {
        toast.success("Slack configuration saved");
      } else {
        toast.error("Failed to save configuration");
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
        <CardTitle>Slack Integration</CardTitle>
        <CardDescription>
          Configure Slack webhook notifications for on-call events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={config.webhookUrl}
            onChange={(e) => updateField("webhookUrl", e.target.value)}
            disabled={!isAdmin}
          />
          <p className="text-xs text-muted-foreground">
            Create an incoming webhook in your Slack workspace settings.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Channel Name (optional)</Label>
          <Input
            placeholder="#on-call-alerts"
            value={config.channelName ?? ""}
            onChange={(e) => updateField("channelName", e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-3">
          <Label>Notification Preferences</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.notifyOnRotation}
                onChange={(e) => updateField("notifyOnRotation", e.target.checked)}
                disabled={!isAdmin}
                className="rounded"
              />
              Rotation reminders (notify upcoming on-call engineer)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.notifyOnSwap}
                onChange={(e) => updateField("notifyOnSwap", e.target.checked)}
                disabled={!isAdmin}
                className="rounded"
              />
              Swap request notifications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.notifyOnHighSeverity}
                onChange={(e) => updateField("notifyOnHighSeverity", e.target.checked)}
                disabled={!isAdmin}
                className="rounded"
              />
              High severity call alerts (P1/P2)
            </label>
          </div>
        </div>
      </CardContent>
      {isAdmin && (
        <CardFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Spinner /> : <Save className="h-4 w-4" />}
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
