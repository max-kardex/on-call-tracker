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
import { Save, UserCheck, UserX } from "lucide-react";

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

interface Props {
  users: User[];
  isAdmin: boolean;
}

export function TeamManagement({ users, isAdmin }: Props) {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

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
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, roles: editRoles }),
      });
      if (res.ok) {
        toast.success("Roles updated successfully");
        setEditingUser(null);
        window.location.reload();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update roles");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, isActive: !currentActive }),
      });
      if (res.ok) {
        toast.success(`User ${!currentActive ? "activated" : "deactivated"}`);
        window.location.reload();
      } else {
        toast.error("Failed to update user");
      }
    } catch {
      toast.error("An error occurred");
    }
  }

  return (
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
                            <Button size="sm" onClick={() => saveRoles(user.id)}>
                              <Save className="h-4 w-4" />
                              Save
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
                            >
                              {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              {user.isActive ? "Deactivate" : "Activate"}
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
  );
}
