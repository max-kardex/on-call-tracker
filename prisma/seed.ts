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
        role: "ADMIN",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {},
      create: {
        name: "Bob Smith",
        email: "bob@example.com",
        role: "ENGINEER",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "carol@example.com" },
      update: {},
      create: {
        name: "Carol Williams",
        email: "carol@example.com",
        role: "ENGINEER",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "dave@example.com" },
      update: {},
      create: {
        name: "Dave Brown",
        email: "dave@example.com",
        role: "ENGINEER",
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "eve@example.com" },
      update: {},
      create: {
        name: "Eve Davis",
        email: "eve@example.com",
        role: "ENGINEER",
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create default compensation rules
  const rules = await Promise.all([
    prisma.compensationRule.create({
      data: {
        name: "Base Weekly Hours",
        description: "PTO hours earned per week on-call regardless of calls",
        ruleType: "base_weekly",
        value: 4,
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "Per Call Hours",
        description: "Base PTO hours earned per call handled",
        ruleType: "per_call",
        value: 1,
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P1 Severity Multiplier",
        description: "Multiplier for critical severity calls",
        ruleType: "severity_multiplier",
        value: 3,
        severity: "P1",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P2 Severity Multiplier",
        description: "Multiplier for high severity calls",
        ruleType: "severity_multiplier",
        value: 2,
        severity: "P2",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P3 Severity Multiplier",
        description: "Multiplier for medium severity calls",
        ruleType: "severity_multiplier",
        value: 1,
        severity: "P3",
        isActive: true,
      },
    }),
    prisma.compensationRule.create({
      data: {
        name: "P4 Severity Multiplier",
        description: "Multiplier for low severity calls",
        ruleType: "severity_multiplier",
        value: 0.5,
        severity: "P4",
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
