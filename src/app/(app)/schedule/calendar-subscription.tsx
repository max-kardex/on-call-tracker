"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, Copy, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

interface Props {
  initialUrl: string | null;
  isAdmin: boolean;
}

export function CalendarSubscription({ initialUrl, isAdmin }: Props) {
  const [subscriptionUrl, setSubscriptionUrl] = useState(initialUrl);
  const [regenerating, setRegenerating] = useState(false);

  async function regenerateToken() {
    setRegenerating(true);
    try {
      const result = await api.calendarToken.regenerate();
      setSubscriptionUrl(result.url);
      toast.success("Calendar token regenerated. Share the new URL with your team.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setRegenerating(false);
    }
  }

  function copyUrl() {
    if (subscriptionUrl) {
      navigator.clipboard.writeText(subscriptionUrl);
      toast.success("Calendar URL copied to clipboard");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Subscription
        </CardTitle>
        <CardDescription>
          Subscribe to this URL in Google Calendar, Outlook, or Apple Calendar to see the on-call schedule.
          Anyone with this link can view the schedule — no account needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscriptionUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={subscriptionUrl}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="outline" onClick={copyUrl}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Add as a &quot;Subscribe by URL&quot; calendar. Updates automatically.
              </p>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={regenerateToken}
                  disabled={regenerating}
                >
                  {regenerating ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  {regenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              )}
            </div>
          </div>
        ) : isAdmin ? (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              No calendar link has been generated yet.
            </p>
            <Button size="sm" onClick={regenerateToken} disabled={regenerating}>
              {regenerating ? <Spinner /> : <Calendar className="h-4 w-4" />}
              {regenerating ? "Generating..." : "Generate Link"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No calendar link has been configured yet. Ask an admin to generate one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
