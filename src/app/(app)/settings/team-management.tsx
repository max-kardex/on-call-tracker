"use client";

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
import { ShieldCheck, UserCog, UserCheck, UserX } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  image: string | null;
}

interface Props {
  users: User[];
  isAdmin: boolean;
}

export function TeamManagement({ users, isAdmin }: Props) {
  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "ADMIN" ? "ENGINEER" : "ADMIN";
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      if (res.ok) {
        toast.success(`Role updated to ${newRole}`);
        window.location.reload();
      } else {
        toast.error("Failed to update role");
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
          Manage engineers in the on-call rotation. Only active engineers are included in rotation generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engineer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const initials = user.name?.split(" ").map((n) => n[0]).join("") ?? "?";
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name ?? "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "outline" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleRole(user.id, user.role)}
                        >
                          {user.role === "ADMIN" ? <UserCog className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                          {user.role === "ADMIN" ? "Make Engineer" : "Make Admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant={user.isActive ? "ghost" : "outline"}
                          onClick={() => toggleActive(user.id, user.isActive)}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
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
