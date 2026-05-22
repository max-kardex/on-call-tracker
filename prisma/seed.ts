import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create sample users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@example.com" },
      update: {},
      create: {
        name: "Alice Johnson",
        email: "alice@example.com",
        roles: ["ADMIN", "ENGINEER"],
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {},
      create: {
        name: "Bob Smith",
        email: "bob@example.com",
        roles: ["ENGINEER"],
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "carol@example.com" },
      update: {},
      create: {
        name: "Carol Williams",
        email: "carol@example.com",
        roles: ["MANAGER"],
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "dave@example.com" },
      update: {},
      create: {
        name: "Dave Brown",
        email: "dave@example.com",
        roles: ["ENGINEER"],
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "eve@example.com" },
      update: {},
      create: {
        name: "Eve Davis",
        email: "eve@example.com",
        roles: ["SUPPORT"],
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create default compensation rules
  const rules = await Promise.all([
    prisma.compensationRule.create({
      data: {
        name: "P1 Multiplier",
        description: "Multiplier for critical severity calls",
        ruleType: "severity_multiplier",
        value: 1,
        severity: "P1",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P2 Multiplier",
        description: "Multiplier for high severity calls",
        ruleType: "severity_multiplier",
        value: 1,
        severity: "P2",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P3 Multiplier",
        description: "Multiplier for medium severity calls",
        ruleType: "severity_multiplier",
        value: 1,
        severity: "P3",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P4 Multiplier",
        description: "Multiplier for low severity calls",
        ruleType: "severity_multiplier",
        value: 1,
        severity: "P4",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "Weekend Multiplier",
        description: "Time multiplier for calls on weekends (Saturday/Sunday)",
        ruleType: "weekend_multiplier",
        value: 2,
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "Holiday Multiplier",
        description: "Time multiplier for calls on holidays",
        ruleType: "holiday_multiplier",
        value: 2,
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "Period Cap",
        description: "Maximum PTO hours per engineer per report period",
        ruleType: "period_cap",
        value: 24,
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${rules.length} compensation rules`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
