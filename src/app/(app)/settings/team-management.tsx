"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Save, UserCheck, UserX, Copy, RefreshCw, ShieldCheck, KeyRound, Clock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";

const ALL_ROLES = ["ADMIN", "MANAGER", "ENGINEER", "SUPPORT"] as const;

const ROLE_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  ENGINEER: "outline",
  SUPPORT: "secondary",
};

interface User {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  roles: string[];
  isActive: boolean;
  image: string | null;
}

interface PendingUser {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
}

interface InviteCodeData {
  code: string;
  createdAt: string;
  createdBy: string;
}

interface Props {
  users: User[];
  isAdmin: boolean;
  pendingUsers?: PendingUser[];
  inviteCode?: InviteCodeData | null;
}

export function TeamManagement({ users, isAdmin, pendingUsers = [], inviteCode: initialInviteCode = null }: Props) {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [currentInviteCode, setCurrentInviteCode] = useState<InviteCodeData | null>(initialInviteCode);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  function startEditing(user: User) {
    setEditingUser(user.id);
    setEditRoles([...user.roles]);
  }

  function cancelEditing() {
    setEditingUser(null);
    setEditRoles([]);
  }

  function toggleEditRole(role: string) {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function saveRoles(userId: string) {
    if (editRoles.length === 0) {
      toast.error("User must have at least one role");
      return;
    }
    setSavingUserId(userId);
    try {
      await api.users.updateRoles(userId, editRoles);
      toast.success("Roles updated successfully");
      setEditingUser(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setSavingUserId(null);
    }
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    setTogglingUserId(userId);
    try {
      await api.users.toggleActive(userId, !currentActive);
      toast.success(`User ${!currentActive ? "activated" : "deactivated"}`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function approveUser(userId: string) {
    setApprovingUserId(userId);
    try {
      await api.users.approve(userId);
      toast.success("User approved successfully");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setApprovingUserId(null);
    }
  }

  async function regenerateInviteCode() {
    setRegeneratingCode(true);
    try {
      const result = await api.inviteCode.regenerate();
      setCurrentInviteCode({
        code: result.code,
        createdAt: new Date().toISOString(),
        createdBy: "You",
      });
      toast.success("Invite code regenerated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setRegeneratingCode(false);
    }
  }

  function copyInviteCode() {
    if (currentInviteCode) {
      navigator.clipboard.writeText(currentInviteCode.code);
      toast.success("Invite code copied to clipboard");
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Users Section - Admin only */}
      {isAdmin && pendingUsers.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Verification
              <Badge variant="destructive" className="ml-2">{pendingUsers.length}</Badge>
            </CardTitle>
            <CardDescription>
              These users have signed up but haven&apos;t been verified yet. Approve them to grant access.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => {
                  const displayName = user.fullName ?? user.name ?? "Unknown";
                  const initials = displayName.split(" ").map((n) => n[0]).join("") || "?";

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image ?? undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => approveUser(user.id)}
                          disabled={approvingUserId === user.id}
                        >
                          {approvingUserId === user.id ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                          {approvingUserId === user.id ? "Approving..." : "Approve"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Code Section - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Invite Code
            </CardTitle>
            <CardDescription>
              Share this code with new team members so they can verify themselves without waiting for admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentInviteCode ? (
              <div className="flex items-center gap-4">
                <code className="rounded-md border bg-muted px-4 py-2 font-mono text-lg tracking-widest">
                  {currentInviteCode.code}
                </code>
                <Button size="sm" variant="outline" onClick={copyInviteCode}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button size="sm" variant="outline" onClick={regenerateInviteCode} disabled={regeneratingCode}>
                  {regeneratingCode ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  {regeneratingCode ? "Regenerating..." : "Regenerate"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Created by {currentInviteCode.createdBy} on {new Date(currentInviteCode.createdAt).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">No invite code configured yet.</p>
                <Button size="sm" onClick={regenerateInviteCode} disabled={regeneratingCode}>
                  {regeneratingCode ? <Spinner /> : <KeyRound className="h-4 w-4" />}
                  {regeneratingCode ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage team members and their roles. Only users with the Engineer role are included in rotation generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const displayName = user.fullName ?? user.name ?? "Unknown";
                const initials = displayName.split(" ").map((n) => n[0]).join("") || "?";
                const isEditing = editingUser === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image ?? undefined} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1">
                          {ALL_ROLES.map((role) => (
                            <Badge
                              key={role}
                              variant={editRoles.includes(role) ? "default" : "outline"}
                              className="cursor-pointer select-none"
                              onClick={() => toggleEditRole(role)}
                            >
                              {role}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant={ROLE_COLORS[role] ?? "secondary"}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "outline" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => saveRoles(user.id)} disabled={savingUserId === user.id}>
                                {savingUserId === user.id ? <Spinner /> : <Save className="h-4 w-4" />}
                                {savingUserId === user.id ? "Saving..." : "Save"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(user)}
                              >
                                Edit Roles
                              </Button>
                              <Button
                                size="sm"
                                variant={user.isActive ? "ghost" : "outline"}
                                onClick={() => toggleActive(user.id, user.isActive)}
                                disabled={togglingUserId === user.id}
                              >
                                {togglingUserId === user.id ? (
                                  <Spinner />
                                ) : user.isActive ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                                {togglingUserId === user.id
                                  ? user.isActive ? "Deactivating..." : "Activating..."
                                  : user.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
