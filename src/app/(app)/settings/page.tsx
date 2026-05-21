import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompensationRulesForm } from "./compensation-rules-form";
import { SlackConfigForm } from "./slack-config-form";
import { TeamManagement } from "./team-management";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = (session?.user as Record<string, unknown>)?.role === "ADMIN";

  const [rules, slackConfig, users] = await Promise.all([
    prisma.compensationRule.findMany({ orderBy: { ruleType: "asc" } }),
    prisma.slackConfig.findFirst({ where: { isActive: true } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, image: true },
      orderBy: { name: "asc" },
    }),
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
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="compensation">Compensation Rules</TabsTrigger>
          <TabsTrigger value="slack">Slack</TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <TeamManagement
            users={users.map((u) => ({
              ...u,
              role: u.role as string,
            }))}
            isAdmin={isAdmin}
          />
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
