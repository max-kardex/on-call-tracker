import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Phone,
  ArrowLeftRight,
  Clock,
  Bell,
  Hand,
  Shield,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const rules = await prisma.compensationRule.findMany({
    where: { isActive: true },
    orderBy: [{ ruleType: "asc" }, { severity: "asc" }],
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-heading font-bold">How It Works</h1>
        <p className="text-muted-foreground mt-1">
          A guide to the on-call rotation system, compensation rules, and how to
          use this tool.
        </p>
      </div>

      {/* Rotation Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Rotation Schedule
          </CardTitle>
          <CardDescription>
            How weekly on-call assignments work
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul className="space-y-2 list-disc pl-5">
            <li>
              On-call rotations run <strong>Monday to Sunday</strong> (7-day
              weeks).
            </li>
            <li>
              An admin generates the rotation using a <strong>round-robin</strong>{" "}
              algorithm that cycles through all active engineers in alphabetical
              order.
            </li>
            <li>
              The generator continues from where the last rotation left off, so
              the order stays fair over time.
            </li>
            <li>
              Admins can <strong>reassign</strong> or <strong>delete</strong> any
              week manually (these show as &quot;Override&quot; entries).
            </li>
            <li>
              The schedule page always shows the next <strong>12 weeks</strong>,
              including any unassigned gaps.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Self-Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5" />
            Self-Assignment (Volunteering)
          </CardTitle>
          <CardDescription>
            Proactively claim on-call weeks
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul className="space-y-2 list-disc pl-5">
            <li>
              Any engineer can <strong>self-assign</strong> to an unassigned
              future week directly from the Schedule page — no approval needed.
            </li>
            <li>
              In the <strong>calendar view</strong>, open weeks show a
              &quot;Take&quot; button on the Monday cell. In the{" "}
              <strong>list view</strong>, available weeks have a &quot;Take This
              Week&quot; button.
            </li>
            <li>
              Self-assigned weeks are marked with a{" "}
              <Badge variant="secondary" className="gap-1 inline-flex">
                <Hand className="h-3 w-3" />
                Volunteered
              </Badge>{" "}
              badge.
            </li>
            <li>
              You can <strong>withdraw</strong> from a self-assigned week at any
              time (before the week starts is recommended).
            </li>
            <li>
              <strong>Impact on rotation generation:</strong> Engineers who have
              already self-assigned a week in the generation window are{" "}
              <em>deprioritized</em> (placed last in the round-robin order). They
              won&apos;t be skipped entirely, but regular engineers get assigned
              first.
            </li>
            <li>
              Self-assignment is <strong>first-come, first-served</strong> — once
              a week is taken, others cannot claim it.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Call Logging */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Logging
          </CardTitle>
          <CardDescription>
            Recording on-call incidents
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul className="space-y-2 list-disc pl-5">
            <li>
              When you handle an on-call incident, log it in the{" "}
              <strong>Call Log</strong> section with the severity, time, and a
              brief summary.
            </li>
            <li>
              <strong>Severity levels:</strong>
              <ul className="mt-1 space-y-1 list-disc pl-5">
                <li>
                  <Badge variant="destructive">P1</Badge> — Critical outage,
                  customer-facing impact, immediate response required
                </li>
                <li>
                  <Badge className="bg-orange-500 text-white">P2</Badge> — Major
                  degradation, significant impact, urgent response
                </li>
                <li>
                  <Badge variant="secondary">P3</Badge> — Minor issue, limited
                  impact, next business day response acceptable
                </li>
                <li>
                  <Badge variant="outline">P4</Badge> — Informational,
                  monitoring alert, no immediate action needed
                </li>
              </ul>
            </li>
            <li>
              Include a <strong>resolution</strong> note describing what was done
              to resolve or mitigate the issue.
            </li>
            <li>
              P1 and P2 calls automatically trigger a{" "}
              <strong>Slack notification</strong> to the team channel (if
              configured).
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Swap System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Swap Requests
          </CardTitle>
          <CardDescription>
            Trading on-call weeks with teammates
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul className="space-y-2 list-disc pl-5">
            <li>
              If you can&apos;t cover your assigned week, you can request a{" "}
              <strong>swap</strong> with another engineer.
            </li>
            <li>
              Swap types: <strong>Full Week</strong> (swap entire rotation) or{" "}
              <strong>Specific Days</strong> (partial coverage).
            </li>
            <li>
              The target engineer must <strong>approve</strong> the swap — it&apos;s
              a mutual agreement.
            </li>
            <li>
              Once approved, the schedule automatically updates to reflect the
              new assignment.
            </li>
            <li>
              You can <strong>cancel</strong> a pending swap request before
              it&apos;s responded to.
            </li>
            <li>
              A Slack notification is sent when a swap is requested (if
              configured).
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* PTO Compensation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            PTO Compensation
          </CardTitle>
          <CardDescription>
            How on-call hours translate to time off
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Engineers earn compensatory time off (PTO) <strong>per call handled</strong> during
                on-call duty. There is no base weekly component.
              </li>
              <li>
                <strong>Duration:</strong> Any call counts as <strong>1 hour</strong> of PTO.
                If the call lasted longer than 60 minutes, it counts as <strong>2 hours</strong>.
              </li>
              <li>
                <strong>Weekend/Holiday multiplier:</strong> Calls handled on weekends or
                holidays earn <strong>2x</strong> the normal rate.
              </li>
              <li>
                <strong>Severity multiplier:</strong> Each severity level has a configurable
                multiplier (default 1x for all).
              </li>
              <li>
                <strong>Period cap:</strong> A maximum PTO hours limit per engineer per report
                period prevents runaway accumulation.
              </li>
            </ul>
          </div>

          {/* Formula display */}
          <div className="bg-muted/50 rounded-md p-4 font-mono text-xs space-y-1">
            <p>For each call:</p>
            <p className="ml-4">call_base = (duration &le; 60 min) ? 1h : 2h</p>
            <p className="ml-4">time_mult = (weekend or holiday) ? 2x : 1x</p>
            <p className="ml-4">sev_mult  = configured per severity</p>
            <p className="ml-4 font-bold">call_pto  = call_base &times; time_mult &times; sev_mult</p>
            <p className="mt-2 font-bold">Total PTO = min( &Sigma; call_pto, period_cap )</p>
          </div>

          {/* Live compensation rules table */}
          {rules.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Current Compensation Rules
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {rule.name}
                        {rule.description && (
                          <span className="block text-xs text-muted-foreground">
                            {rule.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {rule.ruleType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rule.severity ? (
                          <Badge
                            variant={
                              rule.severity === "P1"
                                ? "destructive"
                                : rule.severity === "P2"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {rule.severity}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            &mdash;
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {rule.ruleType === "period_cap"
                          ? `${rule.value}h max`
                          : `${rule.value}x`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No compensation rules configured yet. An admin can set these up in
              Settings.
            </p>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong>Holidays:</strong> US federal holidays are included automatically.
                Admins can add custom company holidays under{" "}
                <strong>Settings → Compensation Rules</strong>.
              </li>
              <li>
                Reports can be exported as <strong>CSV</strong> for payroll or HR
                processing.
              </li>
              <li>
                Admins configure multipliers, cap, and holidays under{" "}
                <strong>Settings → Compensation Rules</strong>.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Slack Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Slack Notifications
          </CardTitle>
          <CardDescription>
            Automated team notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong>Rotation reminders</strong> — Posted when a new on-call
              week begins, tagging the assigned engineer.
            </li>
            <li>
              <strong>Self-assignment alerts</strong> — Posted when someone
              volunteers for an open week.
            </li>
            <li>
              <strong>Swap requests</strong> — Posted when a swap is requested
              between engineers.
            </li>
            <li>
              <strong>High-severity calls</strong> — Posted when a P1 or P2
              incident is logged.
            </li>
            <li>
              Notifications are sent to the configured Slack channel via webhook.
              Admins can enable/disable individual notification types in{" "}
              <strong>Settings → Slack</strong>.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles & Permissions
          </CardTitle>
          <CardDescription>
            Users can have multiple roles. Permissions are additive across roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold text-sm mb-2">Support</h4>
              <ul className="space-y-1 list-disc pl-5 text-sm">
                <li>View schedules, calls, and reports</li>
                <li>Read-only access to all data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Engineer</h4>
              <ul className="space-y-1 list-disc pl-5 text-sm">
                <li>View schedule and dashboard</li>
                <li>Self-assign to open weeks</li>
                <li>Withdraw from self-assigned weeks</li>
                <li>Log calls</li>
                <li>Request swaps and accept/decline incoming swaps</li>
                <li>View compensation reports</li>
                <li>Included in rotation generation pool</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Manager</h4>
              <ul className="space-y-1 list-disc pl-5 text-sm">
                <li>Log calls</li>
                <li>Generate rotation schedules</li>
                <li>Assign, reassign, or delete any schedule entry</li>
                <li>Approve or reject any swap request</li>
                <li>View compensation reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Admin</h4>
              <ul className="space-y-1 list-disc pl-5 text-sm">
                <li>Everything managers can do, plus:</li>
                <li>Manage team members (activate/deactivate, assign roles)</li>
                <li>Configure compensation rules</li>
                <li>Configure Slack webhook integration</li>
                <li>Self-assign and request swaps</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Note: A user who requests a swap can never approve their own request,
            even if they have Manager or Admin roles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
