"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Phone, MessageCircle, Monitor, ArrowRight, UserCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

const CONTACT_METHODS = [
  { value: "SMS", label: "Text (SMS)", icon: MessageSquare },
  { value: "SLACK", label: "Slack", icon: MessageCircle },
  { value: "TEAMS", label: "Teams", icon: Monitor },
  { value: "CALL", label: "Call", icon: Phone },
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [fullName, setFullName] = useState("");
  const [preferredContact, setPreferredContact] = useState("SLACK");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    setSaving(true);
    try {
      await api.profile.update({
        fullName: fullName.trim(),
        preferredContact,
        onboarded: true,
      });
      toast.success("Welcome aboard! Your profile is set up.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-heading">Welcome to On-Call Tracker</CardTitle>
            <CardDescription>
              Let&apos;s get your profile set up. This helps your team know how to reach you when you&apos;re on-call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="onboard-fullname">Full Name</Label>
              <Input
                id="onboard-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Smith"
                required
              />
              <p className="text-xs text-muted-foreground">
                This is how your name will appear in the schedule and reports
              </p>
            </div>

            {/* Preferred Contact Method */}
            <div className="space-y-2">
              <Label htmlFor="onboard-contact">Preferred Contact Method</Label>
              <Select
                value={preferredContact}
                onValueChange={(v) => setPreferredContact(v ?? "SLACK")}
              >
                <SelectTrigger id="onboard-contact">
                  <SelectValue placeholder="Select contact method">
                    {(() => {
                      const selected = CONTACT_METHODS.find((m) => m.value === preferredContact);
                      if (!selected) return "Select contact method";
                      const Icon = selected.icon;
                      return (
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {selected.label}
                        </span>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How you prefer to be reached when you&apos;re on-call
              </p>
            </div>

            {/* Read-only info */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Your GitHub account</p>
              <div className="flex items-center gap-3">
                {session?.user?.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm">{session?.user?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.email ?? "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              {saving ? "Setting up..." : "Get Started"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
