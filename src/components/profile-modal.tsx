"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { MessageSquare, Phone, MessageCircle, Monitor, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTACT_METHODS = [
  { value: "SMS", label: "Text (SMS)", icon: MessageSquare },
  { value: "SLACK", label: "Slack", icon: MessageCircle },
  { value: "TEAMS", label: "Teams", icon: Monitor },
  { value: "CALL", label: "Call", icon: Phone },
] as const;

export function ProfileModal({ open, onOpenChange }: Props) {
  const { data: session } = useSession();
  const [fullName, setFullName] = useState("");
  const [preferredContact, setPreferredContact] = useState("SLACK");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch full profile when modal opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      api.profile
        .get()
        .then((data) => {
          if (data.fullName) setFullName(data.fullName);
          if (data.preferredContact) setPreferredContact(data.preferredContact);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await api.profile.update({
        fullName: fullName.trim(),
        preferredContact,
      });
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your display name and contact preferences. Username and email are managed through your GitHub account.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading profile...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Editable: Full Name */}
            <div className="space-y-2">
              <Label htmlFor="profile-fullname">Full Name</Label>
              <Input
                id="profile-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>

            {/* Editable: Preferred Contact Method */}
            <div className="space-y-2">
              <Label htmlFor="profile-contact">Preferred Contact Method</Label>
              <Select
                value={preferredContact}
                onValueChange={(v) => setPreferredContact(v ?? "SLACK")}
              >
                <SelectTrigger id="profile-contact">
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
                How you prefer to be reached when on-call
              </p>
            </div>

            {/* Read-only: Username (from GitHub) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Username</Label>
              <Input
                value={session?.user?.name ?? ""}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                From your GitHub account
              </p>
            </div>

            {/* Read-only: Email */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <Input
                value={session?.user?.email ?? ""}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Managed by your GitHub account
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Spinner /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
