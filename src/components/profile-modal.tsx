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
import { MessageSquare, Phone, MessageCircle, Monitor } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [preferredContact, setPreferredContact] = useState("SLACK");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch full profile when modal opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.name) setName(data.name);
          if (data.preferredContact) setPreferredContact(data.preferredContact);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          preferredContact,
        }),
      });

      if (res.ok) {
        toast.success("Profile updated");
        await updateSession({ name: name.trim() });
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred");
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
            Update your display name and contact preferences. Email and GitHub username are managed through your GitHub account.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading profile...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Editable: Name */}
            <div className="space-y-2">
              <Label htmlFor="profile-name">Display Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
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
                  <SelectValue placeholder="Select contact method" />
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
            {saving && <Spinner />}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
