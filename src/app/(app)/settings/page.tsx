import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompensationRulesForm } from "./compensation-rules-form";
import { SlackConfigForm } from "./slack-config-form";
import { TeamManagement } from "./team-management";
import { hasRole } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = hasRole(session, "ADMIN");

  const [rules, slackConfig, users, pendingUsers, inviteCode] = await Promise.all([
    isAdmin
      ? prisma.compensationRule.findMany({ orderBy: { ruleType: "asc" } })
      : Promise.resolve([]),
    isAdmin
      ? prisma.slackConfig.findFirst({ where: { isActive: true } })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: { verified: true },
      select: { id: true, name: true, fullName: true, email: true, roles: true, isActive: true, image: true },
      orderBy: { name: "asc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { verified: false },
          select: { id: true, name: true, fullName: true, email: true, image: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.inviteCode.findFirst({
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { fullName: true, name: true } } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure application settings and admin options
        </p>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">
            Team
            {isAdmin && pendingUsers.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-medium text-destructive-foreground">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="compensation">Compensation Rules</TabsTrigger>}
          {isAdmin && <TabsTrigger value="slack">Slack</TabsTrigger>}
        </TabsList>

        <TabsContent value="team">
          <TeamManagement
            users={users.map((u) => ({
              ...u,
              roles: u.roles as string[],
            }))}
            isAdmin={isAdmin}
            pendingUsers={pendingUsers.map((u) => ({
              ...u,
              createdAt: u.createdAt.toISOString(),
            }))}
            inviteCode={inviteCode ? {
              code: inviteCode.code,
              createdAt: inviteCode.createdAt.toISOString(),
              createdBy: inviteCode.createdBy.fullName || inviteCode.createdBy.name || "Unknown",
            } : null}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="compensation">
            <CompensationRulesForm
              initialRules={rules.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                ruleType: r.ruleType,
                value: r.value,
                severity: r.severity,
                isActive: r.isActive,
              }))}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="slack">
            <SlackConfigForm
              initialConfig={
                slackConfig
                  ? {
                      id: slackConfig.id,
                      webhookUrl: slackConfig.webhookUrl,
                      channelName: slackConfig.channelName,
                      notifyOnRotation: slackConfig.notifyOnRotation,
                      notifyOnSwap: slackConfig.notifyOnSwap,
                      notifyOnHighSeverity: slackConfig.notifyOnHighSeverity,
                    }
                  : null
              }
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
