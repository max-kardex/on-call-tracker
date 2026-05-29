"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Clock, LogOut } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

export function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Please enter an invite code");
      return;
    }

    setSubmitting(true);
    try {
      await api.verify.submit(trimmed);
      toast.success("Account verified! Let's get you set up.");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Invalid invite code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-lg space-y-6">
        {/* Main verification card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-heading">Account Verification Required</CardTitle>
            <CardDescription>
              Your account needs to be verified before you can access the On-Call Tracker.
              Enter an invite code or wait for admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invite Code Section */}
            <form onSubmit={handleSubmitCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Invite Code
                </Label>
                <Input
                  id="invite-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A3F9X2K7"
                  maxLength={8}
                  className="font-mono text-center text-lg tracking-widest uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Ask your team admin for the invite code
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Spinner /> : <KeyRound className="h-4 w-4" />}
                {submitting ? "Verifying..." : "Verify with Code"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Pending Approval Section */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Waiting for Admin Approval</p>
              </div>
              <p className="text-sm text-muted-foreground">
                An admin has been notified of your signup. Once they approve your account,
                you&apos;ll be able to access the tracker on your next visit.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
